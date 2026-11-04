# LADOL Meal Ticketing

React (Vite) frontend + Python Flask API + MySQL.

```
ladol-meal-ticketing/
├─ frontend/          React app (Vite, React Router)
│  └─ src/
│     ├─ api/         client.js (fetch wrapper) + index.js (one function per API endpoint)
│     ├─ hooks/       useApi() – load data with loading/error state
│     ├─ pages/       one file per screen
│     ├─ components/  shared UI
│     └─ data/        UI-only config (dashboard tiles, breadcrumbs)
├─ backend/           Flask API
│  ├─ run.py          entry point (python run.py → http://127.0.0.1:5000)
│  ├─ requirements.txt
│  ├─ .env.example    copy to .env and add your MySQL login
│  ├─ database/schema.sql   reference SQL (tables are created for you)
│  └─ app/
│     ├─ __init__.py  create_app()
│     ├─ config.py    reads .env
│     ├─ models.py    SQLAlchemy tables
│     ├─ routes/      one blueprint per area (meals, orders, wallet, …)
│     ├─ cli.py       flask init-db / seed / reset-db
│     └─ seed.py      sample data
└─ .vscode/           tasks + debug configs
```

## Prerequisites

- **Python 3.10+** (`python --version`)
- **Node.js 18+** (`node --version`)
- **MySQL 8** running locally (MySQL Installer, XAMPP or WAMP all work); you need a user/password that can create a database
- VS Code with the **Python** extension (VS Code will offer the recommended extensions when you open the folder)

## First-time setup

Open the `ladol-meal-ticketing` folder in VS Code, then:

1. **Install everything** – `Terminal → Run Task… → Setup: everything`
   (creates `backend/.venv`, installs Python + npm packages, and creates `backend/.env`)
2. **Set your MySQL login** – open `backend/.env` and fill in `MYSQL_USER` / `MYSQL_PASSWORD`
   (and `MYSQL_HOST`/`MYSQL_PORT` if not the defaults). The database name defaults to `ladol_meal_ticketing`.
3. **Create the database** – `Terminal → Run Task… → DB: create database + tables + sample data`
   This creates the database itself if it doesn't exist, all tables, and sample data.
4. Select the Python interpreter if VS Code asks: `backend/.venv`.

