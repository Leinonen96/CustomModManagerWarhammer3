"""
Entry point for WH3 Mod Manager.
Handles server startup, desktop app mode launch, and lifecycle management.
"""
import argparse
import logging
import os
import signal
import socket
import subprocess
import sys
import threading
import time
from threading import Timer
import webbrowser

from backend import create_app
from backend.api import get_last_heartbeat, record_heartbeat
from backend.api.routes_system import get_heartbeat_count

def find_available_port(preferred_port: int = 5000) -> int:
    """Finds an available TCP port, starting with preferred_port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(('127.0.0.1', preferred_port))
            return preferred_port
        except OSError:
            pass

    # Ask OS for any open port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

def monitor_heartbeat(timeout_seconds: int = 60, grace_period: int = 30):
    """
    Monitors UI heartbeats. Gracefully terminates the process only if the UI window was opened
    and has been disconnected for over timeout_seconds.
    """
    time.sleep(grace_period)
    
    while True:
        # Only evaluate if UI has connected at least once
        if get_heartbeat_count() > 0:
            elapsed = time.time() - get_last_heartbeat()
            if elapsed > timeout_seconds:
                print("UI disconnected. Shutting down WH3 Mod Manager backend...")
                os._exit(0)
            
        time.sleep(5)

def open_app_mode(port: int):
    """Launches the UI in a dedicated app-mode browser window."""
    url = f'http://127.0.0.1:{port}/'
    
    if sys.platform == 'linux':
        browsers = ['brave-browser', 'google-chrome', 'chromium-browser', 'microsoft-edge']
        for b in browsers:
            if subprocess.call(['which', b], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0:
                try:
                    subprocess.Popen(
                        [b, f'--app={url}', '--class=wh3-mod-manager'],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL
                    )
                    return
                except Exception:
                    pass
                
    elif sys.platform == 'win32':
        candidates = [
            r'C:\Program Files\Google\Chrome\Application\chrome.exe',
            r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
            r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
            r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
            os.path.expandvars(r'%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe')
        ]
        for path in candidates:
            if os.path.exists(path):
                try:
                    subprocess.Popen([path, f'--app={url}'])
                    return
                except Exception:
                    pass

    # Fallback to default browser
    webbrowser.open(url)

def main():
    parser = argparse.ArgumentParser(description="Total War: WARHAMMER III Mod Manager")
    parser.add_argument("--port", type=int, default=5000, help="Port to run the server on")
    parser.add_argument("--no-browser", action="store_true", help="Do not open browser window automatically")
    parser.add_argument("--no-watchdog", action="store_true", help="Disable heartbeat auto-shutdown watchdog")
    args = parser.parse_args()

    port = find_available_port(args.port)
    app = create_app()

    # Mute standard noisy werkzeug access logs
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)

    record_heartbeat()

    # Graceful SIGINT / SIGTERM handling
    def signal_handler(sig, frame):
        print("\nShutdown requested. Exiting...")
        os._exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, signal_handler)

    # 1. Start heartbeat watchdog
    if not args.no_watchdog:
        watchdog = threading.Thread(target=monitor_heartbeat, daemon=True)
        watchdog.start()

    # 2. Launch browser window in App Mode
    if not args.no_browser:
        Timer(1.2, lambda: open_app_mode(port)).start()

    print(f"==================================================")
    print(f" Total War: WARHAMMER III Mod Manager (Modular)  ")
    print(f" Running at: http://127.0.0.1:{port}/             ")
    print(f"==================================================")

    # 3. Run Flask
    app.run(host='127.0.0.1', port=port, debug=False, use_reloader=False)

if __name__ == '__main__':
    main()