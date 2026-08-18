@echo off
TITLE WH3 Mod Manager

:: Dynamically change directory to where the batch file is located
cd /d "%~dp0"

echo Initializing WH3 Mod Manager (Tauri v2 Native)...

if exist "src-tauri\target\release\wh3-mod-manager.exe" (
    start "" "src-tauri\target\release\wh3-mod-manager.exe"
    exit /b 0
)

if exist "src-tauri\target\debug\wh3-mod-manager.exe" (
    start "" "src-tauri\target\debug\wh3-mod-manager.exe"
    exit /b 0
)

echo Building native app...
call npm run build
cd src-tauri
cargo run
pause