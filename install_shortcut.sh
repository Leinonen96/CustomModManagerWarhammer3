#!/bin/bash

# Dynamically resolve the absolute path of the project directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SHORTCUT_PATH="$HOME/.local/share/applications/wh3-mod-manager.desktop"

echo "Generating Linux desktop shortcut..."

# Use your specific SVG icon, otherwise fallback to a generic system icon
ICON_PATH="$DIR/gemini-svg.svg"
if [ ! -f "$ICON_PATH" ]; then
    ICON_PATH="utilities-terminal"
    echo "Warning: gemini-svg.svg not found in project root. Using generic fallback icon."
fi

# Generate the .desktop configuration file
cat <<EOF > "$SHORTCUT_PATH"
[Desktop Entry]
Type=Application
Name=WH3 Mod Manager
Comment=Lightweight Mod Manager for Total War: WARHAMMER III
Exec="$DIR/start.sh"
Path=$DIR
Icon=$ICON_PATH
Terminal=true
Categories=Game;Utility;
EOF

# Make the shortcut executable
chmod +x "$SHORTCUT_PATH"

echo "Success! 'WH3 Mod Manager' has been added to your application launcher."