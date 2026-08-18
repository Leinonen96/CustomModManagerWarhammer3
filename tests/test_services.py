"""
Unit tests for Services and REST API layers.
"""
import unittest
import tempfile
from pathlib import Path
from backend.domain.models import AppConfig
from backend.infrastructure.config_store import ConfigStore
from backend.infrastructure.preset_repository import PresetRepository
from backend.infrastructure.workshop_scanner import WorkshopScanner
from backend.services.preset_service import PresetService
from backend.services.config_service import ConfigService
from backend.app import create_app

class TestServicesAndApi(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.base_path = Path(self.temp_dir.name)
        self.config_path = self.base_path / "config.json"
        self.presets_path = self.base_path / "presets"
        self.workshop_path = self.base_path / "workshop"

        self.store = ConfigStore(config_path=self.config_path, presets_path=self.presets_path)
        self.preset_repo = PresetRepository(presets_dir=self.presets_path)
        self.scanner = WorkshopScanner()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_preset_service_validation(self):
        # Create workshop mod 101
        mod_101 = self.workshop_path / "101"
        mod_101.mkdir(parents=True)
        (mod_101 / "active_mod.pack").write_text("dummy", encoding="utf-8")

        # Save config
        self.store.save(AppConfig(workshop_dir=str(self.workshop_path), game_data_dir="", script_file=""))

        # Save preset with mod 101 and deleted mod 999
        preset_service = PresetService(
            preset_repo=self.preset_repo,
            config_store=self.store,
            scanner=self.scanner
        )
        preset_service.save_preset_data("MyPreset", [
            {"id": "101", "name": "active_mod.pack"},
            {"id": "999", "name": "missing_mod.pack"}
        ])

        matched, missing = preset_service.load_preset_with_validation("MyPreset")
        self.assertEqual(len(matched), 2)
        self.assertEqual(missing, ["missing_mod.pack"])

    def test_flask_api_endpoints(self):
        app = create_app()
        app.config['TESTING'] = True
        client = app.test_client()

        # 1. Health endpoint
        res = client.get('/api/health')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.get_json()["success"])

        # 2. Heartbeat endpoint
        res = client.post('/api/heartbeat')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["status"], "alive")

        # 3. Config endpoints
        res = client.get('/api/config')
        self.assertEqual(res.status_code, 200)
        self.assertIn("WORKSHOP_DIR", res.get_json())

        # 4. Presets endpoint
        res = client.get('/api/presets')
        self.assertEqual(res.status_code, 200)
        self.assertIsInstance(res.get_json(), list)

if __name__ == '__main__':
    unittest.main()
