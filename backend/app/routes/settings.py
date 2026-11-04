# Settings → General: top-up deadline, wallet limit, email notifications, staff meal prices, serving times.
import re

from flask import Blueprint, abort

from ..extensions import db
from ..models import Setting
from ..utils import admin_required, body, current_user

bp = Blueprint("settings", __name__)

# key -> default value (everything is stored as a string)
# ---- Setting keys and their defaults ----
GENERAL = {"topup_deadline_day": "20", "monthly_wallet_limit": "25000", "email_notifications": "1",
           # what an employee is charged per staff meal, whatever the dish (0 = free, still recorded as an order)
           "staff_price_breakfast": "0", "staff_price_lunch": "220", "staff_price_dinner": "0",
           # when each meal may be served at the counter (HH:MM, server's local time); PF Admins are held to these
           "serve_breakfast_start": "06:00", "serve_breakfast_end": "10:00",
           "serve_lunch_start": "12:00", "serve_lunch_end": "15:00",
           "serve_dinner_start": "18:00", "serve_dinner_end": "21:00"}
WINDOW_KEYS = [k for k in GENERAL if k.startswith("serve_")]


# ---- Read + validate ----

# All general settings with their proper types (stored values override the defaults)
def general():
    stored = {s.key: s.value for s in Setting.query}
    g = {k: stored.get(k, v) for k, v in GENERAL.items()}
    return {"topup_deadline_day": int(g["topup_deadline_day"]), "monthly_wallet_limit": float(g["monthly_wallet_limit"]),
            "email_notifications": g["email_notifications"] == "1",
            "staff_price_breakfast": float(g["staff_price_breakfast"]), "staff_price_lunch": float(g["staff_price_lunch"]),
            "staff_price_dinner": float(g["staff_price_dinner"]),
            **{k: g[k] for k in WINDOW_KEYS}}


def check_windows(values):
    """Each meal's window must be HH:MM, start before end, and the three must not overlap."""
    spans = []
    for meal in ("breakfast", "lunch", "dinner"):
        s, e = values[f"serve_{meal}_start"], values[f"serve_{meal}_end"]
        if not all(re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", v or "") for v in (s, e)):
            abort(400, f"{meal.title()} serving time must be HH:MM")
        if s >= e:
            abort(400, f"{meal.title()} serving time must start before it ends")
        spans.append((s, e, meal))
    spans.sort()
    for (s1, e1, m1), (s2, e2, m2) in zip(spans, spans[1:]):
        if s2 < e1:
            abort(400, f"{m1.title()} and {m2.title()} serving times overlap")


# ---- API ----
@bp.get("/settings")
@admin_required
def get_settings():
    return {"general": general()}


@bp.put("/settings")
@admin_required
def save_settings():
    """Body: {general: {topup_deadline_day, monthly_wallet_limit, email_notifications, staff_price_*, serve_*}}"""
    data = body()
    incoming = data.get("general") or {}
    if "topup_deadline_day" in incoming:
        try:
            day = int(incoming["topup_deadline_day"])
        except (TypeError, ValueError):
            abort(400, "Top-up deadline must be a day between 1 and 31")
        if not 1 <= day <= 31:
            abort(400, "Top-up deadline must be a day between 1 and 31")
        if day != general()["topup_deadline_day"] and not current_user().can_set_topup_deadline:
            abort(403, "Only an Administrator or HR Admin can change the top-up deadline")
        incoming["topup_deadline_day"] = day
    if any(k in incoming for k in WINDOW_KEYS):
        check_windows({**general(), **{k: incoming[k] for k in WINDOW_KEYS if k in incoming}})
    for k, v in (data.get("general") or {}).items():
        if k.startswith("staff_price_"):
            try:
                if float(v) < 0:
                    raise ValueError
            except (TypeError, ValueError):
                abort(400, "Staff meal prices must be 0 or more")
        if k in GENERAL:
            value = ("1" if v else "0") if isinstance(v, bool) else str(v)
            db.session.merge(Setting(key=k, value=value))
    db.session.commit()
    return get_settings()
