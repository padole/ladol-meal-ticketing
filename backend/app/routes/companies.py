# Account Management: list companies (with staff / transaction counts) and add new ones.
import re

from flask import Blueprint, abort, current_app

from ..extensions import db
from ..models import Company, Customer, Transaction
from ..utils import admin_required, body, current_user, require

bp = Blueprint("companies", __name__)


# ---- List (admins) ----
@bp.get("/companies")
@admin_required
def list_companies():
    staff = dict(db.session.query(Customer.company_id, db.func.count(Customer.id)).group_by(Customer.company_id).all())
    txs = dict(db.session.query(Transaction.company_id, db.func.count(Transaction.id)).group_by(Transaction.company_id).all())
    return [c.to_dict(staff.get(c.id, 0), txs.get(c.id, 0)) for c in Company.query.order_by(Company.code)]


# ---- Add (Administrator / PF Admin) ----
@bp.post("/companies")
@admin_required
def create_company():
    """Administrator / PF Admin adds a client company. Body: {code, name, color?}"""
    if not current_user().can_manage_companies:
        abort(403, "Only an Administrator or PF Admin can add companies")
    data = body()
    require(data, "code", "name")
    code = data["code"].strip().upper()
    name = " ".join(data["name"].split())
    color = (data.get("color") or "#0d6efd").strip()
    if not re.fullmatch(r"[A-Z0-9&-]{2,20}", code):
        abort(400, "Code must be 2-20 letters, numbers, & or - (e.g. ESSO, NNPC-LTD)")
    if not 2 <= len(name) <= 120:
        abort(400, "Company name must be 2-120 characters")
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
        abort(400, "Colour must look like #1a2b3c")
    if Company.query.filter_by(code=code).first():
        abort(409, f"A company with code '{code}' already exists")
    if Company.query.filter(db.func.lower(Company.name) == name.lower()).first():
        abort(409, f"'{name}' already exists")
    c = Company(code=code, name=name, color=color.lower())
    db.session.add(c)
    db.session.commit()
    current_app.logger.info("Company added: %s (%s) by %s", c.code, c.name, current_user().employee_no)
    return c.to_dict(0, 0), 201
