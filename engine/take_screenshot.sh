#!/bin/bash
# Capture a screenshot of the running GUI inside the virtual display.
cd "$(dirname "$0")"

export XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"
touch "$XAUTHORITY"

rm -f /tmp/.X11-unix/X99 2>/dev/null
Xvfb :99 -screen 0 1280x1024x24 -nolisten tcp &
XVFB_PID=$!
sleep 2
export DISPLAY=:99

./venv/bin/python WebsiteTrafficGenerater.py &
GUI_PID=$!
sleep 4

./venv/bin/python - <<'EOF'
from PIL import ImageGrab
img = ImageGrab.grab()
img.save("/home/z/my-project/download/gui_screenshot.png")
print("[OK] screenshot saved:", img.size)
EOF

kill $GUI_PID $XVFB_PID 2>/dev/null
echo "done"
