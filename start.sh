#!/bin/bash

# Dynamically resolve the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR" || exit 1

echo "Initializing WH3 Mod Manager..."

# Create a local virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "First run detected. Creating Python virtual environment..."
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