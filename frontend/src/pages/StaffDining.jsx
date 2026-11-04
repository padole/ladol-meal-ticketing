import { useEffect, useState } from "react";
import { Logo } from "../components/Logo";
import { Status } from "../components/Status";
import { MealPhoto } from "../components/MealPhoto";
import { meals, orders, wallet } from "../api";
import { homeFor } from "../router/routes";
import { useApi } from "../hooks/useApi";
import { N, fmtTime, today } from "../utils/format";

// Meal times in display order, and the default quantity (1) for each when serving contractors
const TYPES = ["Breakfast", "Lunch", "Dinner"];
const ONE = { Breakfast: 1, Lunch: 1, Dinner: 1 };

// Today's Menu (staff menu: one breakfast, one lunch, one dinner per day).
//  - Employees: view only (no prices, no ordering); meals they've had show "✓ SERVED".
//  - Administrator / PF Admin (the counter): during each meal's serving time, today only, enter
//      an employee no.  -> serve 1 meal per meal time, paid from their wallet at the staff price, or
//      a contractor ID -> serve any quantity at the staff price, billed to the contractor's company.
export function StaffDining({ go, toast, user }) {
  // ---- Data: the day's menu, and (for employees) their own wallet ----
  const [date, setDate] = useState(today());
  const menu = useApi(() => meals.staffMenu(date), [date]);
  const counter = user.can_order;
  const w = useApi(() => (user.is_admin ? Promise.resolve(null) : wallet.me()), [user.is_admin]);
  // ---- Counter state: number typed, who was found, meal being confirmed, quantities ----
  const [no, setNo] = useState("");
  const [who, setWho] = useState(null);
  const [meal, setMeal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [qty, setQty] = useState(ONE);
  // ---- Serving windows: only the meal whose time it is can be served, today only (the server enforces it too) ----
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const win = menu.data?.windows;
  const hhmm = clock.toTimeString().slice(0, 5);
  const nowServing = win ? TYPES.find((t) => win[t][0] <= hhmm && hhmm < win[t][1]) || null : null;
  const isToday = date === today();
  const closed = (t) => counter && win && (!isToday || t !== nowServing); // true = can't serve this meal now
  // ---- Derived values ----
  const home = homeFor(user);
  const fd = new Date(date + "T00:00:00");
  const byType = Object.fromEntries((menu.data?.meals || []).map((m) => [m.meal_type, m]));
  const emp = who?.kind === "employee" ? who : null,
    con = who?.kind === "contractor" ? who : null;
  const served = counter ? emp?.served || [] : menu.data?.served || [];
  // ---- Counter: find an employee/contractor, clear, change date ----
  const lookup = (n, d) => orders.lookup(n, d);
  const find = (e) => {
    e?.preventDefault();
    if (!no.trim()) return;
    setBusy(true);
    setQty(ONE);
    lookup(no, date)
      .then(setWho)
      .catch((x) => {
        setWho(null);
        toast(x.message);
      })
      .finally(() => setBusy(false));
  };
  const clear = () => {
    setWho(null);
    setNo("");
    setQty(ONE);
  };
  const changeDate = (d) => {
    if (!d) return;
    setDate(d);
    if (who)
      lookup(who.employee_no || who.customer_no, d)
        .then(setWho)
        .catch(() => setWho(null));
  };
  // ---- Serve: quantity for a meal time (contractors), and the confirmed serve call ----
  const q = (t) => Math.max(1, parseInt(qty[t]) || 1);
  const serve = () => {
    setBusy(true);
    const req = emp
      ? orders.serve(emp.employee_no, [meal.id], date)
      : orders.serveContractor(con.customer_no, [{ meal_id: meal.id, quantity: q(meal.meal_type) }], date);
    req
      .then((r) => {
        if (emp) {
          toast(`Served ${meal.name} to ${emp.full_name}`);
          setWho({ ...emp, balance: r.balance, served: r.served });
        } else {
          toast(`Served ${q(meal.meal_type)} × ${meal.name} to ${con.name}`);
          setWho({ ...con, served: r.served });
          setQty({ ...qty, [meal.meal_type]: 1 });
        }
        setMeal(null);
      })
      .catch((x) => toast(x.message))
      .finally(() => setBusy(false));
  };

  // ---- The button under each meal card (depends on time window, who is selected and their rules) ----
  const button = (t, m) => {
    if (closed(t))
      return (
        <button className="dob" disabled style={{ opacity: 0.5 }}>
          {!isToday ? "Today only" : `${t} is served ${win[t][0]}–${win[t][1]}`}
        </button>
      );
    if (!who)
      return (
        <button className="dob" disabled style={{ opacity: 0.5 }}>
          Enter employee or contractor no. first
        </button>
      );
    if (con) {
      const ok = con.eligible;
      return (
        <div style={{ display: "flex", gap: 8, marginTop: 15, alignItems: "stretch" }}>
          <div style={{ width: 96 }}>
            <div className="fl" style={{ marginBottom: 2 }}>
              QUANTITY
            </div>
            <input
              type="number"
              min="1"
              max="500"
              value={qty[t]}
              onChange={(e) => setQty({ ...qty, [t]: e.target.value })}
              disabled={!ok}
              style={{ width: "100%", minHeight: 40 }}
            />
          </div>
          <button
            className="dob"
            style={{ marginTop: 0, opacity: ok ? 1 : 0.5 }}
            disabled={!ok}
            onClick={() => setMeal(m)}
          >
            {ok ? `✔ Serve ${q(t)}` : "Not eligible"}
          </button>
        </div>
      );
    }
    const had = served.includes(t),
      short = m.price > emp.balance;
    return (
      <button
        className="dob"
        disabled={had || short}
        style={{ opacity: had || short ? 0.5 : 1 }}
        onClick={() => setMeal(m)}
      >
        {had ? `Already had ${t.toLowerCase()}` : short ? "Not enough balance" : `✔ Serve ${t.toLowerCase()}`}
      </button>
    );
  };

  // ---- Render ----
  return (
    <div>
      {/* Top bar: back arrow, logo, wallet shortcut */}
      <header className="dh">
        <div style={{ display: "flex", alignItems: "center", gap: 25 }}>
          <a className="dback" onClick={() => go(home)}>
            ‹
          </a>
          <Logo go={go} height={50} />
        </div>
        {user.is_admin ? (
          <button className="dwal" onClick={() => go("wallet")}>
            👛 Update Staff Wallet
          </button>
        ) : (
          <button className="dwal" onClick={() => go("profile")}>
            👛 Wallet: {w.data ? N(w.data.balance) : "…"}
          </button>
        )}
      </header>
      {/* Black tab bar */}
      <nav className="dnav">
        <a onClick={() => go(home)}>{user.is_admin ? "Dashboard" : "My Profile"}</a>
        <a className="on">Today's Menu</a>
        <span className="don">● ONLINE</span>
      </nav>
      <div className="dmain">
        {/* Title + date */}
        <div className="dhead">
          <div>
            <h2>🏪 Today's Menu</h2>
            <p>
              {counter
                ? "Enter an employee number or a contractor ID, then serve the meal."
                : "Staff get one breakfast, one lunch and one dinner a day. Meals are served at the counter."}
            </p>
          </div>
          <b>{fd.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</b>
        </div>
        {/* Date picker + (counter) employee/contractor lookup */}
        <div className="dfil" style={{ gridTemplateColumns: counter ? "1fr 2fr" : "1fr" }}>
          <div>
            <div className="fl">MENU DATE</div>
            <input type="date" value={date} onChange={(e) => changeDate(e.target.value)} style={{ width: "100%" }} />
            {counter && win && !isToday && (
              <small style={{ color: "#dc2626" }}>
                Viewing only – meals can be served for today only.{" "}
                <a style={{ textDecoration: "underline" }} onClick={() => changeDate(today())}>
                  Back to today
                </a>
              </small>
            )}
          </div>
          {counter && (
            <form onSubmit={find}>
              <div className="fl">EMPLOYEE NO. / CONTRACTOR ID</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  placeholder="e.g. EMP000000 or LFZ000000"
                  value={no}
                  onChange={(e) => setNo(e.target.value)}
                  style={{ flex: 1, textTransform: "uppercase" }}
                />
                <button className="btn" disabled={busy || !no.trim()}>
                  Verify
                </button>
                {who && (
                  <button type="button" className="btn ol" onClick={clear}>
                    Clear
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Counter: selected employee (balance + meals already had) */}
        {counter && emp && (
          <div className="card wal">
            <div>
              <div className="fl">SERVING EMPLOYEE</div>
              <b style={{ fontSize: 20 }}>{emp.full_name}</b>
              <div style={{ color: "var(--mut)" }}>
                {emp.employee_no} · {emp.department || "—"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="fl">WALLET BALANCE</div>
              <div className="bal" style={{ fontSize: 26 }}>
                {N(emp.balance)}
              </div>
              <small style={{ color: "var(--mut)" }}>
                Already had: {served.length ? served.join(", ") : "nothing yet"}
              </small>
            </div>
          </div>
        )}

        {/* Counter: selected contractor (company, eligibility, people served today) */}
        {counter && con && (
          <div className="card wal" style={{ borderLeftColor: "#3765b5" }}>
            <div>
              <div className="fl">SERVING CONTRACTOR</div>
              <b style={{ fontSize: 20 }}>{con.name}</b>
              <div style={{ color: "var(--mut)" }}>
                {con.customer_no} · {con.company_name} ({con.company}){con.department ? ` · ${con.department}` : ""}
              </div>
              <span className={"pill " + (con.eligible ? "ok" : "no")} style={{ marginTop: 6 }}>
                {con.eligible ? "✓ Eligible" : "✕ Not eligible"}
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="fl">SERVED ON THIS DATE</div>
              <div style={{ fontSize: 15, marginTop: 4 }}>
                {TYPES.map((t) => (
                  <span key={t} style={{ marginLeft: 14 }}>
                    {t}: <b>{con.served[t] || 0}</b>
                  </span>
                ))}
              </div>
              <small style={{ color: "var(--mut)" }}>Billed to {con.company} at the staff price per person</small>
            </div>
          </div>
        )}

        {/* Counter: which meal is being served right now */}
        {counter && win && (
          <div
            className="card"
            style={{
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              borderLeft: `5px solid ${nowServing ? "#2e7d32" : "#9ca3af"}`,
            }}
          >
            <span>
              🕒{" "}
              {nowServing ? (
                <>
                  Now serving <b>{nowServing}</b> ({win[nowServing][0]}–{win[nowServing][1]})
                </>
              ) : (
                <>No meal is being served right now</>
              )}
            </span>
            <small style={{ color: "var(--mut)" }}>
              {TYPES.map((t) => (
                <span key={t} style={{ marginLeft: 12 }}>
                  {t} {win[t][0]}–{win[t][1]}
                </span>
              ))}
            </small>
          </div>
        )}
        {/* The three meal cards (an empty card if a meal time has nothing set) */}
        <Status loading={menu.loading} error={menu.error} retry={menu.reload} />
        {menu.data && (
          <div className="dmeals">
            {TYPES.map((t) => {
              const m = byType[t];
              const had = !con && served.includes(t);
              if (!m)
                return (
                  <div className="dmc" key={t}>
                    <div className="dimg" style={{ filter: "grayscale(1)", opacity: 0.5 }}>
                      <span>🍽️</span>
                      <i className="b1">{t.toUpperCase()}</i>
                    </div>
                    <div className="dbd">
                      <div className="dt">No {t.toLowerCase()} set</div>
                      <div className="dd">Nothing on the staff menu for this meal time.</div>
                    </div>
                  </div>
                );
              const p = m.price;
              return (
                <div className="dmc" key={t}>
                  <div className="dimg">
                    <MealPhoto meal={m} />
                    <i className="b1">{t.toUpperCase()}</i>
                    {had && (
                      <i className="b2" style={{ background: "#166534" }}>
                        ✓ SERVED
                      </i>
                    )}
                  </div>
                  <div className="dbd">
                    <div className="dt">{m.name}</div>
                    <div className="dd">{m.description}</div>
                    <div
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}
                    >
                      {p !== undefined ? (
                        <div className="dp">
                          {p ? N(p) : "Free"}
                          {con && p ? (
                            <small style={{ fontSize: 12, color: "var(--mut)", fontWeight: 400 }}> / person</small>
                          ) : null}
                        </div>
                      ) : (
                        <span />
                      )}
                      <small style={{ color: "var(--mut)" }}>
                        🕒 {fmtTime(m.serve_time)} · {m.location}
                      </small>
                    </div>
                    {counter && button(t, m)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm pop-up (different text for employees and contractors) */}
      {meal && who && (
        <div className="modal">
          <div className="card" style={{ padding: "30px 26px", width: "100%" }}>
            <div className="dimg" style={{ height: 150, borderRadius: 10, marginBottom: 6 }}>
              <MealPhoto meal={meal} />
            </div>
            {emp ? (
              <>
                <h3>Serve {meal.name}?</h3>
                <p style={{ color: "var(--mut)" }}>
                  To <b>{emp.full_name}</b> ({emp.employee_no})<br />
                  {meal.price ? (
                    <>
                      {N(meal.price)} will be taken from their wallet (balance {N(emp.balance)}).
                    </>
                  ) : (
                    "Free – recorded as their order, nothing is charged."
                  )}
                </p>
              </>
            ) : (
              <>
                <h3>
                  Serve {q(meal.meal_type)} × {meal.name}?
                </h3>
                <p style={{ color: "var(--mut)" }}>
                  To <b>{con.name}</b> ({con.customer_no}, {con.company})<br />
                  {meal.price ? (
                    <>
                      {q(meal.meal_type)} × {N(meal.price)} ={" "}
                      <b style={{ color: "var(--tx)" }}>{N(q(meal.meal_type) * meal.price)}</b>, billed to{" "}
                      {con.company_name}.
                    </>
                  ) : (
                    <>Free – recorded against {con.company_name}, nothing is charged.</>
                  )}
                </p>
              </>
            )}
            <button className="btn ol" onClick={() => setMeal(null)} style={{ marginRight: 8 }}>
              Cancel
            </button>
            <button className="btn" style={{ background: "#198754" }} disabled={busy} onClick={serve}>
              {busy ? "Serving…" : "Confirm"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
