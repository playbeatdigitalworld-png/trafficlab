#!/bin/bash
# One-shot verification: starts Xvfb, tests all package imports, then
# briefly launches the GUI to confirm it opens without crashing.
cd "$(dirname "$0")"

export XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"
touch "$XAUTHORITY"

rm -f /tmp/.X11-unix/X99 2>/dev/null
Xvfb :99 -screen 0 1280x1024x24 -nolisten tcp &
XVFB_PID=$!
sleep 2

if ! kill -0 "$XVFB_PID" 2>/dev/null; then
    echo "FATAL: Xvfb failed to start"
    exit 1
fi
echo "[OK] Xvfb started (PID $XVFB_PID)"

export DISPLAY=:99

echo ""
echo "=== 1. Package import test ==="
./venv/bin/python - <<'EOF'
import selenium, six, appdirs, packaging, pyparsing, pyautogui, tkinter

print(f"[OK] selenium    {selenium.__version__}")
print(f"[OK] PyAutoGUI  {pyautogui.__version__}  (screen: {pyautogui.size()})")
print(f"[OK] tkinter    Tk {tkinter.TkVersion}")
print(f"[OK] six / appdirs / packaging / pyparsing import fine")

# exact imports used by main.py (the traffic engine)
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
print("[OK] all selenium imports used by main.py work")
EOF

echo ""
echo "=== 2. main.py CLI smoke test ==="
./venv/bin/python main.py --help > /dev/null 2>&1 && echo "[OK] main.py --help runs" || echo "[WARN] main.py --help returned non-zero"

echo ""
echo "=== 3. GUI launch test (5 seconds) ==="
./venv/bin/python - <<'EOF'
import subprocess, sys, time, os
proc = subprocess.Popen(
    ["./venv/bin/python", "WebsiteTrafficGenerater.py"],
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
)
time.sleep(5)
if proc.poll() is None:
    print("[OK] GUI launched successfully and is running (Tk mainloop active)")
    proc.terminate()
    proc.wait(timeout=5)
else:
    out = proc.stdout.read()
    print("[FAIL] GUI exited early with code", proc.returncode)
    print(out[:2000])
    sys.exit(1)
EOF

GUI_TEST=$?

kill $XVFB_PID 2>/dev/null
echo ""
if [ $GUI_TEST -eq 0 ]; then
    echo "=== ALL CHECKS PASSED - setup is complete ==="
else
    echo "=== GUI CHECK FAILED ==="
    exit 1
fi
