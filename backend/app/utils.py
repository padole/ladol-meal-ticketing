# Helpers shared by the API routes: who is logged in, access checks, request parsing, dates.
from datetime import date, datetime, time, timezone
from functools import wraps

from flask import abort, request, session

from .extensions import db
from .models import Company, User


# ---- Logged-in user and access-control decorators ----
# (put @login_required / @admin_required / @order_required under a route to protect it)

# The User for this browser session, or None
def current_user():
    uid = session.get("user_id")
    return db.session.get(User, uid) if uid else None


# Any logged-in user
def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not current_user():
            abort(401, "Please log in")
        return fn(*args, **kwargs)
    return wrapper


def admin_required(fn):
    """Logged in AND not a plain Employee (staff may only order meals and see their own profile)."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user:
            abort(401, "Please log in")
        if not user.is_admin:
            abort(403, "You don't have access to this")
        return fn(*args, **kwargs)
    return wrapper


def order_required(fn):
    """Only Administrator / PF Admin may place orders (User.ORDER_ROLES)."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user:
            abort(401, "Please log in")
        if not user.can_order:
            abort(403, "Only an Administrator or PF Admin can place orders")
        return fn(*args, **kwargs)
    return wrapper


# ---- Time ----
def utcnow():
    """Naive UTC datetime (how DateTime columns are stored)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ---- Reading and validating request data (errors become a 400 response with a clear message) ----
def body():
    """JSON request body as a dict (empty dict if missing)."""
    return request.get_json(silent=True) or {}


# Stop with 400 if any of these fields is missing or empty
def require(data, *fields):
    missing = [f for f in fields if data.get(f) in (None, "")]
    if missing:
        abort(400, f"Missing required field(s): {', '.join(missing)}")


# "YYYY-MM-DD" -> date (or the default when empty)
def parse_date(value, default=None):
    if not value:
        return default
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        abort(400, f"Invalid date '{value}', expected YYYY-MM-DD")


# "13:30" / "13:30:00" / "1:30 PM" -> time
def parse_time(value):
    if not value:
        return None
    for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p"):
        try:
            return datetime.strptime(value, fmt).time()
        except ValueError:
            pass
    abort(400, f"Invalid time '{value}', expected HH:MM")


# ---- Formatting / lookups ----

# date -> "12 Oct 2026" (for messages)
def fmt_date(d):
    return d.strftime("%d %b %Y")


# Current local time to the minute (stored on orders)
def now_time():
    n = datetime.now()
    return time(n.hour, n.minute)


# Company by its code, or 400 if it doesn't exist
def company_by_code(code):
    c = Company.query.filter_by(code=code).first()
    if not c:
        abort(400, f"Unknown company '{code}'")
    return c
