# All API route groups. Every URL is mounted under /api (e.g. auth.py's /auth/login -> /api/auth/login).
from .auth import bp as auth_bp
from .companies import bp as companies_bp
from .meals import bp as meals_bp
from .orders import bp as orders_bp
from .reports import bp as reports_bp
from .requests import bp as requests_bp
from .settings import bp as settings_bp
from .staff import bp as staff_bp
from .transactions import bp as transactions_bp
from .users import bp as users_bp
from .wallet import bp as wallet_bp

BLUEPRINTS = [auth_bp, companies_bp, staff_bp, meals_bp, orders_bp, transactions_bp,
              requests_bp, wallet_bp, reports_bp, settings_bp, users_bp]


# Called by create_app() in app/__init__.py
def register_blueprints(app):
    for bp in BLUEPRINTS:
        app.register_blueprint(bp, url_prefix="/api")
