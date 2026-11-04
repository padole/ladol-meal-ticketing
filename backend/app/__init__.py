# Flask application factory: builds the app, connects the database, registers routes and CLI commands.
from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from .config import Config
from .extensions import db


def create_app(config_class=Config):
    # ---- Configuration (from config.py / backend/.env) ----
    app = Flask(__name__)
    app.config.from_object(config_class)
    app.json.sort_keys = False

    # ---- Database + CORS (the React dev server may call the API from another port) ----
    db.init_app(app)
    CORS(app, origins=app.config["CORS_ORIGINS"], supports_credentials=True)

    # ---- API routes (app/routes/*) and `flask` commands (cli.py, staff_import.py) ----
    from . import models  # noqa: F401  (register tables)
    from .cli import register_cli
    from .routes import register_blueprints

    register_blueprints(app)
    register_cli(app)

    # ---- Health check: the API is up and MySQL answers ----
    @app.get("/api/health")
    def health():
        db.session.execute(db.text("SELECT 1"))
        return {"status": "ok"}

    # ---- Error handling ----
    # Always answer API errors as JSON: {"error": "..."}
    @app.errorhandler(HTTPException)
    def http_error(e):
        return jsonify(error=e.description), e.code

    @app.errorhandler(413)
    def too_large(e):
        return jsonify(error="That file is too large (max 5 MB)"), 413

    @app.errorhandler(Exception)
    def server_error(e):
        app.logger.exception(e)
        return jsonify(error=str(e) if app.debug else "Internal server error"), 500

    return app
