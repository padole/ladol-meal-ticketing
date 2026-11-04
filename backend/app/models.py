# Database tables (SQLAlchemy models). Each class is one MySQL table; to_dict() is what the API returns.
# New columns are added to an existing database by `flask --app run init-db`.
from datetime import date, datetime

from werkzeug.security import check_password_hash, generate_password_hash

from .extensions import db


# date -> "YYYY-MM-DD" (or None)
def iso(d):
    return d.isoformat() if d else None


# ---- users: everyone who can log in (LADOL employees and admins). Logs in with employee_no. ----
class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    # -- login --
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255))  # NULL until the staff member creates a password on first login
    # -- profile --
    full_name = db.Column(db.String(120), nullable=False)
    last_name = db.Column(db.String(80))  # from the HR list; asked for when creating a password at first login
    job_title = db.Column(db.String(120))
    email = db.Column(db.String(120))
    phone = db.Column(db.String(40))
    employee_no = db.Column(db.String(40), unique=True, nullable=False)  # what staff log in with
    department = db.Column(db.String(120))
    # -- access + company --
    role = db.Column(db.String(60), nullable=False, default="Employee")
    company_id = db.Column(db.Integer, db.ForeignKey("companies.id"))
    company = db.relationship("Company")
    # -- lockout after too many wrong passwords --
    failed_logins = db.Column(db.Integer, default=0)  # wrong passwords in a row
    locked_until = db.Column(db.DateTime)  # UTC; login refused until then
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # -- What each role may do (used by the access decorators in utils.py and the routes) --
    # "Employee" = ordinary staff (view menu + own profile). Every other role manages the system.
    STAFF_ROLE = "Employee"
    # only these roles may serve meals / place orders at the Staff and Client Dining counters
    ORDER_ROLES = ("Administrator", "PF Admin")

    @property
    def is_admin(self):
        return self.role != self.STAFF_ROLE

    @property
    def can_order(self):
        return self.role in self.ORDER_ROLES

    # may add client companies in Account Management
    COMPANY_ROLES = ("Administrator", "PF Admin")

    @property
    def can_manage_companies(self):
        return self.role in self.COMPANY_ROLES

    # may add staff in Account Management → Staff List
    STAFF_ADMIN_ROLES = ("Administrator", "HR Admin")

    @property
    def can_add_staff(self):
        return self.role in self.STAFF_ADMIN_ROLES

    @property
    def can_set_topup_deadline(self):  # same roles as adding staff: Administrator, HR Admin
        return self.role in self.STAFF_ADMIN_ROLES

    # -- Passwords are stored hashed, never as plain text --
    def set_password(self, raw):
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw):
        return bool(self.password_hash) and check_password_hash(self.password_hash, raw)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "full_name": self.full_name,
            "job_title": self.job_title,
            "email": self.email,
            "phone": self.phone,
            "employee_no": self.employee_no,
            "department": self.department,
            "role": self.role,
            "company": self.company.code if self.company else None,
            "is_admin": self.is_admin,
            "can_order": self.can_order,
            "can_manage_companies": self.can_manage_companies,
            "can_add_staff": self.can_add_staff,
            "can_set_topup_deadline": self.can_set_topup_deadline,
        }


# ---- companies: LADOL and client companies (Account Management) ----
class Company(db.Model):
    __tablename__ = "companies"
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(120), nullable=False)
    color = db.Column(db.String(10), default="#0d6efd")

    def to_dict(self, staff_count=None, tx_count=None):
        d = {"id": self.id, "code": self.code, "name": self.name, "color": self.color}
        if staff_count is not None:
            d["staff_count"] = staff_count
        if tx_count is not None:
            d["transaction_count"] = tx_count
        return d


# ---- customers: the Staff List. LADOL employees (linked to their login) + client company staff (no login) ----
class Customer(db.Model):
    """Company staff who can buy meals (Account Management → Staff List).
    LADOL employees are registered here too (customer_no = employee no.), linked to their login via user_id."""
    __tablename__ = "customers"
    id = db.Column(db.Integer, primary_key=True)
    customer_no = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(120), nullable=False)
    company_id = db.Column(db.Integer, db.ForeignKey("companies.id"), nullable=False)
    company = db.relationship("Company", backref="customers")
    eligible = db.Column(db.Boolean, nullable=False, default=True)
    department = db.Column(db.String(120))  # client staff; LADOL employees use their login's department
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "customer_no": self.customer_no,
            "name": self.name,
            "company": self.company.code,
            "eligible": self.eligible,
            "employee": self.user_id is not None,
            "department": self.user.department if self.user else self.department,
        }


