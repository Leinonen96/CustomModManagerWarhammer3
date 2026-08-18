"""
Scanner for Steam Workshop mods and local packs.
"""
import os
import re
from pathlib import Path
from typing import List, Optional
from backend.domain.models import Mod

class WorkshopScanner:
    def __init__(self):
        pass

    def scan_workshop(self, workshop_dir: str) -> List[Mod]:
        """
        Discovers all valid .pack mods located in the Steam Workshop content directory.
        """
        mods: List[Mod] = []
        if not workshop_dir or not os.path.exists(workshop_dir):
            return mods

        workshop_path = Path(workshop_dir)
        if not workshop_path.is_dir():
            return mods

        try:
            entries = os.listdir(workshop_path)
        except OSError:
            return mods

        for folder_name in entries:
            folder_path = workshop_path / folder_name
            if not folder_path.is_dir():
                continue

            # Check for publish_data.vdf to find custom Steam title if available
            workshop_title = self._extract_workshop_title(folder_path)

            try:
                files = os.listdir(folder_path)
            except OSError:
                continue

            pack_files = [f for f in files if f.lower().endswith('.pack')]
            for pack in pack_files:
                pack_path = folder_path / pack
                
                # Determine thumbnail
                img_name = self._find_thumbnail_image(files, pack)
                thumb_url = f"/workshop_assets/{folder_name}/{img_name}" if img_name else "/static/gemini-svg.svg"

                # File stats
                file_size = 0
                mtime = 0.0
                try:
                    stats = pack_path.stat()
                    file_size = stats.st_size
                    mtime = stats.st_mtime
                except OSError:
                    pass

                # Derive clean title
                clean_title = workshop_title or pack.removesuffix('.pack').replace('_', ' ').strip()

                mod = Mod(
                    id=folder_name,
                    name=pack,
                    title=clean_title,
                    real_path=str(pack_path.resolve()),
                    thumb=thumb_url,
                    url=f"https://steamcommunity.com/sharedfiles/filedetails/?id={folder_name}",
                    file_size_bytes=file_size,
                    last_modified=mtime
                )
                mods.append(mod)

        # Sort alphabetically by title/name
        mods.sort(key=lambda m: (m.title or m.name).lower())
        return mods

    def _find_thumbnail_image(self, files: List[str], pack_name: str) -> Optional[str]:
        """Finds matching thumbnail image for the pack file."""
        expected_png = pack_name[:-5] + ".png" if pack_name.lower().endswith('.pack') else pack_name + ".png"
        expected_jpg = pack_name[:-5] + ".jpg" if pack_name.lower().endswith('.pack') else pack_name + ".jpg"

        file_set = {f.lower(): f for f in files}

        if expected_png.lower() in file_set:
            return file_set[expected_png.lower()]
        if expected_jpg.lower() in file_set:
            return file_set[expected_jpg.lower()]
        if "thumbnail.png" in file_set:
            return file_set["thumbnail.png"]
        if "thumbnail.jpg" in file_set:
            return file_set["thumbnail.jpg"]
        if "thumb.png" in file_set:
            return file_set["thumb.png"]
        if "thumb.jpg" in file_set:
            return file_set["thumb.jpg"]

        return None

    def _extract_workshop_title(self, folder_path: Path) -> Optional[str]:
        """Attempts to read mod title from publish_data.vdf or metadata if present."""
        vdf_file = folder_path / "publish_data.vdf"
        if vdf_file.exists():
            try:
                content = vdf_file.read_text(encoding='utf-8', errors='ignore')
                match = re.search(r'"title"\s+"([^"]+)"', content, re.IGNORECASE)
                if match:
                    return match.group(1).strip()
            except Exception:
                pass
        return None
