"""
Game integrator responsible for managing mod symlinks and user.script.txt generation.
"""
import os
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional

from backend.domain.models import LoadOrderResult
from backend.domain.exceptions import (
    PathNotFoundError,
    PermissionDeniedError,
    GameLinkError
)

class GameIntegrator:
    def __init__(self):
        pass

    def apply_load_order(
        self,
        mods: List[Dict[str, Any]],
        game_data_dir: str,
        script_file: str,
        auto_backup: bool = True
    ) -> LoadOrderResult:
        """
        Applies active mods to the game data directory using symlinks (with hardlink fallback)
        and generates the user.script.txt file.
        """
        if not game_data_dir:
            raise PathNotFoundError(game_data_dir, "Game Data Directory")
        if not script_file:
            raise PathNotFoundError(script_file, "User Script File")

        data_path = Path(game_data_dir)
        if not data_path.exists() or not data_path.is_dir():
            raise PathNotFoundError(game_data_dir, "Game Data Directory")

        script_path = Path(script_file)

        # 1. Clean up existing symlinks in game_data_dir
        cleaned_count = self._cleanup_existing_mod_links(data_path)

        # 2. Create symlinks / hardlinks for active mods
        applied_count = 0
        script_lines = []

        for mod in mods:
            mod_name = mod.get('name')
            real_path = mod.get('real_path')
            
            if not mod_name or not real_path:
                continue

            target_link = data_path / mod_name
            source_file = Path(real_path)

            if not source_file.exists():
                continue

            # Remove any broken/existing link or file at target
            if target_link.is_symlink() or target_link.exists():
                try:
                    target_link.unlink()
                except OSError as e:
                    raise PermissionDeniedError(str(target_link), action="unlink old link") from e

            # Create link
            try:
                os.symlink(str(source_file.resolve()), str(target_link))
            except (OSError, PermissionError) as symlink_err:
                # Fallback to hardlink on systems (like Windows without Dev Mode) where symlink fails
                try:
                    os.link(str(source_file.resolve()), str(target_link))
                except Exception as hardlink_err:
                    raise PermissionDeniedError(str(target_link), action="create link") from symlink_err

            script_lines.append(f'mod "{mod_name}";')
            applied_count += 1

        # 3. Create backup of user.script.txt if it already exists
        backup_path: Optional[str] = None
        if auto_backup and script_path.exists():
            try:
                bak_file = script_path.with_name(script_path.name + ".bak")
                shutil.copy2(script_path, bak_file)
                backup_path = str(bak_file)
            except Exception:
                pass

        # 4. Write new user.script.txt
        try:
            script_path.parent.mkdir(parents=True, exist_ok=True)
            content = '\n'.join(script_lines) + ('\n' if script_lines else '')
            with open(script_path, 'w', encoding='utf-8', newline='\n') as f:
                f.write(content)
        except (PermissionError, OSError) as e:
            raise PermissionDeniedError(str(script_path), action="write script file") from e

        return LoadOrderResult(
            success=True,
            applied_count=applied_count,
            cleaned_count=cleaned_count,
            script_path=str(script_path),
            backup_path=backup_path,
            message=f"Applied {applied_count} mods to game and updated user.script.txt."
        )

    def _cleanup_existing_mod_links(self, data_path: Path) -> int:
        """
        Removes all symlinks in game_data_dir that end in .pack.
        CRITICAL: Never deletes regular files (base game packs)!
        """
        cleaned = 0
        try:
            for entry in os.scandir(data_path):
                if entry.is_symlink() and entry.name.lower().endswith('.pack'):
                    try:
                        os.unlink(entry.path)
                        cleaned += 1
                    except OSError:
                        pass
        except OSError:
            pass
        return cleaned
