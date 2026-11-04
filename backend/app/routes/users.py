"""Settings → Staff Roles & Permissions: an Administrator gives employees a role (and with it their rights)."""
from functools import wraps

from flask import Blueprint, abort, current_app, request

from ..extensions import db
from ..models import Role, User
from ..utils import body, current_user, utcnow

bp = Blueprint("users", __name__)

# ---- Access check + helpers ----
ADMIN_ROLE = "Administrator"


def administrator_required(fn):
    """Only an Administrator may view staff accounts and change roles."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user:
            abort(401, "Please log in")
        if user.role != ADMIN_ROLE:
            abort(403, "Only an Administrator can manage staff roles")
        return fn(*args, **kwargs)
    return wrapper


def role_names():
    names = [r.name for r in Role.query.order_by(Role.id) if r.name != User.STAFF_ROLE]
    return names + [User.STAFF_ROLE]  # plain Employee always last


def account(u):
    d = u.to_dict()
    d["has_password"] = bool(u.password_hash)
    d["locked"] = bool(u.locked_until and u.locked_until > utcnow())
    return d


# ---- Staff accounts list (search, role filter, paging) ----
@bp.get("/users")
@administrator_required
def list_users():
    """?q=name or employee no. &role=… &page=1 (25 per page)"""
    a = request.args
    q = User.query
    if a.get("q"):
        term = f"%{a['q'].strip()}%"
        q = q.filter(db.or_(User.full_name.ilike(term), User.employee_no.ilike(term)))
    if a.get("role"):
        q = q.filter(User.role == a["role"])
    per_page = 25
    total = q.count()
    pages = max((total + per_page - 1) // per_page, 1)
    page = min(max(a.get("page", 1, type=int), 1), pages)
    # admins first, then by employee no.
    rows = (q.order_by(db.case((User.role == User.STAFF_ROLE, 1), else_=0), User.employee_no)
            .offset((page - 1) * per_page).limit(per_page).all())
    counts = dict(db.session.query(User.role, db.func.count(User.id)).group_by(User.role).all())
    return {"users": [account(u) for u in rows], "page": page, "pages": pages, "total": total,
            "roles": role_names(), "role_counts": counts}


# ---- Actions: reset password, change role ----
@bp.post("/users/<int:user_id>/reset-password")
@administrator_required
def reset_password(user_id):
    """Clear the password (and any lockout). At next login the staff member creates a new one, confirming their surname."""
    me = current_user()
    target = db.get_or_404(User, user_id)
    if target.id == me.id:
        abort(400, "Use Change Password on My Profile to change your own password")
    target.password_hash = None
    target.failed_logins, target.locked_until = 0, None
    db.session.commit()
    current_app.logger.info("Password reset: %s (%s) by %s", target.full_name, target.employee_no, me.employee_no)
    return account(target)


@bp.patch("/users/<int:user_id>/role")
@administrator_required
def set_role(user_id):
    """Body: {role}. Can't change your own role, and the last Administrator can't be removed."""
    role = (body().get("role") or "").strip()
    if role not in role_names():
        abort(400, f"Unknown role '{role}'")
    me = current_user()
    target = db.get_or_404(User, user_id)
    if target.id == me.id:
        abort(400, "You can't change your own role. Ask another Administrator.")
    if target.role == ADMIN_ROLE and role != ADMIN_ROLE and User.query.filter_by(role=ADMIN_ROLE).count() <= 1:
        abort(400, "There must always be at least one Administrator")
    old, target.role = target.role, role
    db.session.commit()
    current_app.logger.info("Role change: %s (%s) %s -> %s by %s", target.full_name, target.employee_no, old, role,
                            me.employee_no)
    return account(target)
