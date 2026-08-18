"""
REST API transport layer for Warhammer 3 Mod Manager.
"""
from backend.api.routes_config import config_bp
from backend.api.routes_mods import mods_bp
from backend.api.routes_presets import presets_bp
from backend.api.routes_load_order import load_order_bp
from backend.api.routes_system import system_bp, get_last_heartbeat, record_heartbeat
from backend.api.middleware import register_error_handlers

__all__ = [
    "config_bp",
    "mods_bp",
    "presets_bp",
    "load_order_bp",
    "system_bp",
    "get_last_heartbeat",
    "record_heartbeat",
    "register_error_handlers"
]
