@echo off
TITLE WH3 Mod Manager

:: Dynamically change directory to where the batch file is located
cd /d "%~dp0"

echo Initializing WH3 Mod Manager...

:: Create a local virtual environment if it doesn't exist
if not exist "venv\" (
    echo First run detected. Creating Python virtual environment...
    python -m venv venv
)

:: Activate the virtual environment
call venv\Scripts\activate.bat

:: Ensure dependencies are installed
echo Checking requirements...
pip install -r requirements.txt -q

:: Run the backend server
echo Starting application...
python app.py

pause