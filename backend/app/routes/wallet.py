import calendar
from datetime import date, timedelta

from flask import Blueprint, abort, request

from .. import balances, staff_menu
from ..extensions import db
from ..models import Department, WalletTopup
from ..utils import admin_required, body, current_user, login_required, require
from .settings import general

bp = Blueprint("wallet", __name__)


# ---- Helpers ----
def parse_amount(value):
    try:
        amount = round(float(value), 2)
    except (TypeError, ValueError):
        abort(400, "Amount must be a number")
    if amount <= 0:
        abort(400, "Amount must be greater than zero")
    return amount


def department_named(name):
    dept = Department.query.filter_by(name=name).first()
    if not dept:
        dept = Department(name=name)
        db.session.add(dept)
    return dept


def topup_window():
    """(open?, deadline day this month). Staff can top up from the 1st until the deadline day of each month (Settings);
    in months shorter than that day (e.g. 31 in February) top-ups close on the month's last day."""
    now = staff_menu.local_now()
    deadline = min(general()["topup_deadline_day"], calendar.monthrange(now.year, now.month)[1])
    return now.day <= deadline, deadline


def ordinal(n):
    return f"{n}{'th' if 11 <= n % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


# ---- Staff: own wallet (My Profile) ----
@bp.get("/wallet/me")
@login_required
def my_wallet():
    user = current_user()
    recent = (WalletTopup.query.filter_by(staff_no=user.employee_no)
              .order_by(WalletTopup.topup_date.desc(), WalletTopup.id.desc()).limit(10).all())
    open_, deadline = topup_window()
    return {
        "balance": balances.balance(user),
        "history": [t.to_dict() for t in recent],
        "monthly_limit": general()["monthly_wallet_limit"],
        "topup_deadline_day": deadline, "topup_open": open_,
    }


@bp.post("/wallet/me/topup")
@login_required
def top_up():
    """Body: {amount}. Added to the staff member's balance immediately (capped by the monthly wallet limit)."""
    user = current_user()
    open_, deadline = topup_window()
    if not open_:
        today = staff_menu.local_now().date()
        nxt = today.replace(day=calendar.monthrange(today.year, today.month)[1]) + timedelta(days=1)  # 1st of next month
        abort(400, f"Wallet top-ups for {today:%B} closed on the {ordinal(deadline)}. "
                   f"You can top up again from 1 {nxt:%B}.")
    amount = parse_amount(body().get("amount"))
    limit = general()["monthly_wallet_limit"]
    month_start = date.today().replace(day=1)
    this_month = float(db.session.query(db.func.coalesce(db.func.sum(WalletTopup.amount), 0)).filter(
        WalletTopup.staff_no == user.employee_no, WalletTopup.topup_date >= month_start).scalar())
    if limit and this_month + amount > limit:
        left = max(limit - this_month, 0)
        abort(400, f"This would exceed the monthly wallet limit of ₦{limit:,.0f}. "
                   f"You can top up ₦{left:,.0f} more this month.")
    t = WalletTopup(topup_date=date.today(), staff_no=user.employee_no, staff_name=user.full_name,
                    department=department_named(user.department or "Unassigned"), amount=amount, created_by=user.id)
    db.session.add(t)
    db.session.commit()
    return {"topup": t.to_dict(), "balance": balances.balance(user)}, 201


# ---- Admin: Wallet page ----
@bp.get("/departments")
@admin_required
def list_departments():
    return [d.name for d in Department.query.order_by(Department.id)]


@bp.get("/wallet/topups")
@admin_required
def list_topups():
    q = WalletTopup.query.join(Department)
    if request.args.get("department"):
        q = q.filter(Department.name == request.args["department"])
    return [t.to_dict() for t in q.order_by(WalletTopup.topup_date.desc(), WalletTopup.id.desc())]


@bp.post("/wallet/topups")
@admin_required
def fund_account():
    """Admin funds a staff wallet. Body: {staff_no, staff_name, department, amount}"""
    data = body()
    require(data, "staff_no", "staff_name", "department", "amount")
    dept = Department.query.filter_by(name=data["department"]).first()
    if not dept:
        abort(400, "Unknown department")
    t = WalletTopup(topup_date=date.today(), staff_no=data["staff_no"].strip().upper(), staff_name=data["staff_name"].strip(),
                    department=dept, amount=parse_amount(data["amount"]), created_by=current_user().id)
    db.session.add(t)
    db.session.commit()
    return t.to_dict(), 201
