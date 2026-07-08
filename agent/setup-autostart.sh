#!/bin/bash
# Install the agent as a Mac background service (auto-starts on login, no terminal needed)
# Run this ONCE after install.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_NAME="com.vidrow.adint.agent"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
LOG_PATH="$HOME/ad-intelligence-agent.log"
PYTHON_PATH="$SCRIPT_DIR/venv/bin/python"

echo ""
echo "================================================"
echo "  Ad Intelligence Agent — Autostart Setup"
echo "================================================"
echo ""

if [ ! -f "$PYTHON_PATH" ]; then
    echo "❌ Run ./install.sh first (venv not found)"
    exit 1
fi

# Write the launchd plist
cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>

    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON_PATH</string>
        <string>$SCRIPT_DIR/agent.py</string>
    </array>

    <key>WorkingDirectory</key>
    <string>$SCRIPT_DIR</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$SCRIPT_DIR/venv/bin</string>
    </dict>

    <key>StandardOutPath</key>
    <string>$LOG_PATH</string>

    <key>StandardErrorPath</key>
    <string>$LOG_PATH</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

# Load it
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

echo "✅ Agent installed as background service"
echo ""
echo "  Starts automatically when you log into this Mac"
echo "  Logs: $LOG_PATH"
echo ""
echo "  To stop:   launchctl unload $PLIST_PATH"
echo "  To start:  launchctl load $PLIST_PATH"
echo "  To remove: launchctl unload $PLIST_PATH && rm $PLIST_PATH"
echo ""
