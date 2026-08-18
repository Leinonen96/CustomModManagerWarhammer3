"""
Flask application factory.
"""
from pathlib import Path
from flask import Flask, render_template, send_from_directory
from backend.api import (
    config_bp,
    mods_bp,
    presets_bp,
    load_order_bp,
    system_bp,
    register_error_handlers
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent

def create_app() -> Flask:
    template_folder = str(PROJECT_ROOT / "templates")
    static_folder = str(PROJECT_ROOT / "static")

    app = Flask(
        __name__,
        template_folder=template_folder,
        static_folder=static_folder
    )

    # Register blueprints
    app.register_blueprint(config_bp)
    app.register_blueprint(mods_bp)
    app.register_blueprint(presets_bp)
    app.register_blueprint(load_order_bp)
    app.register_blueprint(system_bp)

    # Register error handlers
    register_error_handlers(app)

    # Root web routes
    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/manifest.json')
    def manifest():
        return send_from_directory(app.static_folder, 'manifest.json', mimetype='application/json')

    @app.route('/sw.js')
    def service_worker():
        return send_from_directory(app.static_folder, 'sw.js', mimetype='application/javascript')

    return app
