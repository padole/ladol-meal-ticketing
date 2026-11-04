"""Staff menu: exactly one breakfast, one lunch and one dinner per day.

A staff meal with no menu_date is the everyday default for its meal type; one dated for a specific day
replaces the default on that day. Each employee may be served each meal type once per day.
"""
from datetime import datetime

from flask import abort

from .extensions import db
from .models import Meal, Transaction
from .utils import fmt_date

# Meal times, in the order they're shown
MEAL_TYPES = ("Breakfast", "Lunch", "Dinner")


# ---- Today's staff menu ----
def menu_for(day):
    """{meal_type: Meal or None} for the given date."""
    meals = (Meal.query.filter(Meal.for_staff.is_(True), Meal.status == "Available",
                               db.or_(Meal.menu_date.is_(None), Meal.menu_date == day)).all())
    menu = {}
    for t in MEAL_TYPES:
        of_type = [m for m in meals if m.meal_type == t]
        # a meal dated for this day wins over the everyday default
        menu[t] = next((m for m in of_type if m.menu_date == day), None) or next(iter(of_type), None)
    return menu


# ---- Prices + serving windows (from Settings) ----
def staff_price(meal_type):
    """Employee price for a staff meal, set per meal time in Settings (the dish's own price is for clients)."""
    from .routes.settings import general
    return general()[f"staff_price_{meal_type.lower()}"]


def local_now():
    """Server's local clock (patched in tests)."""
    return datetime.now()


def windows():
    """{meal_type: ("HH:MM", "HH:MM")} serving windows from Settings."""
    from .routes.settings import general
    g = general()
    return {t: (g[f"serve_{t.lower()}_start"], g[f"serve_{t.lower()}_end"]) for t in MEAL_TYPES}


def serving_now(now=None):
    """The meal time whose window is open right now, or None."""
    hhmm = (now or local_now()).strftime("%H:%M")
    return next((t for t, (s, e) in windows().items() if s <= hhmm < e), None)


# ---- Rules enforced when serving ----
def check_serving_time(user, day, meal_types):
    """Everyone serving (Administrator and PF Admin) may only serve today's meal for the current meal time."""
    now = local_now()
    if day != now.date():
        abort(400, "Meals can only be served for today.")
    current = serving_now(now)
    w = windows()
    for t in sorted(set(meal_types)):
        if t != current:
            s, e = w[t]
            now_txt = f"It's {current.lower()} time now" if current else "No meal is being served right now"
            abort(400, f"{t} can only be served between {s} and {e}. {now_txt}.")


def served_types(user, day):
    """Meal types this employee has already been served on that day."""
    rows = (db.session.query(Transaction.meal_type)
            .filter(Transaction.user_id == user.id, Transaction.customer_id.is_(None), Transaction.tx_date == day)
            .distinct().all())
    return [r[0] for r in rows]


# ---- Rule enforced in Menu Management when saving a staff meal ----
def check_one_per_slot(meal):
    """Refuse a second active staff meal for the same meal type and date (or a second everyday default)."""
    if not meal.for_staff or meal.status == "Unavailable":
        return
    clash = Meal.query.filter(Meal.for_staff.is_(True), Meal.status != "Unavailable", Meal.meal_type == meal.meal_type,
                              Meal.menu_date.is_(None) if meal.menu_date is None else Meal.menu_date == meal.menu_date)
    if meal.id:
        clash = clash.filter(Meal.id != meal.id)
    other = clash.first()
    if other:
        when = "every day" if meal.menu_date is None else fmt_date(meal.menu_date)
        abort(409, f"Staff {meal.meal_type.lower()} for {when} is already '{other.name}'. "
                   "Staff get one meal per meal time: edit that meal, or mark it Unavailable first.")
