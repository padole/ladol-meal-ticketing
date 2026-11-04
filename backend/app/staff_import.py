"""Load LADOL staff from the HR spreadsheet into the users table.

Expected columns (first sheet, header row): Employee ID | LastName | FirstName | Department
Re-running is safe: existing staff get their name/department updated, passwords and roles are never touched.
"""
import re

import click
import openpyxl

from .extensions import db
from .models import Company, Customer, Department, User

# ==== HR staff list (import-staff) ====

# Spreadsheet header -> field name
COLUMNS = {"employee id": "employee_no", "lastname": "last", "firstname": "first", "department": "department"}


# Yield one dict per staff row; blank rows skipped, rows without an Employee ID reported
def read_rows(path):
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = [str(h or "").strip().lower() for h in next(rows)]
    missing = [c for c in COLUMNS if c not in header]
    if missing:
        raise click.ClickException(f"Missing column(s) {missing}. Found: {header}")
    idx = {COLUMNS[c]: header.index(c) for c in COLUMNS}
    for n, row in enumerate(rows, start=2):
        rec = {k: str(row[i]).strip() if row[i] is not None else "" for k, i in idx.items()}
        if not any(rec.values()):
            continue  # blank line
        if not rec["employee_no"]:
            click.echo(f"  row {n}: skipped (no Employee ID)")
            continue
        rec["employee_no"] = rec["employee_no"].upper()
        yield rec


# Create new logins (role Employee, no password yet) and update names/departments of existing ones
def import_staff(path):
    added = updated = 0
    known_depts = {d.name for d in Department.query}
    ladol = Company.query.filter_by(code="LADOL").first()  # everyone on the HR list is LADOL staff
    for rec in read_rows(path):
        name = f"{rec['first']} {rec['last']}".strip()
        user = User.query.filter_by(employee_no=rec["employee_no"]).first()
        if user:
            updated += 1
        else:
            user = User(employee_no=rec["employee_no"], username=rec["employee_no"], role="Employee")
            db.session.add(user)
            added += 1
        user.full_name = name or user.full_name or rec["employee_no"]
        user.last_name = rec["last"] or user.last_name
        user.department = rec["department"] or user.department
        user.company = user.company or ladol
        if rec["department"] and rec["department"] not in known_depts:
            db.session.add(Department(name=rec["department"]))  # also offered in Wallet department lists
            known_depts.add(rec["department"])
    db.session.flush()
    registered = register_employees()
    db.session.commit()
    if registered:
        click.echo(f"Registered {registered} employee(s) on the LADOL Staff List (Account Management).")
    click.echo(f"Staff import done: {added} added, {updated} updated. "
               "New staff create their password the first time they log in.")


# ==== LADOL Staff List (register-employees) ====
def register_employees():
    """Make sure every employee login has a LADOL entry on the Account Management Staff List, kept in sync."""
    ladol = Company.query.filter_by(code="LADOL").first()
    if not ladol:
        raise click.ClickException("Company 'LADOL' is missing - run `flask --app run seed` first")
    linked = {c.user_id: c for c in Customer.query.filter(Customer.user_id.isnot(None))}
    created = 0
    for u in User.query:
        c = linked.get(u.id) or Customer.query.filter_by(customer_no=u.employee_no).first()
        if not c:
            c = Customer(customer_no=u.employee_no, eligible=True)
            db.session.add(c)
            created += 1
        c.user_id, c.name, c.company = u.id, u.full_name, u.company or ladol
    return created


# ==== Client company staff from a customer export (import-customers) ====

# Spreadsheet header (spaces removed, lower-case) -> field name
CUSTOMER_COLUMNS = {"company": "company", "customerid": "customer_no", "name": "name",
                    "department": "department", "status": "status"}


