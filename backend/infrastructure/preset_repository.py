"""
Preset repository for managing mod presets as JSON files.
"""
import json
import os
import re
import tempfile
from pathlib import Path
from typing import List, Dict, Any, Optional

from backend.domain.models import Preset
from backend.domain.exceptions import PresetNotFoundError, PresetError

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
PRESETS_DIR = PROJECT_ROOT / "presets"

class PresetRepository:
    def __init__(self, presets_dir: Optional[Path] = None):
        self.presets_dir = presets_dir or PRESETS_DIR
        self.presets_dir.mkdir(parents=True, exist_ok=True)

    def _sanitize_name(self, name: str) -> str:
        """Sanitizes preset name to prevent directory traversal or invalid characters."""
        clean = re.sub(r'[\\/*?:"<>|]', "", name).strip()
        if not clean:
            raise PresetError("Preset name contains only invalid characters.")
        return clean

    def _get_preset_path(self, name: str) -> Path:
        clean = self._sanitize_name(name)
        return self.presets_dir / f"{clean}.json"

    def list_presets(self) -> List[str]:
        """Returns sorted list of available preset names."""
        presets = []
        if self.presets_dir.exists():
            for f in os.listdir(self.presets_dir):
                if f.lower().endswith('.json'):
                    presets.append(f[:-5])
        presets.sort(key=str.lower)
        return presets

    def load_preset(self, name: str) -> List[Dict[str, Any]]:
        """
        Loads preset data. Handles both legacy array format and object format,
        returning the list of mod entries.
        """
        path = self._get_preset_path(name)
        if not path.exists():
            raise PresetNotFoundError(name)

        try:
            content = path.read_text(encoding="utf-8").strip()
            if not content:
                return []
            data = json.loads(content)
            
            # If stored as full Preset object
            if isinstance(data, dict) and "mods" in data:
                return data["mods"]
            # If stored as legacy list
            if isinstance(data, list):
                return data
            return []
        except Exception:
            return []

    def save_preset(self, name: str, data: Any) -> None:
        """
        Saves preset data safely using an atomic temporary file write.
        """
        path = self._get_preset_path(name)
        
        # Format payload: keep simple array or full object
        payload = data
        
        temp_dir = self.presets_dir
        with tempfile.NamedTemporaryFile("w", dir=temp_dir, delete=False, encoding="utf-8") as tf:
            json.dump(payload, tf, indent=4)
            temp_name = tf.name

        os.replace(temp_name, path)

    def delete_preset(self, name: str) -> bool:
        """Deletes preset file. Returns True if deleted, False if not found."""
        try:
            path = self._get_preset_path(name)
        except PresetError:
            return False

        if path.exists():
            try:
                os.remove(path)
                return True
            except OSError:
                return False
        return False
