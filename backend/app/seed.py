"""Sample data (moved here from the frontend's old src/data files)."""
from datetime import time

import click
from flask import current_app

from .extensions import db
from .models import Company, Department, Meal, Role, Setting, User

# client companies are added by an Administrator / PF Admin in Account Management
# ---- Starting data ----
COMPANIES = [("LADOL", "Logistics & Oil Services", "#0d6efd")]

# Everyday staff menu: one breakfast, one lunch, one dinner (all for_staff). Client/visitor meals are added in Menu Management.
# name, description, type, location, time, price, status, emoji
MEALS = [("Fried Eggs & Bread", "Two eggs, toast, tea", "Breakfast", "Main Restaurant", time(7, 30), 1500, "Available", "🍳"),
         ("Rice & Stew", "Chicken, Beef", "Lunch", "Main Restaurant", time(12), 2200, "Available", "🍛"),
         ("Pounded Yam & Egusi", "Assorted meat", "Dinner", "Main Restaurant", time(18), 3000, "Available", "🥣")]

DEPARTMENTS = ["Maintenance", "Fleet", "Safety, Health, Environment & Quality", "Fabrication and Boat Yard",
               "Logistics and Operations"]

ROLES = ["Administrator", "PF Admin", "HR Admin", "Commercial Admin", "Finance", "Employee"]


# ---- `flask --app run seed`: fill an EMPTY database (does nothing if any user exists) ----
def seed():
    if User.query.first():
        click.echo("Database already has data - skipping seed. Use `flask --app run reset-db` to start over.")
        return

    # Companies, staff meals, departments
    companies = {code: Company(code=code, name=name, color=color) for code, name, color in COMPANIES}
    db.session.add_all(companies.values())


    meals = [Meal(name=n, description=d, meal_type=t, package="Standard", location=loc, serve_time=tm, price=p,
                  status=s, emoji=e, for_staff=True) for n, d, t, loc, tm, p, s, e in MEALS]
    db.session.add_all(meals)

    depts = [Department(name=n) for n in DEPARTMENTS]
    db.session.add_all(depts)

    # First Administrator (employee no. + password from .env)
    admin_no = current_app.config["ADMIN_EMPLOYEE_NO"]
    admin = User(username=admin_no, full_name="Peter Adole",
                 email="peter.adole@ladol.com", employee_no=admin_no,
                 department="LADOL – Facilities", role="Administrator", company=companies["LADOL"])
    admin.set_password(current_app.config["ADMIN_PASSWORD"])
    db.session.add(admin)

    # Role names and default settings
    db.session.add_all(Role(name=n) for n in ROLES)
    db.session.add_all([Setting(key="topup_deadline_day", value="20"), Setting(key="monthly_wallet_limit", value="25000"),
                        Setting(key="email_notifications", value="1")])
    db.session.flush()

    # Put the admin on the LADOL Staff List, then save everything
    from .staff_import import register_employees
    register_employees()
    db.session.commit()
    click.echo(f"Seeded sample data. Admin login: employee no. '{admin_no}', password from ADMIN_PASSWORD in .env.")
    click.echo("Import staff with: flask --app run import-staff <path-to-staff-list.xlsx>")