# ---- meals: staff menu (for_staff) and client/visitor meals (Menu Management) ----
class Meal(db.Model):
    __tablename__ = "meals"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(255))
    meal_type = db.Column(db.Enum("Breakfast", "Lunch", "Dinner", name="meal_type"), nullable=False)
    package = db.Column(db.String(40), default="Standard")
    location = db.Column(db.String(80), nullable=False)
    menu_date = db.Column(db.Date)  # NULL = served every day
    serve_time = db.Column(db.Time)
    price = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    status = db.Column(db.Enum("Available", "Scheduled", "Unavailable", name="meal_status"), nullable=False, default="Available")
    emoji = db.Column(db.String(8), default="🍽️")
    contractor = db.Column(db.Boolean, nullable=False, default=False)
    # Staff menu = one breakfast, one lunch, one dinner per day (see app/staff_menu.py); others are for clients/visitors
    for_staff = db.Column(db.Boolean, nullable=False, default=False)
    image = db.Column(db.String(80))  # file name in UPLOAD_FOLDER/meals (see app/meal_images.py)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "meal_type": self.meal_type,
            "package": self.package,
            "location": self.location,
            "menu_date": iso(self.menu_date),
            "serve_time": self.serve_time.strftime("%H:%M") if self.serve_time else None,
            "price": float(self.price),
            "status": self.status,
            "emoji": self.emoji,
            "contractor": self.contractor,
            "for_staff": bool(self.for_staff),
            "image_url": f"/api/uploads/meals/{self.image}" if self.image else None,
        }


# ---- transactions: every meal served (employee, contractor) - used for wallets, history and reports ----
class Transaction(db.Model):
    """One meal item purchased by a staff member."""
    __tablename__ = "transactions"
    id = db.Column(db.Integer, primary_key=True)
    tx_date = db.Column(db.Date, nullable=False, default=date.today)
    tx_time = db.Column(db.Time)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id", ondelete="SET NULL"))
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))  # employee the meal was for (paid from their wallet)
    served_by = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))  # Administrator / PF Admin who placed it
    customer_name = db.Column(db.String(120), nullable=False)
    company_id = db.Column(db.Integer, db.ForeignKey("companies.id"))
    company = db.relationship("Company")
    meal_id = db.Column(db.Integer, db.ForeignKey("meals.id", ondelete="SET NULL"))
    meal_type = db.Column(db.String(20), nullable=False)
    item = db.Column(db.String(120), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "date": iso(self.tx_date),
            "time": self.tx_time.strftime("%H:%M") if self.tx_time else None,
            "customer_id": self.customer_id,
            "customer_name": self.customer_name,
            "company": self.company.code if self.company else None,
            "meal_type": self.meal_type,
            "item": self.item,
            "quantity": self.quantity,
            "unit_price": float(self.unit_price),
            "amount": float(self.unit_price) * self.quantity,
        }


# ---- service_requests: Client Dining orders/requests ----
class ServiceRequest(db.Model):
    """Client dining requests (and walk-in client POS orders)."""
    __tablename__ = "service_requests"
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey("companies.id"), nullable=False)
    company = db.relationship("Company")
    requested_by = db.Column(db.String(120), nullable=False)
    meal_type = db.Column(db.String(20), nullable=False)
    meal_id = db.Column(db.Integer, db.ForeignKey("meals.id", ondelete="SET NULL"))
    guests = db.Column(db.Integer, nullable=False, default=1)
    service_date = db.Column(db.Date)
    status = db.Column(db.Enum("Pending", "Approved", "Rejected", "Completed", name="request_status"), nullable=False, default="Pending")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "company": self.company.code,
            "requested_by": self.requested_by,
            "meal_type": self.meal_type,
            "guests": self.guests,
            "service_date": iso(self.service_date),
            "status": self.status,
        }


# ---- departments: list used for staff and wallet top-ups ----
class Department(db.Model):
    __tablename__ = "departments"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)


# ---- wallet_topups: money added to a staff wallet (by the employee or by an admin) ----
class WalletTopup(db.Model):
    __tablename__ = "wallet_topups"
    id = db.Column(db.Integer, primary_key=True)
    topup_date = db.Column(db.Date, nullable=False, default=date.today)
    staff_no = db.Column(db.String(20), nullable=False)
    staff_name = db.Column(db.String(120), nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=False)
    department = db.relationship("Department")
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"))  # admin who funded it, or the staff member themselves
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "date": iso(self.topup_date),
            "staff_no": self.staff_no,
            "staff_name": self.staff_name,
            "department": self.department.name,
            "amount": float(self.amount),
        }


# ---- roles: role names shown in Settings → Staff Roles & Permissions ----
class Role(db.Model):
    """Role names offered in Settings → Staff Roles & Permissions. What each role may do is decided in code
    (User.is_admin / User.ORDER_ROLES and the Administrator-only routes in routes/users.py)."""
    __tablename__ = "roles"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(60), unique=True, nullable=False)


# ---- settings: key/value general settings (see routes/settings.py for the keys and defaults) ----
class Setting(db.Model):
    __tablename__ = "settings"
    key = db.Column(db.String(60), primary_key=True)
    value = db.Column(db.String(255), nullable=False)