Prefer the terminal? The same steps by hand:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env      # then edit .env
flask --app run init-db
flask --app run seed
cd ..\frontend
npm install
```

## Run

- **Ctrl+Shift+B** (task *Run: full stack*) – starts Flask on :5000 and Vite on :5173, or
- **Run and Debug → "Full stack"** – same, with Python breakpoints working in `backend/`.

Open http://localhost:5173 – the **Dining Connect Pro** landing page – and click **Login** (or go straight to
http://localhost:5173/login). Sign in with `ADMIN_EMPLOYEE_NO` / `ADMIN_PASSWORD` from `backend/.env`,
or with any imported staff member's employee no. (see **Staff login**).

By hand: `cd backend; .venv\Scripts\python run.py` and, in a second terminal, `cd frontend; npm run dev`.

## Staff login

Staff sign in with their **Employee No.** (e.g. `EMP000000`) and a password.

- **First login:** the account has no password yet, so after entering the employee no. the screen asks for their
  **surname** (must match the HR list, any capitalisation) and a new password (min. 8 characters), then signs them in.
  Wrong surnames count toward the lockout below.
- **Where they land:** staff go straight to **My Profile**; admins go to the dashboard.
- **After that:** employee no. + password. Employee numbers are not case-sensitive.
- **Forgotten password / locked out:** an Administrator clicks **Reset password** next to the person in Settings → Staff Roles &
  Permissions (or runs `flask --app run reset-password EMP000000`). The lock is cleared and the staff member creates a new
  password (confirming their surname) at next login. Their wallet and orders are kept.
- **Lockout:** 3 wrong passwords in a row lock that employee no. for 5 minutes (even the right password is refused meanwhile).
  Change with `LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCK_MINUTES` in `backend/.env`.
- **Admin account:** created by `seed` with `ADMIN_EMPLOYEE_NO` / `ADMIN_PASSWORD` from `backend/.env`.

### What each role can do

| Role | Access |
|---|---|
| **Employee** (everyone imported from the HR list) | My Profile (wallet balance, top up, own recent orders, change password), **My Orders** (full order history with filters and totals) and **Today's Menu** – view only: the day's breakfast/lunch/dinner, no prices, no ordering |
| **Administrator** | Everything: serve meals, add companies and staff, manage roles and passwords |
| **PF Admin** | All admin pages + serve staff meals, Client Dining orders, add companies |
| **HR Admin** | All admin pages + add staff (Account Management → Staff List); can't place orders |
| **Finance**, **Commercial Admin** | All admin pages; can't place orders or add staff/companies |

**Changing someone's role:** Settings → **Staff Roles & Permissions** (Administrator only). Search by name or employee no.,
pick the new role and confirm. It takes effect on the server immediately (they see the new menus after reloading the page).
You can't change your own role, and there must always be at least one Administrator. Role changes are written to the Flask log.

The Flask API enforces this (`admin_required` in `backend/app/utils.py`; staff get `403`), and the frontend hides
what staff can't use (`STAFF_PAGES` in `frontend/src/router/routes.js`). Ordering roles are `User.ORDER_ROLES` in
`backend/app/models.py` (`order_required` in `utils.py`).

### Staff meals

- **One meal per meal time:** the staff menu has exactly one breakfast, one lunch and one dinner per day. In Menu Management
  each meal is either *Staff* or *Clients & visitors*. A staff meal with no Menu Date is the everyday default; one with a date
  replaces the default on that day only. A second active staff meal for the same meal time/date is refused.
- **Serving (Today's Menu, Administrator / PF Admin):** enter the employee no., see their name, wallet balance and what they've
  already had, then **Serve**. Each employee gets at most one breakfast, one lunch and one dinner per day; only that day's staff
  meals can be served; the staff price is taken from their wallet (refused if too low).
- **Staff prices** are per meal time, not per dish, and are set in **Settings → Staff meal prices**
  (default: lunch ₦220, breakfast and dinner free). Free meals are still recorded as the employee's orders at ₦0.
  A dish's own price is only used for Client Dining. Served meals show in the employee's
  *My Recent Orders* and as ✓ SERVED on their Today's Menu.
- **Serving times:** each meal can only be served during its window, set in **Settings → Meal serving times**
  (default breakfast 06:00–10:00, lunch 12:00–15:00, dinner 18:00–21:00; start included, end excluded; server clock).
  **Administrators and PF Admins** can serve only the meal whose window is open, and only for today's date (employees and
  contractors alike). Today's Menu shows which meal is being served now.
- **Contractors at the counter:** enter a contractor's ID (client company staff, e.g. `LFZ000000`) instead of an employee no.
  The page shows their name, company, department, eligibility and how many of each meal they've had that day. Each meal
  gets a **Quantity** field (1–500 people). They're charged the same **staff price** as employees × quantity
  (Settings → Staff meal prices; free meals are still recorded at ₦0), billed to their company –
  no wallet and no one-per-meal-time limit. Contractors marked not eligible can't be served.

### Client companies

LADOL is the only company the system starts with. An **Administrator** or **PF Admin** adds client companies with
**Account Management → + Add Company** (short code such as `ESSO`, full name, badge colour). Codes and names must be unique.
New companies can then be chosen in Client Dining.

### Meal images

In **Menu Management → Add / Edit meal** use **Upload image** (JPG, PNG or WebP, max 5 MB). The photo shows on the
meal's card on Today's Menu and Client Dining, and as a thumbnail in Menu Management; meals without one show their emoji.
Files are saved in `backend/uploads/meals/` (not in MySQL and not in git) – **include that folder in your backups**.
Replacing or removing an image, or deleting the meal, deletes the old file. Change the location with `UPLOAD_FOLDER` in `backend/.env`.

### Staff wallet

- **Balance** = top-ups for the employee no. − staff meals served to them.
- **Top-up deadline:** staff can top up from the 1st until the deadline day of each month (Settings → *Monthly wallet top-up
  deadline*: pick a date on the calendar – its day, 1–31, repeats every month; months shorter than that day close on their
  last day; default 20th). Only an **Administrator or HR Admin** can change it. Admin *Fund Account* isn't affected.
- **Top up wallet** (My Profile) adds the amount to the balance immediately, capped by *Monthly wallet limit*
  in Settings (total top-ups this month). Every top-up is listed on the admin **Wallet** page.
- Admins can also fund a wallet with **Fund Account**.

### Adding one staff member

**Account Management → Staff List → + Add Staff** (Administrator or HR Admin). For **LADOL** enter employee no., first name,
surname and department: this creates their login (role Employee); at first login they confirm their surname and choose a
password. For a **client company** enter a staff ID and name: they're listed for Client Dining but get no login.
Adding someone by hand doesn't change the HR spreadsheet; a later `import-staff` keeps them.

### Importing the staff list

```powershell
cd backend
.venv\Scripts\flask --app run import-staff "C:\path\to\Staff List.xlsx"
```

The first sheet must have the header row `Employee ID | LastName | FirstName | Department`.
New staff are added with role **Employee** and no password; existing staff get their name and department
updated (passwords and roles are never changed), so re-run it whenever HR sends an updated list.
New departments are also added to the department list used on the Wallet page, and every employee is registered as
LADOL staff on **Account Management → Staff List** (Employee tag, department, Purchase History of served meals).
`flask --app run register-employees` does just that registration step.
`reset-db` deletes all users, so run `import-staff` again after it.

## How the two halves talk

- The React app calls `/api/...`. In development Vite **proxies** `/api` to `http://127.0.0.1:5000`
  (`frontend/vite.config.js`), so there is no CORS setup and the login cookie just works.
