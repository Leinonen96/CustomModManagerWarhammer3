"""
Load Order Service for applying mod order to Warhammer 3 game data.
"""
from typing import List, Dict, Any
from backend.domain.models import LoadOrderResult
from backend.domain.exceptions import PathNotFoundError
from backend.infrastructure.config_store import ConfigStore
from backend.infrastructure.game_integrator import GameIntegrator

class LoadOrderService:
    def __init__(self, config_store: ConfigStore = None, integrator: GameIntegrator = None):
        self.config_store = config_store or ConfigStore()
        self.integrator = integrator or GameIntegrator()

    def apply_load_order(self, mods: List[Dict[str, Any]]) -> LoadOrderResult:
        config = self.config_store.load()
        if not config.game_data_dir:
            raise PathNotFoundError(config.game_data_dir, "Game Data Directory")
        if not config.script_file:
            raise PathNotFoundError(config.script_file, "User Script File")

        return self.integrator.apply_load_order(
            mods=mods,
            game_data_dir=config.game_data_dir,
            script_file=config.script_file,
            auto_backup=config.auto_backup
        )
