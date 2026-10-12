#!/bin/bash
# Launcher for Website Traffic Generator GUI on a headless server.
# Starts a virtual X11 display (Xvfb) if no DISPLAY is available,
# then launches the Tkinter GUI inside the project's virtualenv.

set -e
cd "$(dirname "$0")"

export XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"
touch "$XAUTHORITY"

# Ensure Xvfb is running on :99 (only if there is no usable display yet)
if [ -z "$DISPLAY" ] || ! python3 - <<'EOF' 2>/dev/null
import ctypes, sys
try:
    lib = ctypes.cdll.LoadLibrary("libX11.so.6")
    d = lib.XOpenDisplay(None)
    if d == 0:
        sys.exit(1)
    lib.XCloseDisplay(d)
except Exception:
    sys.exit(1)
EOF
then
    if ! pgrep -x Xvfb > /dev/null 2>&1; then
        nohup Xvfb :99 -screen 0 1280x1024x24 -nolisten tcp > /dev/null 2>&1 &
        XVFB_PID=$!
        sleep 2
        if ! kill -0 "$XVFB_PID" 2>/dev/null; then
            echo "ERROR: Xvfb failed to start." >&2
            exit 1
        fi
    fi
    export DISPLAY=:99
fi

echo "Using DISPLAY=$DISPLAY"
echo "Launching Website Traffic Generator GUI..."
exec ./venv/bin/python WebsiteTrafficGenerater.py
