"""
Load order application endpoints.
"""
from flask import Blueprint, jsonify, request
from backend.services.load_order_service import LoadOrderService
from backend.api.response import api_success, api_error

load_order_bp = Blueprint('load_order_api', __name__)
load_order_service = LoadOrderService()

@load_order_bp.route('/api/apply', methods=['POST'])
def apply_load_order():
    data = request.get_json()
    if data is None:
        return jsonify({"status": "error", "message": "No mod list provided."}), 400

    result = load_order_service.apply_load_order(data)
    return jsonify({
        "status": "success",
        "message": result.message,
        "applied_count": result.applied_count,
        "backup_path": result.backup_path
    })
