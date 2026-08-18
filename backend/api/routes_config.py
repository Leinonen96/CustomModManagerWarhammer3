"""
Configuration endpoints for settings and path auto-detection.
"""
from flask import Blueprint, jsonify, request
from backend.services.config_service import ConfigService
from backend.api.response import api_success, api_error

config_bp = Blueprint('config_api', __name__)
config_service = ConfigService()

@config_bp.route('/api/config', methods=['GET'])
def get_config():
    config = config_service.get_config()
    # Return dict format compatible with frontend
    return jsonify(config.to_dict())

@config_bp.route('/api/config', methods=['POST'])
def save_config():
    data = request.get_json() or {}
    config = config_service.save_config(data)
    return jsonify({"status": "success", "message": "Settings saved successfully!", "config": config.to_dict()})

@config_bp.route('/api/config/validate', methods=['GET'])
def validate_config():
    validation = config_service.validate_paths()
    return api_success(data=validation, message="Paths validated.")

@config_bp.route('/api/config/detect', methods=['POST'])
def detect_paths():
    detected = config_service.auto_detect()
    return api_success(data=detected, message="Steam & Warhammer 3 paths detected.")
