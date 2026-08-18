"""
Configuration store for reading, writing, and validating application settings.
"""
import json
import os
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional

from backend.domain.models import AppConfig
from backend.domain.exceptions import ConfigValidationError
from backend.infrastructure.path_detector import auto_detect_wh3_paths

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
CONFIG_FILE = PROJECT_ROOT / "config.json"
PRESETS_DIR = PROJECT_ROOT / "presets"

class ConfigStore:
    def __init__(self, config_path: Optional[Path] = None, presets_path: Optional[Path] = None):
        self.config_path = config_path or CONFIG_FILE
        self.presets_path = presets_path or PRESETS_DIR
        self.presets_path.mkdir(parents=True, exist_ok=True)

    def load(self) -> AppConfig:
        """Loads configuration from JSON or returns default/auto-detected values."""
        if not self.config_path.exists():
            # Try auto-detecting paths first
            detected = auto_detect_wh3_paths()
            config = AppConfig(
                workshop_dir=detected.get("WORKSHOP_DIR", ""),
                game_data_dir=detected.get("GAME_DATA_DIR", ""),
                script_file=detected.get("SCRIPT_FILE", "")
            )
            # If nothing detected, fallback to Windows placeholder defaults
            if not config.workshop_dir:
                config.workshop_dir = "C:/Program Files (x86)/Steam/steamapps/workshop/content/1142710"
            if not config.game_data_dir:
                config.game_data_dir = "C:/Program Files (x86)/Steam/steamapps/common/Total War WARHAMMER III/data"
            if not config.script_file:
                config.script_file = "C:/Users/Public/AppData/Roaming/The Creative Assembly/Warhammer3/scripts/user.script.txt"
            
            self.save(config)
            return config

        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return AppConfig.from_dict(data)
        except Exception as e:
            # If file is corrupted, create fallback
            config = AppConfig()
            return config

    def save(self, config: AppConfig) -> None:
        """Atomically saves configuration to prevent partial writes or corruption."""
        data = {
            "WORKSHOP_DIR": config.workshop_dir,
            "GAME_DATA_DIR": config.game_data_dir,
            "SCRIPT_FILE": config.script_file,
            "auto_backup": config.auto_backup,
            "theme": config.theme
        }
        
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Atomic write via temporary file
        temp_dir = self.config_path.parent
        with tempfile.NamedTemporaryFile("w", dir=temp_dir, delete=False, encoding="utf-8") as tf:
            json.dump(data, tf, indent=4)
            temp_name = tf.name
        
        os.replace(temp_name, self.config_path)

    def validate_paths(self, config: AppConfig) -> Dict[str, Dict[str, Any]]:
        """Validates whether the configured paths exist and are accessible."""
        validation = {
            "workshop_dir": {
                "path": config.workshop_dir,
                "exists": False,
                "is_dir": False,
                "readable": False
            },
            "game_data_dir": {
                "path": config.game_data_dir,
                "exists": False,
                "is_dir": False,
                "writable": False
            },
            "script_file": {
                "path": config.script_file,
                "exists": False,
                "parent_exists": False,
                "writable": False
            }
        }

        if config.workshop_dir:
            w_path = Path(config.workshop_dir)
            validation["workshop_dir"]["exists"] = w_path.exists()
            validation["workshop_dir"]["is_dir"] = w_path.is_dir()
            validation["workshop_dir"]["readable"] = os.access(w_path, os.R_OK) if w_path.exists() else False

        if config.game_data_dir:
            g_path = Path(config.game_data_dir)
            validation["game_data_dir"]["exists"] = g_path.exists()
            validation["game_data_dir"]["is_dir"] = g_path.is_dir()
            validation["game_data_dir"]["writable"] = os.access(g_path, os.W_OK) if g_path.exists() else False

        if config.script_file:
            s_path = Path(config.script_file)
            validation["script_file"]["exists"] = s_path.exists()
            validation["script_file"]["parent_exists"] = s_path.parent.exists()
            if s_path.exists():
                validation["script_file"]["writable"] = os.access(s_path, os.W_OK)
            elif s_path.parent.exists():
                validation["script_file"]["writable"] = os.access(s_path.parent, os.W_OK)

        return validation
