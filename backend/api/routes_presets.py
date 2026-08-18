"""
Preset management endpoints.
"""
from flask import Blueprint, jsonify, request
from backend.services.preset_service import PresetService
from backend.api.response import api_success, api_error

presets_bp = Blueprint('presets_api', __name__)
preset_service = PresetService()

@presets_bp.route('/api/presets', methods=['GET'])
def get_presets():
    return jsonify(preset_service.get_presets_list())

@presets_bp.route('/api/preset/<name>', methods=['GET'])
def load_preset(name: str):
    mods = preset_service.load_preset_data(name)
    return jsonify(mods)

@presets_bp.route('/api/preset/<name>/details', methods=['GET'])
def load_preset_details(name: str):
    mods, missing = preset_service.load_preset_with_validation(name)
    return api_success(data={"name": name, "mods": mods, "missing_mods": missing})

@presets_bp.route('/api/preset/<name>', methods=['POST'])
def save_preset(name: str):
    data = request.get_json()
    if data is None:
        return api_error(message="Missing JSON request body.", code="INVALID_REQUEST", status_code=400)
    
    preset_service.save_preset_data(name, data)
    return jsonify({"status": "success", "message": f"Preset '{name}' saved successfully!"})

@presets_bp.route('/api/preset/<name>', methods=['DELETE'])
def delete_preset(name: str):
    deleted = preset_service.delete_preset_data(name)
    if deleted:
        return jsonify({"status": "success", "message": f"Preset '{name}' deleted successfully!"})
    return jsonify({"status": "error", "message": "Preset not found!"}), 404