- Login uses a Flask session cookie. Every endpoint except `/api/auth/login` and `/api/health` requires it;
  a `401` sends the browser back to the login screen.
- Errors always come back as `{"error": "message"}` and are shown as a toast.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Server + DB check |
| POST | `/api/auth/lookup` | `{employee_no}` → `{needs_password}` (true on first login) |
| POST | `/api/auth/setup-password` | First login: `{employee_no, surname, password}` – creates the password and signs in |
| POST | `/api/auth/login` | `{employee_no, password}` |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/change-password` | `{current_password, new_password}` |
| GET / POST | `/api/companies` | List (with staff + transaction counts) / Administrator or PF Admin adds `{code, name, color}` |
| GET / POST | `/api/staff?company=` | Staff List / Administrator or HR Admin adds staff: LADOL `{company, employee_no, first_name, last_name, department}` (creates their login) or client `{company, customer_no, name}` |
| GET | `/api/staff/<id>/purchases` | Purchase history grouped by date + meal type |
| GET | `/api/staff/<id>/breakdown?date=&meal_type=` | Items bought and cost |
| GET | `/api/meals/staff-menu?date=` | The day's staff breakfast/lunch/dinner + what the logged-in user has been served (no prices for employees) |
| GET / POST | `/api/meals?status=&meal_type=&date=&q=&for_staff=0\|1` | Admin: all meals / add meal (`for_staff` marks a staff meal) |
| GET / PUT / DELETE | `/api/meals/<id>` | Read / edit / delete a meal |
| POST / DELETE | `/api/meals/<id>/image` | Admin: upload (multipart field `image`) / remove the meal's photo |
| GET | `/api/uploads/meals/<file>` | Meal photo (logged-in users) |
| GET | `/api/orders/employee/<employee_no>?date=` | Administrator/PF Admin counter lookup: name, balance, meals served that day |
| GET | `/api/orders/lookup/<number>?date=` | Administrator/PF Admin counter lookup: employee no. or contractor ID → `{kind: "employee" \| "contractor", …}` |
| POST | `/api/orders/contractor` | Administrator/PF Admin serves a contractor: `{customer_no, items:[{meal_id, quantity}], date}` (staff price × quantity) |
| POST | `/api/orders/staff` | Administrator/PF Admin serves an employee: `{employee_no, items:[{meal_id}], date}` (charged to their wallet) |
| GET | `/api/orders/mine` | The logged-in user's last 20 orders |
| GET | `/api/orders/mine/all?from=&to=&meal_type=&page=&per_page=` | All own orders + totals (My Orders page) |
| POST | `/api/orders/client` | Administrator/PF Admin: `{items, company, guests, date}` → service requests |
| GET | `/api/transactions?company=&meal_type=&from=&to=` | Transactions |
| DELETE | `/api/transactions/<id>` | |
| GET / POST | `/api/requests?status=` | Client dining requests |
| PATCH | `/api/requests/<id>` | `{status}` – Approve / Reject |
| GET | `/api/wallet/me` | Own wallet: `{balance, history, monthly_limit}` |
| POST | `/api/wallet/me/topup` | `{amount}` – top up own wallet immediately → `{topup, balance}` |
| GET | `/api/departments` | Department names |
| GET / POST | `/api/wallet/topups?department=` | Wallet top-ups / fund account `{staff_no, staff_name, department, amount}` |
| GET | `/api/reports/summary?days=7` | Report totals |
| GET / PUT | `/api/settings` | General settings: top-up deadline (Administrator/HR Admin), wallet limit, staff prices, serving times |
| GET | `/api/users?q=&role=&page=` | Administrator: staff accounts and their roles |
| PATCH | `/api/users/<id>/role` | Administrator: `{role}` – change someone's role |
| POST | `/api/users/<id>/reset-password` | Administrator: clear password + lockout (new one set at next login) |

## Database tasks

| Command (run inside `backend/` with the venv active) | What it does |
|---|---|
| `flask --app run init-db` | Create the database (if missing), missing tables, and new columns added to models |
| `flask --app run seed` | Insert sample data (only into an empty database) |
| `flask --app run reset-db` | **Drop all tables**, recreate and reseed |
| `flask --app run import-staff <file.xlsx>` | Add/update staff from the HR spreadsheet |
| `flask --app run reset-password <employee no>` | Clear a password so the staff member creates a new one |
| `flask --app run register-employees` | Put every employee on the LADOL Staff List (Account Management) |
| `flask --app run import-customers <file.xlsx>` | Add/update client company staff from a customer export (Company, CustomerID, Name, Department, Status); creates missing companies |

Tables are created from `backend/app/models.py`. If you change a model, run `reset-db` (loses data)
or alter the table yourself in MySQL. For a long-lived database, consider adding Flask-Migrate.

## How the code is organised

Every file starts with a comment saying what it is for, and is split into commented sections:

- **React pages/components** (`frontend/src`): `// ---- State ----`, `// ---- Data ----`, `// ---- Actions ----`,
  `// ---- Render ----`, with `{/* ... */}` labels on the main parts of the screen.
