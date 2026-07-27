#!/bin/bash

# Dynamically resolve the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR" || exit 1

echo "Initializing WH3 Mod Manager..."

# Auto-Install Desktop Shortcut
SHORTCUT_PATH="$HOME/.local/share/applications/wh3-mod-manager.desktop"
if [ ! -f "$SHORTCUT_PATH" ]; then
    echo "First run on Linux detected. Generating desktop shortcut..."
    bash "$DIR/install_shortcut.sh"
fi

# Create a local virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate the virtual environment
source venv/bin/activate

# Ensure dependencies are installed
echo "Checking requirements..."
pip install -r requirements.txt -q

# Run the backend server
echo "Starting application..."
python3 app.py