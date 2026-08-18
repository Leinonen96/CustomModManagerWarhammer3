"""
Unified response format and helpers for REST API.
"""
from typing import Any, Optional, Dict
from flask import jsonify, Response

def api_success(
    data: Any = None,
    message: Optional[str] = None,
    status_code: int = 200,
    **extra
) -> tuple[Response, int]:
    """Builds a standardized successful JSON response."""
    payload: Dict[str, Any] = {
        "status": "success",
        "success": True,
    }
    if message is not None:
        payload["message"] = message
    if data is not None:
        payload["data"] = data
    payload.update(extra)
    return jsonify(payload), status_code

def api_error(
    message: str,
    code: str = "ERROR",
    status_code: int = 400,
    details: Optional[Dict[str, Any]] = None
) -> tuple[Response, int]:
    """Builds a standardized error JSON response."""
    payload = {
        "status": "error",
        "success": False,
        "message": message,
        "error": {
            "code": code,
            "message": message,
            "details": details or {}
        }
    }
    return jsonify(payload), status_code
