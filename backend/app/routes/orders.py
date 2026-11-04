"""Orders: serving staff and contractors on Today's Menu, own order history, and Client Dining orders."""
from datetime import date

from flask import Blueprint, abort, request

from .. import balances, staff_menu
from ..extensions import db
from ..models import Customer, Meal, ServiceRequest, Transaction, User
from ..utils import (body, company_by_code, current_user, fmt_date, login_required, now_time, order_required,
                     parse_date)

bp = Blueprint("orders", __name__)


# ---- Helpers ----
def load_items(data):
    """[{meal_id, quantity}] -> [(Meal, quantity)]"""
    items = data.get("items") or []
    if not items:
        abort(400, "Select at least one meal")
    out = []
    for it in items:
        meal = db.session.get(Meal, it.get("meal_id"))
        if not meal:
            abort(400, f"Meal {it.get('meal_id')} not found")
        if meal.status != "Available":
            abort(400, f"{meal.name} is not available")
        raw = it.get("quantity")
        try:
            qty = 1 if raw is None or raw == "" else int(raw)
        except (TypeError, ValueError):
            abort(400, "Quantity must be a whole number")
        if qty < 1:
            abort(400, "Quantity must be at least 1")
        out.append((meal, qty))
    return out


def employee_by_no(no):
    emp = User.query.filter_by(employee_no=(no or "").strip().upper()).first()
    if not emp:
        abort(404, f"No employee with number '{no}'")
    return emp


def contractor_by_no(no):
    """Client company staff (no login) by their customer ID, e.g. LFZ000000."""
    c = Customer.query.filter_by(customer_no=(no or "").strip().upper()).filter(Customer.user_id.is_(None)).first()
    if not c:
        abort(404, f"No employee or contractor with number '{no}'")
    return c


def contractor_served(c, day):
    """{meal_type: people served} for this contractor on that day."""
    rows = (db.session.query(Transaction.meal_type, db.func.sum(Transaction.quantity))
            .filter(Transaction.customer_id == c.id, Transaction.tx_date == day)
            .group_by(Transaction.meal_type).all())
    return {t: int(q) for t, q in rows}


# ---- Counter lookup: who is at the counter (Administrator / PF Admin) ----
@bp.get("/orders/lookup/<number>")
@order_required
def counter_lookup(number):
    """Today's Menu counter: an employee no. or a contractor's ID. ?date=
    -> {kind: "employee", ...wallet + served} or {kind: "contractor", ...company + people served per meal}"""
    day = parse_date(request.args.get("date"), date.today())
    emp = User.query.filter_by(employee_no=number.strip().upper()).first()
    if emp:
        return {"kind": "employee", "employee_no": emp.employee_no, "full_name": emp.full_name,
                "department": emp.department, "balance": balances.balance(emp),
                "served": staff_menu.served_types(emp, day)}
    c = contractor_by_no(number)
    return {"kind": "contractor", "customer_no": c.customer_no, "name": c.name, "company": c.company.code,
            "company_name": c.company.name, "department": c.department, "eligible": c.eligible,
            "served": contractor_served(c, day)}


# Older employee-only lookup (kept for compatibility; the page now uses /orders/lookup)
@bp.get("/orders/employee/<employee_no>")
@order_required
def employee_at_counter(employee_no):
    """Counter lookup before serving: who they are, wallet balance, meals already served that day. ?date="""
    emp = employee_by_no(employee_no)
    day = parse_date(request.args.get("date"), date.today())
    return {"employee_no": emp.employee_no, "full_name": emp.full_name, "department": emp.department,
            "balance": balances.balance(emp), "served": staff_menu.served_types(emp, day)}


# ---- Serving at the counter (only during the meal's serving time, today only) ----
@bp.post("/orders/staff")
@order_required
def staff_order():
    """Administrator / PF Admin serves an employee from the staff menu.
    Body: {employee_no, items: [{meal_id}], date?}
    Rules: only that day's staff meals; one breakfast, one lunch, one dinner per employee per day;
    the staff price for each meal time (Settings; e.g. lunch ₦220, breakfast/dinner free) comes out of the
    employee's wallet - refused if too low. Free meals are still recorded as the employee's orders (₦0)."""
    data = body()
    emp = employee_by_no(data.get("employee_no"))
    when = parse_date(data.get("date"), date.today())
    ids = [it.get("meal_id") for it in data.get("items") or []]
    if not ids:
        abort(400, "Select at least one meal")
    menu = {m.id: m for m in staff_menu.menu_for(when).values() if m}
    meals = []
    for mid in ids:
        if mid not in menu:
            abort(400, "Only the day's staff breakfast, lunch or dinner can be served to staff")
        meals.append(menu[mid])
    types = [m.meal_type for m in meals]
    if len(set(types)) != len(types):
        abort(400, "One meal per meal time: an order can't contain the same meal twice")
    staff_menu.check_serving_time(current_user(), when, types)

    # lock the employee's row so two counters can't double-serve or overspend at the same moment
    db.session.query(User).filter_by(id=emp.id).with_for_update().one()
    already = set(staff_menu.served_types(emp, when)) & set(types)
    if already:
        abort(400, f"{emp.full_name} has already had {' and '.join(sorted(t.lower() for t in already))} "
                   f"on {fmt_date(when)}.")
    prices = {m.id: staff_menu.staff_price(m.meal_type) for m in meals}
    total = sum(prices.values())
    bal = balances.balance(emp)
    if total > 0 and total > bal:
        abort(400, f"Insufficient wallet balance: {emp.full_name} has ₦{bal:,.0f}, this costs ₦{total:,.0f}. "
                   "They can top up from My Profile.")
    txs = [Transaction(user_id=emp.id, served_by=current_user().id, customer_name=emp.full_name,
                       company_id=emp.company_id, tx_date=when, tx_time=now_time(), meal_id=m.id,
                       meal_type=m.meal_type, item=m.name, quantity=1, unit_price=prices[m.id]) for m in meals]
    db.session.add_all(txs)
    db.session.commit()
    return {"transactions": [t.to_dict() for t in txs], "balance": balances.balance(emp),
            "served": staff_menu.served_types(emp, when)}, 201


