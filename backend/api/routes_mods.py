"""
Mod discovery and workshop asset endpoints.
"""
import os
from pathlib import Path
from flask import Blueprint, jsonify, send_from_directory, current_app, Response
from backend.services.mod_service import ModService
from backend.services.config_service import ConfigService
from backend.api.response import api_success, api_error

mods_bp = Blueprint('mods_api', __name__)
mod_service = ModService()
config_service = ConfigService()

@mods_bp.route('/api/mods', methods=['GET'])
def get_mods():
    mods = mod_service.get_mods()
    # Output list of mod dicts for backwards compatibility
    return jsonify([m.to_dict() for m in mods])

@mods_bp.route('/api/mods/<mod_id>', methods=['GET'])
def get_mod(mod_id):
    mod = mod_service.get_mod_by_id(mod_id)
    if not mod:
        return api_error(message=f"Mod with ID '{mod_id}' not found.", code="MOD_NOT_FOUND", status_code=404)
    return api_success(data=mod.to_dict())

@mods_bp.route('/workshop_assets/<folder>/<filename>')
def serve_workshop_asset(folder: str, filename: str):
    config = config_service.get_config()
    if not config.workshop_dir:
        return send_from_directory(current_app.static_folder, 'gemini-svg.svg')

    target_dir = Path(config.workshop_dir) / folder
    target_file = target_dir / filename

    if not target_file.exists() or not target_file.is_file():
        # Fallback to default thumbnail
        return send_from_directory(current_app.static_folder, 'gemini-svg.svg')

    return send_from_directory(str(target_dir), filename)
