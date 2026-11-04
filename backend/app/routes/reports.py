# Reports page: totals for the last N days.
from datetime import date, timedelta

from flask import Blueprint, request

from ..extensions import db
from ..models import Company, Customer, Transaction
from ..utils import admin_required

bp = Blueprint("reports", __name__)


@bp.get("/reports/summary")
@admin_required
def summary():
    """?days=7|30|90 — totals for the last N days."""
    days = request.args.get("days", 7, type=int)
    since = date.today() - timedelta(days=days)
    in_range = Transaction.tx_date >= since

    qty = db.func.coalesce(db.func.sum(Transaction.quantity), 0)
    revenue = db.func.coalesce(db.func.sum(Transaction.quantity * Transaction.unit_price), 0)

    meals_served, total_revenue = db.session.query(qty, revenue).filter(in_range).one()
    by_type = dict(db.session.query(Transaction.meal_type, qty).filter(in_range).group_by(Transaction.meal_type).all())

    staff = dict(db.session.query(Customer.company_id, db.func.count(Customer.id)).group_by(Customer.company_id).all())
    txs = dict(db.session.query(Transaction.company_id, db.func.count(Transaction.id))
               .filter(in_range).group_by(Transaction.company_id).all())

    meals_served = int(meals_served)
    return {
        "days": days,
        "meals_served": meals_served,
        "revenue": float(total_revenue),
        "active_staff": Customer.query.filter_by(eligible=True).count(),
        "avg_meal_value": float(total_revenue) / meals_served if meals_served else 0,
        "by_meal_type": [{"meal_type": t, "count": int(by_type.get(t, 0))} for t in ("Breakfast", "Lunch", "Dinner")],
        # only companies with staff or meals in the period (empty ones just added stay out of the report)
        "by_company": [{"company": c.code, "name": c.name, "staff": staff.get(c.id, 0), "transactions": txs.get(c.id, 0)}
                       for c in Company.query.order_by(Company.code) if staff.get(c.id) or txs.get(c.id)],
    }
