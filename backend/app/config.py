# Settings read from backend/.env (copy .env.example to start).
import os
from urllib.parse import quote_plus

from dotenv import load_dotenv

# Load backend/.env into the environment
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


# MySQL connection URL built from the MYSQL_* variables
def _mysql_url():
    user = os.getenv("MYSQL_USER", "root")
    password = quote_plus(os.getenv("MYSQL_PASSWORD", ""))
    host = os.getenv("MYSQL_HOST", "127.0.0.1")
    port = os.getenv("MYSQL_PORT", "3306")
    name = os.getenv("MYSQL_DATABASE", "ladol_meal_ticketing")
    return f"mysql+pymysql://{user}:{password}@{host}:{port}/{name}?charset=utf8mb4"


# Everything Flask reads with app.config[...]
class Config:
    # ---- Server + database ----
    DEBUG = os.getenv("FLASK_DEBUG", "0") == "1"
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL") or _mysql_url()
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 280}
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_COOKIE_SAMESITE = "Lax"
    # ---- Frontend address allowed to call the API ----
    CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
    # ---- First Administrator account (created by `flask --app run seed`) ----
    ADMIN_EMPLOYEE_NO = os.getenv("ADMIN_EMPLOYEE_NO", "ADMIN").strip().upper()
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
    # ---- Uploads ----
    # meal photos are saved here (not in the database); served at /api/uploads/meals/<file>
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER") or os.path.join(os.path.dirname(__file__), "..", "uploads")
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # largest upload Flask accepts (5 MB)
    # ---- Login lockout ----
    LOGIN_MAX_ATTEMPTS = int(os.getenv("LOGIN_MAX_ATTEMPTS", "3"))  # wrong passwords before a lockout
    LOGIN_LOCK_MINUTES = int(os.getenv("LOGIN_LOCK_MINUTES", "5"))
