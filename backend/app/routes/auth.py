"""Staff log in with their employee no. + password.
First login: the account has no password yet, so the staff member creates one (POST /auth/setup-password).
After LOGIN_MAX_ATTEMPTS wrong passwords in a row the account is locked for LOGIN_LOCK_MINUTES."""
import math
from datetime import timedelta

from flask import Blueprint, abort, current_app, session

from ..extensions import db
from ..models import User
from ..utils import body, current_user, login_required, require, utcnow

bp = Blueprint("auth", __name__)

# ---- Helpers ----
MIN_PASSWORD = 8


def find_staff(data):
    require(data, "employee_no")
    return User.query.filter_by(employee_no=data["employee_no"].strip().upper()).first()


def check_new_password(pw):
    if len(pw or "") < MIN_PASSWORD:
        abort(400, f"Password must be at least {MIN_PASSWORD} characters")


def check_not_locked(user):
    if user.locked_until and user.locked_until > utcnow():
        mins = math.ceil((user.locked_until - utcnow()).total_seconds() / 60)
        abort(429, f"Too many failed attempts. Try again in {mins} minute{'s' if mins != 1 else ''}.")


def same_name(a, b):
    return " ".join((a or "").split()).casefold() == " ".join((b or "").split()).casefold()


def record_failed_login(user, what="password"):
    cfg = current_app.config
    user.failed_logins = (user.failed_logins or 0) + 1
    if user.failed_logins >= cfg["LOGIN_MAX_ATTEMPTS"]:
        user.failed_logins = 0
        user.locked_until = utcnow() + timedelta(minutes=cfg["LOGIN_LOCK_MINUTES"])
        db.session.commit()
        abort(429, f"Too many failed attempts. Login is locked for {cfg['LOGIN_LOCK_MINUTES']} minutes.")
    db.session.commit()
    left = cfg["LOGIN_MAX_ATTEMPTS"] - user.failed_logins
    abort(401, f"Incorrect {what}. {left} attempt{'s' if left != 1 else ''} left before a "
               f"{cfg['LOGIN_LOCK_MINUTES']}-minute lockout.")


def start_session(user):
    session.clear()
    session["user_id"] = user.id
    return user.to_dict()


# ---- Login screen: step 1 (lookup), first login (setup-password), normal login ----
@bp.post("/auth/lookup")
def lookup():
    """Step 1 of the login screen: {employee_no} -> {needs_password} (true on first login)."""
    user = find_staff(body())
    if not user:
        abort(404, "Employee number not found. Contact HR or the canteen admin.")
    return {"needs_password": not user.password_hash}


@bp.post("/auth/setup-password")
def setup_password():
    """First login only: {employee_no, surname, password} -> sets the password and logs in.
    The surname must match the HR record; wrong surnames count toward the lockout like wrong passwords."""
    data = body()
    require(data, "surname", "password")
    user = find_staff(data)
    if not user:
        abort(404, "Employee number not found")
    if user.password_hash:
        abort(409, "A password has already been created for this employee number. Log in with it instead.")
    check_not_locked(user)
    check_new_password(data["password"])
    if not user.last_name or not same_name(data["surname"], user.last_name):
        record_failed_login(user, "surname")
    user.failed_logins, user.locked_until = 0, None
    user.set_password(data["password"])
    db.session.commit()
    return start_session(user)


@bp.post("/auth/login")
def login():
    data = body()
    require(data, "password")
    user = find_staff(data)
    if not user or not user.password_hash:
        abort(401, "Invalid employee number or password")
    check_not_locked(user)  # even the right password is refused while locked
    if not user.check_password(data["password"]):
        record_failed_login(user)
    user.failed_logins, user.locked_until = 0, None
    db.session.commit()
    return start_session(user)


# ---- Session ----
@bp.post("/auth/logout")
def logout():
    session.clear()
    return {"ok": True}


@bp.get("/auth/me")
@login_required
def me():
    return current_user().to_dict()


# ---- My Profile → Change Password ----
@bp.post("/auth/change-password")
@login_required
def change_password():
    data = body()
    require(data, "current_password", "new_password")
    user = current_user()
    if not user.check_password(data["current_password"]):
        abort(400, "Current password is incorrect")
    check_new_password(data["new_password"])
    user.set_password(data["new_password"])
    db.session.commit()
    return {"ok": True}
