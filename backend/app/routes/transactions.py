# Transactions page: every meal served (admins), with filters and delete.
from flask import Blueprint, request

from ..extensions import db
from ..models import Company, Transaction
from ..utils import admin_required, parse_date

bp = Blueprint("transactions", __name__)


@bp.get("/transactions")
@admin_required
def list_transactions():
    """Filters: ?company=ESSO &meal_type=Lunch &from=YYYY-MM-DD &to=YYYY-MM-DD"""
    q = Transaction.query.outerjoin(Company)
    a = request.args
    if a.get("company"):
        q = q.filter(Company.code == a["company"])
    if a.get("meal_type"):
        q = q.filter(Transaction.meal_type == a["meal_type"])
    if a.get("from"):
        q = q.filter(Transaction.tx_date >= parse_date(a["from"]))
    if a.get("to"):
        q = q.filter(Transaction.tx_date <= parse_date(a["to"]))
    return [t.to_dict() for t in q.order_by(Transaction.tx_date.desc(), Transaction.id.desc())]


@bp.delete("/transactions/<int:tx_id>")
@admin_required
def delete_transaction(tx_id):
    db.session.delete(db.get_or_404(Transaction, tx_id))
    db.session.commit()
    return {"ok": True}
