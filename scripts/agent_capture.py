import os
import sys
import json
import re
import time
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Workspace is parent of scripts/ or .agents/
WORKSPACE_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
BRAIN_DIR = os.path.expanduser(r"~/.gemini/antigravity/brain")
AGENT_LOGS_DIR = os.path.join(WORKSPACE_ROOT, ".agent-logs")
AUTHOR = "AmanSingh1201"
PROJECT = os.path.basename(WORKSPACE_ROOT)
TOOL = "antigravity"
DEFAULT_MODEL = "gemini-3.8-flash"

def parse_transcript(transcript_path, model_name=DEFAULT_MODEL):
    if not os.path.exists(transcript_path):
        return []

    lines = []
    with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    lines.append(json.loads(line))
                except Exception:
                    pass

    exchanges = []
    current_exchange = None

    for item in lines:
        t = item.get("type")
        source = item.get("source")
        content = item.get("content") or ""
        created_at = item.get("created_at") or ""
        tool_calls = item.get("tool_calls") or []

        if t == "USER_INPUT" and source == "USER_EXPLICIT":
            if current_exchange:
                exchanges.append(current_exchange)

            # Extract verbatim prompt
            m = re.search(r"<USER_REQUEST>\s*(.*?)\s*</USER_REQUEST>", content, re.DOTALL)
            prompt_text = m.group(1).strip() if m else content.strip()

            current_exchange = {
                "prompt": prompt_text,
                "prompt_time": created_at,
                "prompt_model": model_name,
                "response": None,
                "response_time": None,
                "response_model": model_name,
                "candidates": []
            }
        elif current_exchange and t == "PLANNER_RESPONSE" and source == "MODEL":
            if content.strip():
                current_exchange["candidates"].append({
                    "content": content.strip(),
                    "time": created_at,
                    "model": model_name,
                    "has_tool_calls": bool(tool_calls)
                })

    if current_exchange:
        exchanges.append(current_exchange)

    for ex in exchanges:
        candidates = ex.get("candidates", [])
        if candidates:
            final_cand = candidates[-1]
            ex["response"] = final_cand["content"]
            ex["response_time"] = final_cand["time"]
            ex["response_model"] = final_cand["model"]

    return exchanges

def format_session_log(session_id, exchanges, model_name=DEFAULT_MODEL):
    if not exchanges:
        return None

    short_id = session_id[:8]
    first_prompt_time = exchanges[0]["prompt_time"]
    last_prompt_time = exchanges[-1]["prompt_time"]
    date_str = first_prompt_time[:10] if first_prompt_time else datetime.utcnow().strftime("%Y-%m-%d")

    lines = [
        "---",
        f"session_id: {session_id}",
        f"date: {date_str}",
        f"author: {AUTHOR}",
        f"model: {model_name}",
        f"tool: {TOOL}",
        f"project: {PROJECT}",
        f"total_exchanges: {len(exchanges)}",
        f"first_prompt_time: {first_prompt_time}",
        f"last_prompt_time: {last_prompt_time}",
        "---",
        "",
        f"# Session Log - {date_str}",
        "",
        f"Session: {short_id} | Project: {PROJECT} | Author: {AUTHOR}",
        "",
        "---",
        ""
    ]

    for idx, ex in enumerate(exchanges, start=1):
        lines.append(f"[LOG_ENTRY type=PROMPT num={idx} session={short_id}]")
        lines.append(f"timestamp: {ex['prompt_time']}")
        lines.append(f"model: {ex['prompt_model']}")
        lines.append("")
        lines.append(ex["prompt"])
        lines.append("")
        lines.append("")

        if ex["response"]:
            lines.append(f"[LOG_ENTRY type=RESPONSE num={idx} session={short_id}]")
            lines.append(f"timestamp: {ex['response_time']}")
            lines.append(f"model: {ex['response_model']}")
            lines.append("")
            lines.append(ex["response"])
            lines.append("")
            lines.append("")

    return "\n".join(lines)

def get_log_filename(session_id, exchanges):
    first_ts = exchanges[0]["prompt_time"]
    ts_clean = first_ts[:19].replace("T", "_").replace(":", "-")
    return f"{ts_clean}_{session_id}.md"

def process_session(session_dir):
    session_id = os.path.basename(session_dir)
    full_path = os.path.join(session_dir, ".system_generated", "logs", "transcript_full.jsonl")
    compact_path = os.path.join(session_dir, ".system_generated", "logs", "transcript.jsonl")

    target_transcript = full_path if os.path.exists(full_path) else compact_path
    if not os.path.exists(target_transcript):
        return None

    exchanges = parse_transcript(target_transcript)
    if not exchanges:
        return None

    os.makedirs(AGENT_LOGS_DIR, exist_ok=True)
    filename = get_log_filename(session_id, exchanges)
    out_path = os.path.join(AGENT_LOGS_DIR, filename)

    content = format_session_log(session_id, exchanges)
    if content:
        existing_content = ""
        if os.path.exists(out_path):
            with open(out_path, "r", encoding="utf-8") as f:
                existing_content = f.read()

        if existing_content != content:
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"[agent_capture] Updated {out_path}")
            return out_path
    return None

def process_all_sessions():
    if not os.path.exists(BRAIN_DIR):
        return []
    updated = []
    for entry in os.listdir(BRAIN_DIR):
        session_dir = os.path.join(BRAIN_DIR, entry)
        if os.path.isdir(session_dir):
            res = process_session(session_dir)
            if res:
                updated.append(res)
    return updated

def daemon_loop():
    print("[agent_capture] Starting background daemon watching brain directory...")
    while True:
        try:
            process_all_sessions()
        except Exception as e:
            print(f"[agent_capture] Error in daemon loop: {e}", file=sys.stderr)
        time.sleep(1)

def handle_hook_invocation():
    if "--stdin" in sys.argv:
        try:
            input_data = sys.stdin.read()
            if input_data:
                payload = json.loads(input_data)
                session_id = payload.get("conversationId")
                if session_id:
                    session_dir = os.path.join(BRAIN_DIR, session_id)
                    if os.path.exists(session_dir):
                        process_session(session_dir)
                        print(json.dumps({"decision": "allow"}))
                        return
        except Exception:
            pass

    process_all_sessions()
    print(json.dumps({"decision": "allow"}))

if __name__ == "__main__":
    if "--daemon" in sys.argv:
        daemon_loop()
    elif "--once" in sys.argv:
        process_all_sessions()
    else:
        handle_hook_invocation()
