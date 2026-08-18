"""
Preset Service managing preset lifecycle and validation against installed mods.
"""
from typing import List, Dict, Any, Tuple
from backend.domain.models import Mod
from backend.domain.exceptions import PresetNotFoundError, PresetError
from backend.infrastructure.preset_repository import PresetRepository
from backend.infrastructure.workshop_scanner import WorkshopScanner
from backend.infrastructure.config_store import ConfigStore

class PresetService:
    def __init__(
        self,
        preset_repo: PresetRepository = None,
        config_store: ConfigStore = None,
        scanner: WorkshopScanner = None
    ):
        self.preset_repo = preset_repo or PresetRepository()
        self.config_store = config_store or ConfigStore()
        self.scanner = scanner or WorkshopScanner()

    def get_presets_list(self) -> List[str]:
        return self.preset_repo.list_presets()

    def load_preset_data(self, name: str) -> List[Dict[str, Any]]:
        return self.preset_repo.load_preset(name)

    def load_preset_with_validation(self, name: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Loads preset and checks for any mods that are in the preset but no longer installed.
        Returns (active_mods, missing_mod_names).
        """
        preset_mods = self.preset_repo.load_preset(name)
        
        config = self.config_store.load()
        available_mods = self.scanner.scan_workshop(config.workshop_dir) if config.workshop_dir else []
        available_ids = {m.id for m in available_mods}
        available_map = {m.id: m.to_dict() for m in available_mods}

        matched_mods: List[Dict[str, Any]] = []
        missing_mods: List[str] = []

        for p_mod in preset_mods:
            mod_id = str(p_mod.get("id", ""))
            if mod_id in available_map:
                # Use updated real path and thumbnail
                matched_mods.append(available_map[mod_id])
            else:
                missing_mods.append(p_mod.get("name", mod_id))
                # Keep original entry so the user sees it or can choose to remove it
                matched_mods.append(p_mod)

        return matched_mods, missing_mods

    def save_preset_data(self, name: str, data: Any) -> None:
        self.preset_repo.save_preset(name, data)

    def delete_preset_data(self, name: str) -> bool:
        return self.preset_repo.delete_preset(name)
