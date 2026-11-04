# Menu Management (meals + photos) and the staff menu shown on Today's Menu.
from datetime import date

from flask import Blueprint, abort, request, send_from_directory

from ..extensions import db
from ..models import Meal
from .. import meal_images, staff_menu
from ..utils import admin_required, body, current_user, login_required, parse_date, parse_time, require

bp = Blueprint("meals", __name__)

# Meal fields that can be set directly from the request body
FIELDS = ("name", "description", "meal_type", "package", "location", "status", "emoji", "contractor", "for_staff")


# ---- Helper: copy request fields onto a meal, validating price/date/time and the one-staff-meal rule ----
def apply(meal, data):
    for f in FIELDS:
        if f in data:
            setattr(meal, f, data[f])
    if "price" in data:
        try:
            meal.price = float(data["price"] or 0)
        except (TypeError, ValueError):
            abort(400, "Price must be a number")
    if "menu_date" in data:
        meal.menu_date = parse_date(data["menu_date"])
    if "serve_time" in data:
        meal.serve_time = parse_time(data["serve_time"])
    meal.for_staff = bool(meal.for_staff)
    staff_menu.check_one_per_slot(meal)


# ---- Today's Menu (everyone logged in) ----
@bp.get("/meals/staff-menu")
@login_required
def get_staff_menu():
    """?date=YYYY-MM-DD (default today) -> the day's staff breakfast/lunch/dinner, and which ones
    the logged-in user has already been served. Employees see this as "Today's Menu"."""
    day = parse_date(request.args.get("date"), date.today())
    user = current_user()
    meals = []
    for m in staff_menu.menu_for(day).values():
        if m:
            d = m.to_dict()
            if user.is_admin:
                d["price"] = staff_menu.staff_price(m.meal_type)  # what an employee / contractor is charged per meal
            else:
                d.pop("price")  # employees don't see prices on the menu
            meals.append(d)
    out = {"date": day.isoformat(), "meals": meals, "served": staff_menu.served_types(user, day)}
    if user.can_order:
        out.update(windows=staff_menu.windows(), serving_now=staff_menu.serving_now(),
                   server_today=staff_menu.local_now().date().isoformat())
    return out


# ---- Menu Management (admins): list, read, create, edit, delete ----
@bp.get("/meals")
@admin_required
def list_meals():
    """Filters: ?status=Available &meal_type=Lunch &date=YYYY-MM-DD &q=rice &for_staff=0|1"""
    q = Meal.query
    a = request.args
    if a.get("for_staff") in ("0", "1"):
        q = q.filter(Meal.for_staff.is_(a["for_staff"] == "1"))
    if a.get("status"):
        q = q.filter(Meal.status == a["status"])
    if a.get("meal_type") and a["meal_type"] != "All":
        q = q.filter(Meal.meal_type == a["meal_type"])
    if a.get("date"):
        q = q.filter(db.or_(Meal.menu_date.is_(None), Meal.menu_date == parse_date(a["date"])))
    if a.get("q"):
        q = q.filter(Meal.name.ilike(f"%{a['q']}%"))
    rows = []
    for m in q.order_by(Meal.serve_time, Meal.id):
        d = m.to_dict()
        if m.for_staff:
            d["staff_price"] = staff_menu.staff_price(m.meal_type)
        rows.append(d)
    return rows


@bp.get("/meals/<int:meal_id>")
@admin_required
def get_meal(meal_id):
    return db.get_or_404(Meal, meal_id).to_dict()


@bp.post("/meals")
@admin_required
def create_meal():
    data = body()
    require(data, "name", "meal_type", "location")
    meal = Meal()
    apply(meal, data)
    db.session.add(meal)
    db.session.commit()
    return meal.to_dict(), 201


@bp.put("/meals/<int:meal_id>")
@admin_required
def update_meal(meal_id):
    meal = db.get_or_404(Meal, meal_id)
    apply(meal, body())
    db.session.commit()
    return meal.to_dict()


@bp.delete("/meals/<int:meal_id>")
@admin_required
def delete_meal(meal_id):
    meal = db.get_or_404(Meal, meal_id)
    image = meal.image
    db.session.delete(meal)
    db.session.commit()
    meal_images.delete(image)
    return {"ok": True}


# ---- Meal photos: upload, remove, and serve the file ----
@bp.post("/meals/<int:meal_id>/image")
@admin_required
def upload_image(meal_id):
    """multipart/form-data with field "image" (JPG/PNG/WebP, max 5 MB). Replaces any existing image."""
    meal = db.get_or_404(Meal, meal_id)
    old, meal.image = meal.image, meal_images.save(request.files.get("image"))
    db.session.commit()
    meal_images.delete(old)
    return meal.to_dict()


@bp.delete("/meals/<int:meal_id>/image")
@admin_required
def remove_image(meal_id):
    meal = db.get_or_404(Meal, meal_id)
    old, meal.image = meal.image, None
    db.session.commit()
    meal_images.delete(old)
    return meal.to_dict()


@bp.get("/uploads/meals/<path:name>")
@login_required
def meal_image(name):
    return send_from_directory(meal_images.folder(), name, max_age=86400)
