"""
Infrastructure package for Warhammer 3 Mod Manager.
"""
from backend.infrastructure.path_detector import auto_detect_wh3_paths
from backend.infrastructure.config_store import ConfigStore
from backend.infrastructure.workshop_scanner import WorkshopScanner
from backend.infrastructure.game_integrator import GameIntegrator
from backend.infrastructure.preset_repository import PresetRepository

__all__ = [
    "auto_detect_wh3_paths",
    "ConfigStore",
    "WorkshopScanner",
    "GameIntegrator",
    "PresetRepository"
]
