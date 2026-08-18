"""
Domain exceptions for Total War: WARHAMMER III Mod Manager.
"""

class ModManagerError(Exception):
    """Base exception for all domain errors."""
    def __init__(self, message: str, code: str = "MOD_MANAGER_ERROR", status_code: int = 400, details: dict = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}


class PathNotFoundError(ModManagerError):
    """Raised when a configured file or directory does not exist."""
    def __init__(self, path: str, path_name: str = "Path"):
        super().__init__(
            message=f"{path_name} does not exist: {path}",
            code="PATH_NOT_FOUND",
            status_code=404,
            details={"path": path, "path_name": path_name}
        )


class ConfigValidationError(ModManagerError):
    """Raised when configuration validation fails."""
    def __init__(self, message: str, details: dict = None):
        super().__init__(
            message=message,
            code="CONFIG_VALIDATION_ERROR",
            status_code=422,
            details=details
        )


class PresetError(ModManagerError):
    """Base exception for preset-related errors."""
    def __init__(self, message: str, code: str = "PRESET_ERROR", status_code: int = 400, details: dict = None):
        super().__init__(message, code=code, status_code=status_code, details=details)


class PresetNotFoundError(PresetError):
    """Raised when a requested preset does not exist."""
    def __init__(self, preset_name: str):
        super().__init__(
            message=f"Preset '{preset_name}' was not found.",
            code="PRESET_NOT_FOUND",
            status_code=404,
            details={"preset_name": preset_name}
        )


class GameLinkError(ModManagerError):
    """Raised when creating symlinks or writing user.script.txt fails."""
    def __init__(self, message: str, code: str = "GAME_LINK_ERROR", details: dict = None):
        super().__init__(
            message=message,
            code=code,
            status_code=500,
            details=details
        )


class PermissionDeniedError(GameLinkError):
    """Raised when filesystem permissions prevent symlink or script creation."""
    def __init__(self, target_path: str, action: str = "write"):
        super().__init__(
            message=(
                f"Permission denied while trying to {action} at '{target_path}'. "
                "On Windows, enable Developer Mode or run as Administrator. "
                "On Linux, check file ownership/write permissions."
            ),
            code="PERMISSION_DENIED",
            details={"target_path": target_path, "action": action}
        )
