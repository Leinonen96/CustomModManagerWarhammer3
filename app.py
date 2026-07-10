import os
import json
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# System Configurations
WORKSHOP_DIR = "/mnt/GG/SteamLibrary/steamapps/workshop/content/1142710"
GAME_DATA_DIR = "/mnt/GG/SteamLibrary/steamapps/common/Total War WARHAMMER III/data"
SCRIPT_FILE = "/mnt/GG/SteamLibrary/steamapps/compatdata/1142710/pfx/drive_c/users/steamuser/AppData/Roaming/The Creative Assembly/Warhammer3/scripts/user.script.txt"
PRESET_DIR = "./presets"

os.makedirs(PRESET_DIR, exist_ok=True)

def discover_workshop_mods():
    mods = []
    if not os.path.exists(WORKSHOP_DIR):
        return mods
    
    # Iterate through Steam's numerical workshop ID folders
    for folder in os.listdir(WORKSHOP_DIR):
        folder_path = os.path.join(WORKSHOP_DIR, folder)
        if os.path.isdir(folder_path):
            pack_files = [f for f in os.listdir(folder_path) if f.endswith('.pack')]
            for pack in pack_files:
                pack_path = os.path.join(folder_path, pack)
                
                # Look for matching thumbnail image
                img_name = pack.replace('.pack', '.png')
                img_path = os.path.join(folder_path, img_name)
                if not os.path.exists(img_path):
                    img_name = "thumbnail.png" # Fallback
                
                mods.append({
                    "id": folder,
                    "name": pack,
                    "real_path": pack_path,
                    "thumb": f"/workshop_assets/{folder}/{img_name}",
                    # The folder name is the Steam Workshop ID
                    "url": f"https://steamcommunity.com/sharedfiles/filedetails/?id={folder}"
                })
    return mods

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
        # 1. Safely remove existing symlinks in the game data folder
        for file in os.listdir(GAME_DATA_DIR):
            file_path = os.path.join(GAME_DATA_DIR, file)
            if os.path.islink(file_path) and file.endswith('.pack'):
                os.unlink(file_path)
        
        # 2. Re-link active mods and build the script array
        script_lines = []
        for mod in data:
            target_link = os.path.join(GAME_DATA_DIR, mod['name'])
            
            # If a physical file or broken link is in the way, remove it first
            if os.path.lexists(target_link):
                os.unlink(target_link)
                
            # Create the fresh symlink
            os.symlink(mod['real_path'], target_link)
            script_lines.append(f'mod "{mod["name"]}";')
            
        # 3. Write clean configurations to the Proton prefix
        os.makedirs(os.path.dirname(SCRIPT_FILE), exist_ok=True)
        with open(SCRIPT_FILE, 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join(script_lines) + '\n')
            
        return jsonify({"status": "success", "message": "Load order applied successfully!"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Endpoint to serve workshop images directly to HTML without copying them
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

if __name__ == '__main__':
    app.run(port=5000, debug=True)