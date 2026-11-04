# Account Management → Staff List: list staff, add staff (Administrator / HR Admin), purchase history.
import re

from flask import Blueprint, abort, current_app, request

from ..extensions import db
from ..models import Company, Customer, Department, Transaction, User
from ..utils import admin_required, body, company_by_code, current_user, require

bp = Blueprint("staff", __name__)


# ---- Helper ----
def bought_by(s):
    """Transactions belonging to this Staff List entry (an employee's served meals are linked via user_id)."""
    cond = Transaction.customer_id == s.id
    if s.user_id:
        cond = db.or_(cond, db.and_(Transaction.user_id == s.user_id, Transaction.customer_id.is_(None)))
    return cond


# ---- Staff List ----
@bp.get("/staff")
@admin_required
def list_staff():
    # load company + linked employee in the same query (LADOL alone has ~380 rows)
    q = Customer.query.join(Company).options(db.contains_eager(Customer.company), db.joinedload(Customer.user))
    if request.args.get("company"):
        q = q.filter(Company.code == request.args["company"])
    return [s.to_dict() for s in q.order_by(Customer.customer_no)]


@bp.post("/staff")
@admin_required
def create_staff():
    """Administrator / HR Admin adds a staff member.
    LADOL employee: {company: "LADOL", employee_no, first_name, last_name, department}
        -> login account (password created at first login, confirming the surname) + LADOL Staff List entry.
    Client company staff: {company, customer_no, name} -> Staff List entry only (no login)."""
    me = current_user()
    if not me.can_add_staff:
        abort(403, "Only an Administrator or HR Admin can add staff")
    data = body()
    require(data, "company")
    company = company_by_code(data["company"].strip().upper())

    if company.code == "LADOL":
        require(data, "employee_no", "first_name", "last_name")
        no = data["employee_no"].strip().upper()
        if not re.fullmatch(r"[A-Z0-9-]{3,20}", no):
            abort(400, "Employee no. must be 3-20 letters, numbers or - (e.g. EMP000999)")
        if User.query.filter_by(employee_no=no).first() or Customer.query.filter_by(customer_no=no).first():
            abort(409, f"{no} already exists")
        first, last = " ".join(data["first_name"].split()), " ".join(data["last_name"].split())
        dept = " ".join((data.get("department") or "").split()) or None
        if dept and not Department.query.filter_by(name=dept).first():
            db.session.add(Department(name=dept))
        user = User(employee_no=no, username=no, full_name=f"{first} {last}", last_name=last, department=dept,
                    role=User.STAFF_ROLE, company=company)
        s = Customer(customer_no=no, name=user.full_name, company=company, eligible=True, user=user)
        db.session.add_all([user, s])
    else:
        require(data, "customer_no", "name")
        no = data["customer_no"].strip().upper()
        if not re.fullmatch(r"[A-Z0-9-]{2,20}", no):
            abort(400, "Staff ID must be 2-20 letters, numbers or -")
        if Customer.query.filter_by(customer_no=no).first() or User.query.filter_by(employee_no=no).first():
            abort(409, f"{no} already exists")
        s = Customer(customer_no=no, name=" ".join(data["name"].split()), company=company,
                     eligible=bool(data.get("eligible", True)))
        db.session.add(s)
    db.session.commit()
    current_app.logger.info("Staff added: %s %s (%s) by %s", s.customer_no, s.name, company.code, me.employee_no)
    return s.to_dict(), 201


# ---- Purchase History and Break Down ----
@bp.get("/staff/<int:staff_id>/purchases")
@admin_required
def purchases(staff_id):
    """Purchase history: one row per (date, meal type) visit."""
    s = db.get_or_404(Customer, staff_id)
    rows = (db.session.query(Transaction.tx_date, Transaction.meal_type, db.func.min(Transaction.tx_time),
                             db.func.sum(Transaction.quantity), db.func.sum(Transaction.quantity * Transaction.unit_price))
            .filter(bought_by(s))
            .group_by(Transaction.tx_date, Transaction.meal_type)
            .order_by(Transaction.tx_date.desc(), Transaction.meal_type).all())
    return {
        "staff": s.to_dict(),
        "purchases": [{"date": d.isoformat(), "time": t.strftime("%H:%M") if t else None, "meal_type": mt,
                       "items": int(qty), "amount": float(amt)} for d, mt, t, qty, amt in rows],
    }


@bp.get("/staff/<int:staff_id>/breakdown")
@admin_required
def breakdown(staff_id):
    """Items bought, optionally narrowed to one visit with ?date=YYYY-MM-DD&meal_type=Lunch."""
    s = db.get_or_404(Customer, staff_id)
    q = db.session.query(Transaction.meal_type, Transaction.item, db.func.sum(Transaction.quantity),
                         db.func.sum(Transaction.quantity * Transaction.unit_price)).filter(bought_by(s))
    if request.args.get("date"):
        q = q.filter(Transaction.tx_date == request.args["date"])
    if request.args.get("meal_type"):
        q = q.filter(Transaction.meal_type == request.args["meal_type"])
    rows = q.group_by(Transaction.meal_type, Transaction.item).order_by(Transaction.meal_type, Transaction.item).all()
    items = [{"meal_type": mt, "item": i, "quantity": int(qty), "cost": float(c)} for mt, i, qty, c in rows]
    return {"staff": s.to_dict(), "items": items, "total": sum(i["cost"] for i in items)}
