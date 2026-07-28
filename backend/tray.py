import os
import webbrowser
import pystray
from PIL import Image

def open_dashboard(icon, item):
    webbrowser.open('http://127.0.0.1:5000/')

def quit_application(icon, item):
    icon.stop()
    os._exit(0)

def setup_tray():
    icon_path = "static/gemini-svg.svg"
    
    if os.path.exists(icon_path):
        try:
            image = Image.open(icon_path)
        except Exception:
            image = Image.new('RGB', (64, 64), color=(73, 109, 137))
    else:
        image = Image.new('RGB', (64, 64), color=(73, 109, 137))

    menu = pystray.Menu(
        pystray.MenuItem('Open WH3 Mod Manager', open_dashboard, default=True),
        pystray.MenuItem('Quit', quit_application)
    )

    tray_icon = pystray.Icon("WH3 Mod Manager", image, "WH3 Mod Manager", menu=menu)
    tray_icon.run()