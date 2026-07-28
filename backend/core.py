import os
import json
from backend.config import PRESET_DIR

def discover_workshop_mods(workshop_dir):
    mods = []
    if not os.path.exists(workshop_dir):
        return mods
    
    for folder in os.listdir(workshop_dir):
        folder_path = os.path.join(workshop_dir, folder)
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

def apply_load_order_logic(data, game_data_dir, script_file):
    for file in os.listdir(game_data_dir):
        file_path = os.path.join(game_data_dir, file)
        if os.path.islink(file_path) and file.endswith('.pack'):
            os.unlink(file_path)
    
    script_lines = []
    for mod in data:
        target_link = os.path.join(game_data_dir, mod['name'])
        
        if os.path.lexists(target_link):
            os.unlink(target_link)
            
        os.symlink(mod['real_path'], target_link)
        script_lines.append(f'mod "{mod["name"]}";')
        
    os.makedirs(os.path.dirname(script_file), exist_ok=True)
    with open(script_file, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(script_lines) + '\n')
        
def get_presets_list():
    presets = []
    if os.path.exists(PRESET_DIR):
        for f in os.listdir(PRESET_DIR):
            if f.endswith('.json'):
                presets.append(f.replace('.json', ''))
    return presets

def load_preset_data(name):
    path = os.path.join(PRESET_DIR, f"{name}.json")
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_preset_data(name, data):
    path = os.path.join(PRESET_DIR, f"{name}.json")
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)

def delete_preset_data(name):
    path = os.path.join(PRESET_DIR, f"{name}.json")
    if os.path.exists(path):
        os.remove(path)
        return True
    return False