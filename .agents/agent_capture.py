import os
import sys

# Simply invoke scripts/agent_capture.py
script_path = os.path.join(os.path.dirname(__file__), "..", "scripts", "agent_capture.py")
with open(script_path, "r", encoding="utf-8") as f:
    code = f.read()
exec(code)
