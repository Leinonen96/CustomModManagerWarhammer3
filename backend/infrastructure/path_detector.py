"""
Steam and Total War: WARHAMMER III path auto-detection for Windows and Linux.
"""
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional

WH3_APP_ID = "1142710"

def _find_steam_library_folders() -> List[Path]:
    """Finds all configured Steam library folders across the system."""
    potential_roots = []
    
    if sys.platform.startswith('linux'):
        home = Path.home()
        potential_roots.extend([
            home / ".steam/steam",
            home / ".local/share/Steam",
            home / ".var/app/com.valvesoftware.Steam/.local/share/Steam",
            Path("/mnt")
        ])
    elif sys.platform.startswith('win'):
        potential_roots.extend([
            Path(r"C:\Program Files (x86)\Steam"),
            Path(r"C:\Program Files\Steam"),
            Path(r"D:\SteamLibrary"),
            Path(r"E:\SteamLibrary"),
            Path(r"F:\SteamLibrary")
        ])

    library_paths: List[Path] = []

    for root in potential_roots:
        if not root.exists():
            continue
        library_paths.append(root)
        
        # Check libraryfolders.vdf
        vdf_path = root / "steamapps" / "libraryfolders.vdf"
        if vdf_path.exists():
            try:
                content = vdf_path.read_text(encoding='utf-8', errors='ignore')
                # Parse paths inside libraryfolders.vdf
                # "path" "C:\\SteamLibrary" or "path" "/mnt/drive/SteamLibrary"
                found_paths = re.findall(r'"path"\s+"([^"]+)"', content)
                for p in found_paths:
                    cleaned_p = Path(p.replace('\\\\', '\\'))
                    if cleaned_p.exists() and cleaned_p not in library_paths:
                        library_paths.append(cleaned_p)
            except Exception:
                pass

    return library_paths

def auto_detect_wh3_paths() -> Dict[str, str]:
    """
    Attempts to auto-detect the Steam Workshop directory, Game Data directory,
    and user.script.txt path for Total War: WARHAMMER III.
    """
    results = {
        "WORKSHOP_DIR": "",
        "GAME_DATA_DIR": "",
        "SCRIPT_FILE": "",
        "detected": False
    }

    libraries = _find_steam_library_folders()

    # 1. Search for Game Data Dir
    for lib in libraries:
        # Common locations for WH3
        data_dir = lib / "steamapps" / "common" / "Total War WARHAMMER III" / "data"
        if data_dir.exists() and data_dir.is_dir():
            results["GAME_DATA_DIR"] = str(data_dir)
            break

    # 2. Search for Workshop Dir
    for lib in libraries:
        workshop_dir = lib / "steamapps" / "workshop" / "content" / WH3_APP_ID
        if workshop_dir.exists() and workshop_dir.is_dir():
            results["WORKSHOP_DIR"] = str(workshop_dir)
            break

    # 3. Search for user.script.txt
    if sys.platform.startswith('linux'):
        # Check Proton prefix compatdata first
        for lib in libraries:
            compat_script = (
                lib / "steamapps" / "compatdata" / WH3_APP_ID / "pfx" /
                "drive_c" / "users" / "steamuser" / "AppData" / "Roaming" /
                "The Creative Assembly" / "Warhammer3" / "scripts" / "user.script.txt"
            )
            if compat_script.parent.exists():
                results["SCRIPT_FILE"] = str(compat_script)
                break
        
        # If not found yet, check generic Proton paths
        if not results["SCRIPT_FILE"]:
            home = Path.home()
            fallback_proton = (
                home / ".local" / "share" / "Steam" / "steamapps" / "compatdata" /
                WH3_APP_ID / "pfx" / "drive_c" / "users" / "steamuser" / "AppData" /
                "Roaming" / "The Creative Assembly" / "Warhammer3" / "scripts" / "user.script.txt"
            )
            if fallback_proton.parent.exists():
                results["SCRIPT_FILE"] = str(fallback_proton)

    elif sys.platform.startswith('win'):
        appdata = os.environ.get("APPDATA")
        if appdata:
            win_script = Path(appdata) / "The Creative Assembly" / "Warhammer3" / "scripts" / "user.script.txt"
            results["SCRIPT_FILE"] = str(win_script)
        else:
            results["SCRIPT_FILE"] = r"C:\Users\Public\AppData\Roaming\The Creative Assembly\Warhammer3\scripts\user.script.txt"

    if results["WORKSHOP_DIR"] and results["GAME_DATA_DIR"]:
        results["detected"] = True

    return results
