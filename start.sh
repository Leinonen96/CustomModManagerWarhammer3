#!/bin/bash

# Dynamically resolve directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR" || exit 1

echo "Initializing Total War: WARHAMMER III Native Mod Manager (Tauri v2)..."

# Auto-Install Desktop Shortcut
SHORTCUT_PATH="$HOME/.local/share/applications/wh3-mod-manager.desktop"
if [ ! -f "$SHORTCUT_PATH" ]; then
    echo "Generating desktop shortcut..."
    bash "$DIR/install_shortcut.sh"
fi

# If release binary exists, run it directly
if [ -f "$DIR/src-tauri/target/release/wh3-mod-manager" ]; then
    exec "$DIR/src-tauri/target/release/wh3-mod-manager"
elif [ -f "$DIR/src-tauri/target/debug/wh3-mod-manager" ]; then
    exec "$DIR/src-tauri/target/debug/wh3-mod-manager"
else
    echo "Building native binary..."
    npm run build
    cd "$DIR/src-tauri" && cargo run
fi