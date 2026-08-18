"""
Global exception handling middleware for Flask.
"""
import logging
from flask import Flask
from backend.domain.exceptions import ModManagerError, PermissionDeniedError
from backend.api.response import api_error

logger = logging.getLogger(__name__)

def register_error_handlers(app: Flask) -> None:
    """Registers domain and system exception handlers."""
    
    @app.errorhandler(ModManagerError)
    def handle_mod_manager_error(e: ModManagerError):
        logger.warning("Domain error [%s]: %s", e.code, e.message)
        return api_error(
            message=e.message,
            code=e.code,
            status_code=e.status_code,
            details=e.details
        )

    @app.errorhandler(PermissionError)
    def handle_permission_error(e: PermissionError):
        logger.error("Filesystem Permission Error: %s", str(e))
        return api_error(
            message="Permission Denied. On Windows, enable Developer Mode or run as Administrator.",
            code="PERMISSION_DENIED",
            status_code=500,
            details={"error": str(e)}
        )

    @app.errorhandler(404)
    def handle_404(e):
        return api_error(
            message="The requested endpoint or resource was not found.",
            code="NOT_FOUND",
            status_code=404
        )

    @app.errorhandler(500)
    def handle_500(e):
        logger.error("Internal Server Error: %s", str(e), exc_info=True)
        return api_error(
            message="An internal server error occurred.",
            code="INTERNAL_SERVER_ERROR",
            status_code=500
        )
