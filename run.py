import threading
import webbrowser
import subprocess
import sys
import os
import time
from threading import Timer
from backend import create_app

app = create_app()

# Global variable to track the last ping
last_heartbeat = time.time()

@app.route('/api/heartbeat', methods=['POST'])
def heartbeat():
    global last_heartbeat
    last_heartbeat = time.time()
    return {"status": "alive"}

def monitor_heartbeat():
    # Give the app 10 seconds to initially boot and open the UI
    time.sleep(10)
    while True:
        # If no heartbeat for 5 seconds, shut down the backend
        if time.time() - last_heartbeat > 5:
            print("UI closed. Shutting down backend...")
            os._exit(0)
        time.sleep(2)

def run_flask():
    # Turn off werkzeug logs so it doesn't spam the console with heartbeats
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)

def open_app_mode():
    url = 'http://127.0.0.1:5000/'
    
    if sys.platform == 'linux':
        browsers = ['brave-browser', 'google-chrome', 'chromium-browser', 'microsoft-edge']
        for b in browsers:
            if subprocess.call(['which', b], stdout=subprocess.DEVNULL) == 0:
                # Pass --class so KDE matches it to your .desktop file and uses the SVG icon!
                subprocess.Popen([b, f'--app={url}', '--class=wh3-mod-manager'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return
                
    elif sys.platform == 'win32':
        chrome_path = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
        edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
        if os.path.exists(chrome_path):
            subprocess.Popen([chrome_path, f'--app={url}'])
            return
        elif os.path.exists(edge_path):
            subprocess.Popen([edge_path, f'--app={url}'])
            return
            
    webbrowser.open(url)

if __name__ == '__main__':
    # 1. Start heartbeat monitor
    threading.Thread(target=monitor_heartbeat, daemon=True).start()

    # 2. Start Flask in a background daemon thread
    server_thread = threading.Thread(target=run_flask, daemon=True)
    server_thread.start()

    # 3. Open UI in App Mode
    Timer(1.5, open_app_mode).start()

    # Keep main thread alive
    while True:
        time.sleep(1)