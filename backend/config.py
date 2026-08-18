"""
Legacy configuration module for backwards compatibility.
Delegates to ConfigStore in backend.infrastructure.
"""
from pathlib import Path
from backend.domain.models import AppConfig
from backend.infrastructure.config_store import ConfigStore, CONFIG_FILE as _CONFIG_FILE, PRESETS_DIR as _PRESETS_DIR

CONFIG_FILE = str(_CONFIG_FILE)
PRESET_DIR = str(_PRESETS_DIR)

_store = ConfigStore()

DEFAULT_CONFIG = {
    "WORKSHOP_DIR": "C:/Program Files (x86)/Steam/steamapps/workshop/content/1142710",
    "GAME_DATA_DIR": "C:/Program Files (x86)/Steam/steamapps/common/Total War WARHAMMER III/data",
    "SCRIPT_FILE": "C:/Users/Public/AppData/Roaming/The Creative Assembly/Warhammer3/scripts/user.script.txt"
}

def load_config():
    config = _store.load()
    return config.to_dict()

def save_config(data):
    _store.save(AppConfig.from_dict(data))