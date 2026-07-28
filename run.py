import threading
import webbrowser
from threading import Timer
from backend import create_app
from backend.tray import setup_tray

app = create_app()

def run_flask():
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)

if __name__ == '__main__':
    # 1. Start Flask in a background daemon thread
    server_thread = threading.Thread(target=run_flask, daemon=True)
    server_thread.start()

    # 2. Open browser automatically on start
    Timer(1.5, lambda: webbrowser.open('http://127.0.0.1:5000/')).start()

    # 3. Run the System Tray icon on the main thread
    setup_tray()