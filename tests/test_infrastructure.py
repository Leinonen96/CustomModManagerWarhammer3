"""
Unit tests for Infrastructure components.
"""
import unittest
import tempfile
import os
import json
from pathlib import Path
from backend.domain.models import AppConfig
from backend.infrastructure.config_store import ConfigStore
from backend.infrastructure.preset_repository import PresetRepository
from backend.infrastructure.workshop_scanner import WorkshopScanner
from backend.infrastructure.game_integrator import GameIntegrator

class TestInfrastructure(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.base_path = Path(self.temp_dir.name)
        self.config_path = self.base_path / "config.json"
        self.presets_path = self.base_path / "presets"

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_config_store_load_save(self):
        store = ConfigStore(config_path=self.config_path, presets_path=self.presets_path)
        config = AppConfig(workshop_dir="/test/w", game_data_dir="/test/g", script_file="/test/s")
        store.save(config)

        self.assertTrue(self.config_path.exists())
        loaded = store.load()
        self.assertEqual(loaded.workshop_dir, "/test/w")
        self.assertEqual(loaded.game_data_dir, "/test/g")
        self.assertEqual(loaded.script_file, "/test/s")

    def test_preset_repository_crud(self):
        repo = PresetRepository(presets_dir=self.presets_path)
        sample_mods = [{"id": "111", "name": "mod1.pack"}, {"id": "222", "name": "mod2.pack"}]

        # 1. Save
        repo.save_preset("Campaign 1", sample_mods)
        self.assertIn("Campaign 1", repo.list_presets())

        # 2. Load
        loaded = repo.load_preset("Campaign 1")
        self.assertEqual(len(loaded), 2)
        self.assertEqual(loaded[0]["name"], "mod1.pack")

        # 3. Delete
        self.assertTrue(repo.delete_preset("Campaign 1"))
        self.assertNotIn("Campaign 1", repo.list_presets())

    def test_workshop_scanner(self):
        workshop_dir = self.base_path / "workshop"
        mod_101 = workshop_dir / "101"
        mod_101.mkdir(parents=True)
        (mod_101 / "better_camera.pack").write_text("dummy pack", encoding="utf-8")
        (mod_101 / "better_camera.png").write_bytes(b"dummy png")
        (mod_101 / "publish_data.vdf").write_text('"publish_data" { "title" "Better Camera Mod" }', encoding="utf-8")

        scanner = WorkshopScanner()
        mods = scanner.scan_workshop(str(workshop_dir))
        self.assertEqual(len(mods), 1)
        self.assertEqual(mods[0].id, "101")
        self.assertEqual(mods[0].name, "better_camera.pack")
        self.assertEqual(mods[0].title, "Better Camera Mod")
        self.assertEqual(mods[0].thumb, "/workshop_assets/101/better_camera.png")

    def test_game_integrator(self):
        workshop_dir = self.base_path / "workshop"
        mod_folder = workshop_dir / "101"
        mod_folder.mkdir(parents=True)
        pack_file = mod_folder / "test_mod.pack"
        pack_file.write_text("pack content", encoding="utf-8")

        game_data = self.base_path / "game_data"
        game_data.mkdir()
        script_file = self.base_path / "scripts" / "user.script.txt"

        integrator = GameIntegrator()
        mods = [{"id": "101", "name": "test_mod.pack", "real_path": str(pack_file)}]

        result = integrator.apply_load_order(mods, str(game_data), str(script_file), auto_backup=True)
        self.assertTrue(result.success)
        self.assertEqual(result.applied_count, 1)

        # Check symlink
        linked_file = game_data / "test_mod.pack"
        self.assertTrue(linked_file.exists())
        self.assertTrue(linked_file.is_symlink())

        # Check script file
        self.assertTrue(script_file.exists())
        self.assertEqual(script_file.read_text(encoding="utf-8").strip(), 'mod "test_mod.pack";')

if __name__ == '__main__':
    unittest.main()
