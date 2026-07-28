from flask import Blueprint, jsonify, request, render_template, send_from_directory
import os

from backend.config import load_config, save_config
from backend.core import (
    discover_workshop_mods, apply_load_order_logic, 
    get_presets_list, load_preset_data, save_preset_data, delete_preset_data
)

main_routes = Blueprint('main', __name__)

def get_current_paths():
    config = load_config()
    return config.get("WORKSHOP_DIR", ""), config.get("GAME_DATA_DIR", ""), config.get("SCRIPT_FILE", "")

@main_routes.route('/')
def index():
    return render_template('index.html')

@main_routes.route('/api/config', methods=['GET'])
def get_config_api():
    return jsonify(load_config())

@main_routes.route('/api/config', methods=['POST'])
def save_config_api():
    save_config(request.json)
    return jsonify({"status": "success", "message": "Settings saved successfully!"})

@main_routes.route('/api/mods', methods=['GET'])
def get_mods():
    workshop_dir, _, _ = get_current_paths()
    return jsonify(discover_workshop_mods(workshop_dir))

@main_routes.route('/api/apply', methods=['POST'])
def apply_load_order():
    data = request.json
    _, game_data_dir, script_file = get_current_paths()
    
    try:
        apply_load_order_logic(data, game_data_dir, script_file)
        return jsonify({"status": "success", "message": "Load order applied successfully!"})
    except PermissionError:
        return jsonify({
            "status": "error", 
            "message": "Permission Denied. If you are on Windows, run as Admin or enable Developer Mode."
        }), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@main_routes.route('/workshop_assets/<folder>/<filename>')
def serve_workshop_asset(folder, filename):
    workshop_dir, _, _ = get_current_paths()
    return send_from_directory(os.path.join(workshop_dir, folder), filename)

@main_routes.route('/api/presets', methods=['GET'])
def get_presets():
    return jsonify(get_presets_list())

@main_routes.route('/api/preset/<name>', methods=['GET'])
def load_preset(name):
    return jsonify(load_preset_data(name))

@main_routes.route('/api/preset/<name>', methods=['POST'])
def save_preset(name):
    save_preset_data(name, request.json)
    return jsonify({"status": "success", "message": f"Preset '{name}' saved successfully!"})

@main_routes.route('/api/preset/<name>', methods=['DELETE'])
def delete_preset(name):
    if delete_preset_data(name):
        return jsonify({"status": "success", "message": f"Preset '{name}' deleted successfully!"})
    return jsonify({"status": "error", "message": "Preset not found!"}), 404