@bp.post("/orders/contractor")
@order_required
def contractor_order():
    """Administrator / PF Admin serves contractors from the day's staff menu.
    Body: {customer_no, items: [{meal_id, quantity}], date?}. quantity = number of people (1-500).
    Charged the staff price for each meal time (Settings, e.g. lunch ₦220, breakfast/dinner free) x quantity,
    billed to the contractor's company; no wallet, no daily limit. Free meals are still recorded (₦0)."""
    data = body()
    c = contractor_by_no(data.get("customer_no"))
    if not c.eligible:
        abort(400, f"{c.name} ({c.customer_no}) is not eligible for meals")
    when = parse_date(data.get("date"), date.today())
    menu = {m.id: m for m in staff_menu.menu_for(when).values() if m}
    txs = []
    for it in data.get("items") or []:
        meal = menu.get(it.get("meal_id"))
        if not meal:
            abort(400, "Only the day's breakfast, lunch or dinner can be served at this counter")
        raw = it.get("quantity")
        try:
            qty = 1 if raw is None or raw == "" else int(raw)  # 0 must be refused, not read as "missing"
        except (TypeError, ValueError):
            abort(400, "Quantity must be a whole number")
        if not 1 <= qty <= 500:
            abort(400, "Quantity must be between 1 and 500")
        txs.append(Transaction(customer_id=c.id, customer_name=c.name, company_id=c.company_id,
                               served_by=current_user().id, tx_date=when, tx_time=now_time(), meal_id=meal.id,
                               meal_type=meal.meal_type, item=meal.name, quantity=qty,
                               unit_price=staff_menu.staff_price(meal.meal_type)))
    if not txs:
        abort(400, "Select at least one meal")
    staff_menu.check_serving_time(current_user(), when, [t.meal_type for t in txs])
    db.session.add_all(txs)
    db.session.commit()
    return {"transactions": [t.to_dict() for t in txs], "served": contractor_served(c, when)}, 201


# ---- The logged-in user's own orders (My Profile / My Orders) ----
@bp.get("/orders/mine")
@login_required
def my_orders():
    """The logged-in user's own most recent orders (Profile page)."""
    txs = (Transaction.query.filter_by(user_id=current_user().id)
           .order_by(Transaction.tx_date.desc(), Transaction.id.desc()).limit(20))
    return [t.to_dict() for t in txs]


@bp.get("/orders/mine/all")
@login_required
def my_order_history():
    """Every order of the logged-in user (My Orders page), newest first.
    Filters: ?from=YYYY-MM-DD &to=YYYY-MM-DD &meal_type=Lunch   Paging: ?page=1 &per_page=50"""
    a = request.args
    q = Transaction.query.filter(Transaction.user_id == current_user().id, Transaction.customer_id.is_(None))
    if a.get("from"):
        q = q.filter(Transaction.tx_date >= parse_date(a["from"]))
    if a.get("to"):
        q = q.filter(Transaction.tx_date <= parse_date(a["to"]))
    if a.get("meal_type") in staff_menu.MEAL_TYPES:
        q = q.filter(Transaction.meal_type == a["meal_type"])

    amount = Transaction.quantity * Transaction.unit_price
    by_type = dict(q.with_entities(Transaction.meal_type, db.func.count(Transaction.id)).group_by(Transaction.meal_type).all())
    count, total = q.with_entities(db.func.count(Transaction.id), db.func.coalesce(db.func.sum(amount), 0)).one()

    per_page = min(max(a.get("per_page", 50, type=int), 1), 200)
    pages = max((count + per_page - 1) // per_page, 1)
    page = min(max(a.get("page", 1, type=int), 1), pages)
    rows = (q.order_by(Transaction.tx_date.desc(), Transaction.id.desc())
            .offset((page - 1) * per_page).limit(per_page).all())
    return {
        "orders": [t.to_dict() for t in rows],
        "page": page, "pages": pages, "per_page": per_page,
        "summary": {"count": count, "amount": float(total),
                    "by_meal_type": {t: by_type.get(t, 0) for t in staff_menu.MEAL_TYPES}},
    }


# ---- Client Dining (Administrator / PF Admin) ----
@bp.post("/orders/client")
@order_required
def client_order():
    """Body: {items: [{meal_id, quantity}], company, guests, date?}"""
    data = body()
    items = load_items(data)
    company = company_by_code(data.get("company"))
    guests = max(int(data.get("guests") or 1), 1)
    when = parse_date(data.get("date"), date.today())
    reqs = [ServiceRequest(company=company, requested_by="Walk-in (POS)", meal_type=m.meal_type, meal_id=m.id,
                           guests=guests, service_date=when, status="Completed") for m, _ in items]
    db.session.add_all(reqs)
    db.session.commit()
    return {"requests": [r.to_dict() for r in reqs]}, 201
