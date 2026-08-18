"""
System, heartbeat, and health endpoints.
"""
import os
import threading
import time
from flask import Blueprint, jsonify, current_app
from backend.api.response import api_success

system_bp = Blueprint('system_api', __name__)

# Global heartbeat timestamp
LAST_HEARTBEAT = time.time()
HEARTBEAT_COUNT = 0

def record_heartbeat():
    global LAST_HEARTBEAT, HEARTBEAT_COUNT
    LAST_HEARTBEAT = time.time()
    HEARTBEAT_COUNT += 1

def get_last_heartbeat() -> float:
    return LAST_HEARTBEAT

def get_heartbeat_count() -> int:
    return HEARTBEAT_COUNT

@system_bp.route('/api/heartbeat', methods=['POST'])
def heartbeat():
    record_heartbeat()
    return jsonify({"status": "alive"})

@system_bp.route('/api/health', methods=['GET'])
def health():
    return api_success(data={"status": "healthy", "timestamp": time.time()})

@system_bp.route('/api/shutdown', methods=['POST'])
def shutdown():
    def delayed_exit():
        time.sleep(1.0)
        os._exit(0)
    threading.Thread(target=delayed_exit, daemon=True).start()
    return jsonify({"status": "shutting_down"})
