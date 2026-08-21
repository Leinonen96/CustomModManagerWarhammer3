#!/bin/bash

# Dynamically resolve directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR" || exit 1

echo "Initializing Total War: WARHAMMER III Native Mod Manager (Tauri v2)..."

# Fix WebKitGTK Wayland DMA-BUF issue on NVIDIA/Linux compositors
export WEBKIT_DISABLE_DMABUF_RENDERER=1
export WEBKIT_DISABLE_COMPOSITING_MODE=1

# Auto-Install / Auto-Update Desktop Shortcut if missing or directory moved
SHORTCUT_PATH="$HOME/.local/share/applications/wh3-mod-manager.desktop"
if [ ! -f "$SHORTCUT_PATH" ] || ! grep -Fq "Path=$DIR" "$SHORTCUT_PATH" 2>/dev/null; then
    echo "Updating desktop shortcut location..."
    bash "$DIR/install_shortcut.sh"
fi

# Dev mode flag (runs Vite dev server + debug binary together)
if [ "$1" = "--dev" ] || [ "$1" = "-d" ]; then
    echo "Starting in development mode (Vite + Tauri dev)..."
    npm run tauri:dev
    exit $?
fi

# Optional flag to trigger clean frontend + backend rebuild
if [ "$1" = "--build" ] || [ "$1" = "-b" ]; then
    echo "Rebuilding native release binary..."
    npm run build
    cd "$DIR/src-tauri" && cargo build --release
    cd "$DIR" || exit 1
    shift
fi

BIN="$DIR/src-tauri/target/release/wh3-mod-manager"

if [ ! -f "$BIN" ]; then
    echo "Release binary not found. Building native release binary..."
    npm run build
    cd "$DIR/src-tauri" && cargo build --release
    cd "$DIR" || exit 1
fi

# Run the standalone release binary
"$BIN" "$@"
EXIT_CODE=$?

# If it failed due to a Wayland protocol error, retry automatically under X11/Xwayland backend
if [ $EXIT_CODE -ne 0 ]; then
    echo "Retrying with GDK_BACKEND=x11 compatibility mode..."
    GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 "$BIN" "$@"
fi