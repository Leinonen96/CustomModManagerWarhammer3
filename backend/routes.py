"""
Legacy routes module for backwards compatibility.
Registers modern modular blueprints under main_routes.
"""
from flask import Blueprint, jsonify, request, render_template, send_from_directory
from backend.api import (
    config_bp,
    mods_bp,
    presets_bp,
    load_order_bp,
    system_bp
)

main_routes = Blueprint('main', __name__)

# Register all modular blueprints
@main_routes.record_once
def register_sub_blueprints(state):
    app = state.app
    app.register_blueprint(config_bp)
    app.register_blueprint(mods_bp)
    app.register_blueprint(presets_bp)
    app.register_blueprint(load_order_bp)
    app.register_blueprint(system_bp)