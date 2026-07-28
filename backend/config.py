import os
import json

CONFIG_FILE = "config.json"
PRESET_DIR = "./presets"
os.makedirs(PRESET_DIR, exist_ok=True)

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

def save_config(data):
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)