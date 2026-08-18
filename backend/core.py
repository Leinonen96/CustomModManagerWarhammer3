"""
Legacy core module for backwards compatibility.
Delegates to modular services in backend.services.
"""
from typing import List, Dict, Any
from backend.services.mod_service import ModService
from backend.services.load_order_service import LoadOrderService
from backend.services.preset_service import PresetService
from backend.infrastructure.workshop_scanner import WorkshopScanner
from backend.infrastructure.game_integrator import GameIntegrator
from backend.infrastructure.preset_repository import PresetRepository, PRESETS_DIR

PRESET_DIR = str(PRESETS_DIR)

_mod_service = ModService()
_scanner = WorkshopScanner()
_load_order_service = LoadOrderService()
_integrator = GameIntegrator()
_preset_service = PresetService()
_preset_repo = PresetRepository()

def discover_workshop_mods(workshop_dir: str) -> List[Dict[str, Any]]:
    mods = _scanner.scan_workshop(workshop_dir)
    return [m.to_dict() for m in mods]

def apply_load_order_logic(data: List[Dict[str, Any]], game_data_dir: str, script_file: str):
    _integrator.apply_load_order(data, game_data_dir, script_file)

def get_presets_list() -> List[str]:
    return _preset_repo.list_presets()

def load_preset_data(name: str) -> List[Dict[str, Any]]:
    try:
        return _preset_repo.load_preset(name)
    except Exception:
        return []

def save_preset_data(name: str, data: Any):
    _preset_repo.save_preset(name, data)

def delete_preset_data(name: str) -> bool:
    return _preset_repo.delete_preset(name)