#!/bin/bash

# Dynamically resolve directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR" || exit 1

echo "Initializing Total War: WARHAMMER III Native Mod Manager (Tauri v2)..."

# Fix WebKitGTK Wayland DMA-BUF issue on NVIDIA/Linux compositors
export WEBKIT_DISABLE_DMABUF_RENDERER=1

# Auto-Install Desktop Shortcut
SHORTCUT_PATH="$HOME/.local/share/applications/wh3-mod-manager.desktop"
if [ ! -f "$SHORTCUT_PATH" ]; then
    echo "Generating desktop shortcut..."
    bash "$DIR/install_shortcut.sh"
fi

BIN=""
if [ -f "$DIR/src-tauri/target/release/wh3-mod-manager" ]; then
    BIN="$DIR/src-tauri/target/release/wh3-mod-manager"
elif [ -f "$DIR/src-tauri/target/debug/wh3-mod-manager" ]; then
    BIN="$DIR/src-tauri/target/debug/wh3-mod-manager"
fi

if [ -n "$BIN" ]; then
    # Try running directly
    "$BIN" "$@"
    EXIT_CODE=$?

    # If it failed due to a Wayland protocol error, retry automatically under X11/Xwayland backend
    if [ $EXIT_CODE -ne 0 ]; then
        echo "Retrying with GDK_BACKEND=x11 compatibility mode..."
        GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 "$BIN" "$@"
    fi
else
    echo "Building native binary..."
    npm run build
    cd "$DIR/src-tauri" && cargo run
fi