def company_code(name):
    """'Contractor' -> 'CONTRACTOR', 'Shell & Co. Ltd' -> 'SHELL-&-CO-LTD' (fits Company.code rules)."""
    code = re.sub(r"[^A-Z0-9&]+", "-", name.upper()).strip("-")[:20].strip("-")
    return code or "CLIENT"


def import_customers(path):
    """Client company staff from a customer export (Company | CustomerID | Name | Department | Status ...).
    Missing companies are created; existing IDs are updated; Status other than Active = not eligible."""
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = [re.sub(r"\s+", "", str(h or "")).lower() for h in next(rows)]
    missing = [c for c in ("company", "customerid", "name") if c not in header]
    if missing:
        raise click.ClickException(f"Missing column(s) {missing}. Found: {header}")
    idx = {key: header.index(col) for col, key in CUSTOMER_COLUMNS.items() if col in header}
    added = updated = skipped = 0
    new_companies = []
    for n, row in enumerate(rows, start=2):
        rec = {k: " ".join(str(row[i]).split()) if row[i] is not None else "" for k, i in idx.items()}
        if not any(rec.values()):
            continue
        no = rec["customer_no"].upper()
        if not no or not rec["name"] or not rec["company"]:
            click.echo(f"  row {n}: skipped (needs Company, CustomerID and Name)")
            skipped += 1
            continue
        if User.query.filter_by(employee_no=no).first():
            click.echo(f"  row {n}: skipped ({no} is a LADOL employee number)")
            skipped += 1
            continue
        company = (Company.query.filter(db.func.lower(Company.name) == rec["company"].lower()).first()
                   or Company.query.filter_by(code=company_code(rec["company"])).first())
        if not company:
            company = Company(code=company_code(rec["company"]), name=rec["company"], color="#64748b")
            db.session.add(company)
            db.session.flush()
            new_companies.append(company.code)
        c = Customer.query.filter_by(customer_no=no).first()
        if c and c.user_id:
            click.echo(f"  row {n}: skipped ({no} belongs to a LADOL employee)")
            skipped += 1
            continue
        if c:
            updated += 1
        else:
            c = Customer(customer_no=no)
            db.session.add(c)
            added += 1
        c.name, c.company = rec["name"], company
        c.department = rec.get("department") or c.department
        if "status" in rec:
            c.eligible = rec["status"].lower() in ("", "active")
    db.session.commit()
    if new_companies:
        click.echo(f"Created company: {', '.join(new_companies)}")
    click.echo(f"Customer import done: {added} added, {updated} updated, {skipped} skipped.")


# ==== `flask --app run ...` commands ====
def register(app):
    @app.cli.command("import-staff")
    @click.argument("xlsx_path", type=click.Path(exists=True, dir_okay=False))
    def import_staff_cmd(xlsx_path):
        """Import/update staff from an Excel file (Employee ID, LastName, FirstName, Department)."""
        import_staff(xlsx_path)

    @app.cli.command("import-customers")
    @click.argument("xlsx_path", type=click.Path(exists=True, dir_okay=False))
    def import_customers_cmd(xlsx_path):
        """Import client company staff (Company, CustomerID, Name, Department, Status); creates missing companies."""
        import_customers(xlsx_path)

    @app.cli.command("register-employees")
    def register_employees_cmd():
        """Add every employee to the LADOL Staff List in Account Management (safe to re-run)."""
        n = register_employees()
        db.session.commit()
        click.echo(f"Registered {n} new employee(s) on the LADOL Staff List.")

    @app.cli.command("reset-password")
    @click.argument("employee_no")
    def reset_password_cmd(employee_no):
        """Clear a staff member's password so they create a new one at next login."""
        user = User.query.filter_by(employee_no=employee_no.strip().upper()).first()
        if not user:
            raise click.ClickException(f"No staff with employee no. {employee_no}")
        user.password_hash = None
        user.failed_logins, user.locked_until = 0, None
        db.session.commit()
        click.echo(f"Password cleared for {user.full_name} ({user.employee_no}). They will create a new one at next login.")
