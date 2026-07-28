from flask import Flask
from backend.routes import main_routes

def create_app():
    # Tell Flask to look one directory up for templates and static files
    app = Flask(__name__, 
                template_folder='../templates',
                static_folder='../static')
    
    app.register_blueprint(main_routes)
    
    return app