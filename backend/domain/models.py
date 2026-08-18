"""
Domain models for Total War: WARHAMMER III Mod Manager.
"""
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any
import time

@dataclass
class Mod:
    id: str
    name: str
    real_path: str
    thumb: str
    url: str
    title: str = ""
    file_size_bytes: int = 0
    is_movie_pack: bool = False
    last_modified: float = 0.0

    def __post_init__(self):
        if not self.title:
            # Fallback title cleaned up from pack filename
            self.title = self.name.removesuffix('.pack').replace('_', ' ').strip()
        if not self.url:
            self.url = f"https://steamcommunity.com/sharedfiles/filedetails/?id={self.id}"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict matching existing API schema for backwards compatibility."""
        return {
            "id": self.id,
            "name": self.name,
            "title": self.title,
            "real_path": self.real_path,
            "thumb": self.thumb,
            "url": self.url,
            "file_size_bytes": self.file_size_bytes,
            "is_movie_pack": self.is_movie_pack,
            "last_modified": self.last_modified
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Mod':
        return cls(
            id=str(data.get("id", "")),
            name=data.get("name", ""),
            title=data.get("title", ""),
            real_path=data.get("real_path", ""),
            thumb=data.get("thumb", ""),
            url=data.get("url", ""),
            file_size_bytes=data.get("file_size_bytes", 0),
            is_movie_pack=data.get("is_movie_pack", False),
            last_modified=data.get("last_modified", 0.0)
        )


@dataclass
class AppConfig:
    workshop_dir: str = ""
    game_data_dir: str = ""
    script_file: str = ""
    auto_backup: bool = True
    theme: str = "dark"

    def is_valid(self) -> bool:
        return bool(self.workshop_dir and self.game_data_dir and self.script_file)

    def to_dict(self) -> Dict[str, Any]:
        """Output dictionary supporting both uppercase legacy keys and camelCase/lowercase."""
        return {
            "WORKSHOP_DIR": self.workshop_dir,
            "GAME_DATA_DIR": self.game_data_dir,
            "SCRIPT_FILE": self.script_file,
            "workshop_dir": self.workshop_dir,
            "game_data_dir": self.game_data_dir,
            "script_file": self.script_file,
            "auto_backup": self.auto_backup,
            "theme": self.theme
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AppConfig':
        if not data:
            return cls()
        return cls(
            workshop_dir=data.get("WORKSHOP_DIR") or data.get("workshop_dir", ""),
            game_data_dir=data.get("GAME_DATA_DIR") or data.get("game_data_dir", ""),
            script_file=data.get("SCRIPT_FILE") or data.get("script_file", ""),
            auto_backup=data.get("auto_backup", True),
            theme=data.get("theme", "dark")
        )


@dataclass
class Preset:
    name: str
    mods: List[Dict[str, Any]] = field(default_factory=list)
    description: str = ""
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    missing_mods: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "mods": self.mods,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "missing_mods": self.missing_mods
        }


@dataclass
class LoadOrderResult:
    success: bool
    applied_count: int
    script_path: str
    backup_path: Optional[str] = None
    message: str = ""
    cleaned_count: int = 0
