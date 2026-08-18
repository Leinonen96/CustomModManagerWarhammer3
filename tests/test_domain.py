"""
Unit tests for Domain models and exceptions.
"""
import unittest
from backend.domain.models import Mod, AppConfig, Preset, LoadOrderResult
from backend.domain.exceptions import (
    ModManagerError,
    PathNotFoundError,
    PresetNotFoundError,
    PermissionDeniedError
)

class TestDomainModels(unittest.TestCase):
    def test_mod_model(self):
        mod = Mod(
            id="12345",
            name="cool_mod.pack",
            real_path="/path/to/cool_mod.pack",
            thumb="/workshop_assets/12345/cool_mod.png",
            url=""
        )
        self.assertEqual(mod.title, "cool mod")
        self.assertEqual(mod.url, "https://steamcommunity.com/sharedfiles/filedetails/?id=12345")
        
        d = mod.to_dict()
        self.assertEqual(d["id"], "12345")
        self.assertEqual(d["name"], "cool_mod.pack")

        mod_restored = Mod.from_dict(d)
        self.assertEqual(mod_restored.id, "12345")
        self.assertEqual(mod_restored.title, "cool mod")

    def test_app_config_model(self):
        config = AppConfig(
            workshop_dir="/workshop",
            game_data_dir="/data",
            script_file="/scripts/user.script.txt"
        )
        self.assertTrue(config.is_valid())
        
        d = config.to_dict()
        self.assertEqual(d["WORKSHOP_DIR"], "/workshop")
        self.assertEqual(d["GAME_DATA_DIR"], "/data")
        self.assertEqual(d["SCRIPT_FILE"], "/scripts/user.script.txt")

        # Test from legacy dict
        from_dict_config = AppConfig.from_dict({"WORKSHOP_DIR": "/w", "GAME_DATA_DIR": "/g", "SCRIPT_FILE": "/s"})
        self.assertEqual(from_dict_config.workshop_dir, "/w")
        self.assertEqual(from_dict_config.game_data_dir, "/g")
        self.assertEqual(from_dict_config.script_file, "/s")

    def test_domain_exceptions(self):
        err = PathNotFoundError("/invalid/path", "Workshop Directory")
        self.assertEqual(err.code, "PATH_NOT_FOUND")
        self.assertEqual(err.status_code, 404)
        self.assertIn("/invalid/path", err.message)

if __name__ == '__main__':
    unittest.main()