- **Flask** (`backend/app`): `# ---- Section ----` headers grouping helpers, then the API routes by screen.
- **Styles** (`frontend/src/index.css`): `/* ---- Section ---- */` per area of the app.

Frontend code is laid out by [Prettier](https://prettier.io) (settings in `frontend/.prettierrc.json`, 120 characters wide).
After editing, run `npm run format` in `frontend/` (or `npm run format:check` to only check).
Files no longer used by the app are parked in `frontend/src/_unused/` (safe to delete).

## Adding a feature (pattern)

1. Table → add a model in `backend/app/models.py` with a `to_dict()`.
2. Endpoint → add a function in a file under `backend/app/routes/` (use `@login_required`), and register new blueprints in `routes/__init__.py`.
3. Frontend → add a function in `frontend/src/api/index.js`, then in the page:
   `const { data, loading, error, reload } = useApi(() => things.list(), [])`.

## Troubleshooting

- **`Access denied for user 'root'@'localhost'`** – wrong `MYSQL_USER`/`MYSQL_PASSWORD` in `backend/.env`.
- **`Can't connect to MySQL server on '127.0.0.1'`** – MySQL service isn't running (Windows: Services → MySQL80 → Start, or start it in XAMPP).
- **Every page shows "Request failed (500)" / proxy errors in the Vite terminal** – the Flask server isn't running on port 5000.
- **`running scripts is disabled on this system`** when activating the venv – run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once in PowerShell, or just call `.venv\Scripts\python` directly as the tasks do.
