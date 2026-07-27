import os
import json
import webbrowser
import threading
from threading import Timer
from flask import Flask, render_template, jsonify, request
import pystray
from PIL import Image

app = Flask(__name__)

# --- CONFIGURATION SETUP ---
CONFIG_FILE = "config.json"
PRESET_DIR = "./presets"
os.makedirs(PRESET_DIR, exist_ok=True)

# Default configuration template using standard Windows paths
DEFAULT_CONFIG = {
    "WORKSHOP_DIR": "C:/Program Files (x86)/Steam/steamapps/workshop/content/1142710",
    "GAME_DATA_DIR": "C:/Program Files (x86)/Steam/steamapps/common/Total War WARHAMMER III/data",
    "SCRIPT_FILE": "C:/Users/Public/AppData/Roaming/The Creative Assembly/Warhammer3/scripts/user.script.txt"
}

def load_config():
    if not os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(DEFAULT_CONFIG, f, indent=4)
        return DEFAULT_CONFIG
    
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

# Load configuration and assign variables dynamically
config = load_config()
WORKSHOP_DIR = config.get("WORKSHOP_DIR", "")
GAME_DATA_DIR = config.get("GAME_DATA_DIR", "")
SCRIPT_FILE = config.get("SCRIPT_FILE", "")


# --- MOD MANAGEMENT ---
def discover_workshop_mods():
    mods = []
    if not os.path.exists(WORKSHOP_DIR):
        return mods
    
    for folder in os.listdir(WORKSHOP_DIR):
        folder_path = os.path.join(WORKSHOP_DIR, folder)
        if os.path.isdir(folder_path):
            pack_files = [f for f in os.listdir(folder_path) if f.endswith('.pack')]
            for pack in pack_files:
                pack_path = os.path.join(folder_path, pack)
                
                img_name = pack.replace('.pack', '.png')
                img_path = os.path.join(folder_path, img_name)
                if not os.path.exists(img_path):
                    img_name = "thumbnail.png"
                
                mods.append({
                    "id": folder,
                    "name": pack,
                    "real_path": pack_path,
                    "thumb": f"/workshop_assets/{folder}/{img_name}",
                    "url": f"https://steamcommunity.com/sharedfiles/filedetails/?id={folder}"
                })
    return mods

# --- CONFIGURATION ENDPOINTS ---
@app.route('/api/config', methods=['GET'])
def get_config():
    return jsonify(load_config())

@app.route('/api/config', methods=['POST'])
def save_config_api():
    global WORKSHOP_DIR, GAME_DATA_DIR, SCRIPT_FILE
    data = request.json
    
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)
        
    WORKSHOP_DIR = data.get("WORKSHOP_DIR", "")
    GAME_DATA_DIR = data.get("GAME_DATA_DIR", "")
    SCRIPT_FILE = data.get("SCRIPT_FILE", "")
    
    return jsonify({"status": "success", "message": "Settings saved successfully!"})

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/mods', methods=['GET'])
def get_mods():
    return jsonify(discover_workshop_mods())

@app.route('/api/apply', methods=['POST'])
def apply_load_order():
    data = request.json
    
    try:
        for file in os.listdir(GAME_DATA_DIR):
            file_path = os.path.join(GAME_DATA_DIR, file)
            if os.path.islink(file_path) and file.endswith('.pack'):
                os.unlink(file_path)
        
        script_lines = []
        for mod in data:
            target_link = os.path.join(GAME_DATA_DIR, mod['name'])
            
            if os.path.lexists(target_link):
                os.unlink(target_link)
                
            os.symlink(mod['real_path'], target_link)
            script_lines.append(f'mod "{mod["name"]}";')
            
        os.makedirs(os.path.dirname(SCRIPT_FILE), exist_ok=True)
        with open(SCRIPT_FILE, 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join(script_lines) + '\n')
            
        return jsonify({"status": "success", "message": "Load order applied successfully!"})
    except PermissionError:
        return jsonify({
            "status": "error", 
            "message": "Permission Denied. If you are on Windows, you must run this tool as an Administrator or enable Developer Mode to create symlinks."
        }), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/workshop_assets/<folder>/<filename>')
def serve_workshop_asset(folder, filename):
    from flask import send_from_directory
    return send_from_directory(os.path.join(WORKSHOP_DIR, folder), filename)

@app.route('/api/presets', methods=['GET'])
def get_presets():
    presets = []
    if os.path.exists(PRESET_DIR):
        for f in os.listdir(PRESET_DIR):
            if f.endswith('.json'):
                presets.append(f.replace('.json', ''))
    return jsonify(presets)

@app.route('/api/preset/<name>', methods=['GET'])
def load_preset(name):
    path = os.path.join(PRESET_DIR, f"{name}.json")
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    return jsonify([])

@app.route('/api/preset/<name>', methods=['POST'])
def save_preset(name):
    data = request.json
    path = os.path.join(PRESET_DIR, f"{name}.json")
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)
    return jsonify({"status": "success", "message": f"Preset '{name}' saved successfully!"})

@app.route('/api/preset/<name>', methods=['DELETE'])
def delete_preset(name):
    path = os.path.join(PRESET_DIR, f"{name}.json")
    if os.path.exists(path):
        os.remove(path)
        return jsonify({"status": "success", "message": f"Preset '{name}' deleted successfully!"})
    return jsonify({"status": "error", "message": "Preset not found!"}), 404


# --- SYSTEM TRAY INTEGRATION ---
def run_flask():
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)

def open_dashboard(icon, item):
    webbrowser.open('http://127.0.0.1:5000/')

def quit_application(icon, item):
    icon.stop()
    os._exit(0)

def setup_tray():
    # Load your SVG/PNG icon for the tray (pystray prefers a PIL Image)
    # If using SVG directly, ensure you have a fallback PNG or load from static/
    icon_path = "static/gemini-svg.svg"
    
    if os.path.exists(icon_path):
        # PIL can load PNG directly. If your icon is strictly SVG, 
        # consider placing a small PNG version in static/ for system tray compatibility.
        try:
            image = Image.open(icon_path)
        except Exception:
            image = Image.new('RGB', (64, 64), color = (73, 109, 137))
    else:
        image = Image.new('RGB', (64, 64), color = (73, 109, 137))

    menu = pystray.Menu(
        pystray.MenuItem('Open WH3 Mod Manager', open_dashboard, default=True),
        pystray.MenuItem('Quit', quit_application)
    )

    tray_icon = pystray.Icon("WH3 Mod Manager", image, "WH3 Mod Manager", menu=menu)
    tray_icon.run()

if __name__ == '__main__':
    # 1. Start Flask in a background daemon thread
    server_thread = threading.Thread(target=run_flask, daemon=True)
    server_thread.start()

    # 2. Open browser automatically on start
    Timer(1.5, lambda: webbrowser.open('http://127.0.0.1:5000/')).start()

    # 3. Run the System Tray icon on the main thread (required by OS window managers)
    setup_tray()