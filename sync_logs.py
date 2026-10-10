import os
import sys
import json
import re
from datetime import datetime

REPO_ROOT = os.path.dirname(os.path.abspath(__file__))
BRAIN_DIR = os.path.expanduser(r"~/.gemini/antigravity/brain")
AGENT_LOGS_DIR = os.path.join(REPO_ROOT, ".agent-logs")
AUTHOR = "AmanSingh1201"
PROJECT = os.path.basename(REPO_ROOT)
TOOL = "antigravity"
MODEL = "gemini-3.8-flash"

def parse_transcript(transcript_path):
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

            m = re.search(r"<USER_REQUEST>\s*(.*?)\s*</USER_REQUEST>", content, re.DOTALL)
            prompt_text = m.group(1).strip() if m else content.strip()

            current_exchange = {
                "prompt": prompt_text,
                "prompt_time": created_at,
                "prompt_model": MODEL,
                "response": None,
                "response_time": None,
                "response_model": MODEL,
                "candidates": []
            }
        elif current_exchange and t == "PLANNER_RESPONSE" and source == "MODEL":
            if content.strip():
                current_exchange["candidates"].append({
                    "content": content.strip(),
                    "time": created_at,
                    "model": MODEL,
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

def format_session_log(session_id, exchanges):
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
        f"model: {MODEL}",
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

def sync_session(session_dir):
    session_id = os.path.basename(session_dir)
    full_path = os.path.join(session_dir, ".system_generated", "logs", "transcript_full.jsonl")
    compact_path = os.path.join(session_dir, ".system_generated", "logs", "transcript.jsonl")

    target = full_path if os.path.exists(full_path) else compact_path
    if not os.path.exists(target):
        return None

    exchanges = parse_transcript(target)
    if not exchanges:
        return None

    os.makedirs(AGENT_LOGS_DIR, exist_ok=True)
    first_ts = exchanges[0]["prompt_time"]
    ts_clean = first_ts[:19].replace("T", "_").replace(":", "-")
    filename = f"{ts_clean}_{session_id}.md"
    out_path = os.path.join(AGENT_LOGS_DIR, filename)

    content = format_session_log(session_id, exchanges)
    if content:
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[sync_logs] Wrote {len(exchanges)} exchange(s) to: {out_path}")
        return out_path
    return None

def main():
    if not os.path.exists(BRAIN_DIR):
        print(f"[sync_logs] Brain directory not found: {BRAIN_DIR}")
        return

    os.makedirs(AGENT_LOGS_DIR, exist_ok=True)
    count = 0
    for entry in os.listdir(BRAIN_DIR):
        s_dir = os.path.join(BRAIN_DIR, entry)
        if os.path.isdir(s_dir):
            if sync_session(s_dir):
                count += 1
    print(f"[sync_logs] Finished syncing {count} session(s).")

if __name__ == "__main__":
    main()
