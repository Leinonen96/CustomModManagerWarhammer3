"""
Mod Service orchestrating workshop discovery and mod metadata retrieval.
"""
from typing import List, Optional
from backend.domain.models import Mod
from backend.infrastructure.config_store import ConfigStore
from backend.infrastructure.workshop_scanner import WorkshopScanner

class ModService:
    def __init__(self, config_store: ConfigStore = None, scanner: WorkshopScanner = None):
        self.config_store = config_store or ConfigStore()
        self.scanner = scanner or WorkshopScanner()

    def get_mods(self) -> List[Mod]:
        """Loads configuration and scans the Steam workshop directory for mods."""
        config = self.config_store.load()
        if not config.workshop_dir:
            return []
        return self.scanner.scan_workshop(config.workshop_dir)

    def get_mod_by_id(self, mod_id: str) -> Optional[Mod]:
        mods = self.get_mods()
        for m in mods:
            if m.id == mod_id:
                return m
        return None
