"""Staff wallet: balance = top-ups for the employee no. - meals they ordered for themselves."""
from .extensions import db
from .models import Transaction, WalletTopup


# Total ever added to the wallet
def topped_up(user):
    total = (db.session.query(db.func.coalesce(db.func.sum(WalletTopup.amount), 0))
             .filter(WalletTopup.staff_no == user.employee_no).scalar())
    return float(total)


def spent(user):
    # own orders only: an admin ordering on behalf of a client company's customer isn't paying from their wallet
    total = (db.session.query(db.func.coalesce(db.func.sum(Transaction.quantity * Transaction.unit_price), 0))
             .filter(Transaction.user_id == user.id, Transaction.customer_id.is_(None)).scalar())
    return float(total)


# What the employee can still spend
def balance(user):
    return topped_up(user) - spent(user)
