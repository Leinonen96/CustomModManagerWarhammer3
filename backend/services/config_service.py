"""
Config Service managing application configuration and path detection.
"""
from typing import Dict, Any
from backend.domain.models import AppConfig
from backend.domain.exceptions import ConfigValidationError
from backend.infrastructure.config_store import ConfigStore
from backend.infrastructure.path_detector import auto_detect_wh3_paths

class ConfigService:
    def __init__(self, config_store: ConfigStore = None):
        self.config_store = config_store or ConfigStore()

    def get_config(self) -> AppConfig:
        return self.config_store.load()

    def save_config(self, data: Dict[str, Any]) -> AppConfig:
        config = AppConfig.from_dict(data)
        self.config_store.save(config)
        return config

    def validate_paths(self) -> Dict[str, Dict[str, Any]]:
        config = self.get_config()
        return self.config_store.validate_paths(config)

    def auto_detect(self) -> Dict[str, Any]:
        return auto_detect_wh3_paths()
