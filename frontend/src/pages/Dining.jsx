import { Logo } from "../components/Logo";
import { Status } from "../components/Status";
import { MealPhoto } from "../components/MealPhoto";
import { useState } from "react";
import { companies, meals, orders } from "../api";
import { homeFor } from "../router/routes";
import { useApi } from "../hooks/useApi";
import { N, fmtTime, today } from "../utils/format";

// Note: only Administrator / PF Admin can open this page (see AppRouter).
// Client Dining point of sale (staff meals are served on StaffDining).
export function Dining({ go, client, list, toast, user }) {
  // ---- State ----
  const [tab, setTab] = useState("Point of Sale");
  const [type, setType] = useState("All");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState([]);
  const [open, setOpen] = useState(false);
  const [pick, setCo] = useState("");
  const [g, setG] = useState(1);
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const fd = new Date(date + "T00:00:00");
  // ---- Data: client/visitor meals for the date + companies for the order form ----
  const { data, loading, error, reload } = useApi(
    () => meals.list({ status: "Available", meal_type: type, date, for_staff: 0 }),
    [type, date],
  );
  const cos = useApi(() => (client ? companies.list() : Promise.resolve([])), [client]).data || [];
  const co = pick || cos[0]?.code || ""; // default to the first company (none are hard-coded)
  const home = homeFor(user);
  const ms = (data || []).filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));
  // ---- Place the order (recorded as a completed client request) ----
  const confirm = () => {
    setBusy(true);
    orders
      .client(cart, co, +g || 1, date)
      .then(() => {
        setCart([]);
        setOpen(false);
        toast("Order submitted successfully");
      })
      .catch((e) => toast(e.message))
      .finally(() => setBusy(false));
  };
  // ---- Render ----
  return (
    <div>
      {/* Top bar */}
      <header className="dh">
        <div style={{ display: "flex", alignItems: "center", gap: 25 }}>
          <a className="dback" onClick={() => go(home)}>
            ‹
          </a>
          <Logo go={go} height={50} />
        </div>
        <button className="dwal" onClick={() => go("wallet")}>
          👛 Update Client Wallet
        </button>
      </header>
      {/* Tabs ('Service List' goes back to the dashboard) */}
      <nav className="dnav">
        {["Service List", "Point of Sale"].map((t) => (
          <a key={t} className={tab === t ? "on" : ""} onClick={() => (t === "Point of Sale" ? setTab(t) : go(home))}>
            {t}
          </a>
        ))}
        <span className="don">● ONLINE</span>
      </nav>
      {tab === "Service List" ? (
        <div className="wrap">{list}</div>
      ) : (
        <div className="dmain">
          <div className="dhead">
            <div>
              <h2>🏪 Today's Menu</h2>
              <p>Select a meal below to place your order.</p>
            </div>
            <b>{fd.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</b>
          </div>
          {/* Filters: date, meal type, search */}
          <div className="dfil">
            <div>
              <div className="fl">MENU DATE</div>
              <input
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <div className="fl">MEAL TYPE</div>
              <div className="dmt">
                {["All", "Breakfast", "Lunch", "Dinner"].map((t) => (
                  <button key={t} className={type === t ? "on" : ""} onClick={() => setType(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="fl">SEARCH</div>
              <input
                placeholder="🔍  Search meals..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          </div>
          <Status loading={loading} error={error} retry={reload} />
          {/* Meal cards */}
          <div className="dgrid">
            <div className="dmeals">
              {ms.map((m) => (
                <div className="dmc" key={m.id}>
                  <div className="dimg">
                    <MealPhoto meal={m} />
                    <i className="b1">{m.meal_type.toUpperCase()}</i>
                    {m.contractor && <i className="b2">CONTRACTORS</i>}
                  </div>
                  <div className="dbd">
                    <div className="dt">{m.name}</div>
                    <div className="dd">{m.description}</div>
                    <div
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}
                    >
                      <div className="dp">{N(m.price)}</div>
                      <small style={{ color: "var(--mut)" }}>🕒 {fmtTime(m.serve_time)}</small>
                    </div>
                    <button
                      className="dob"
                      onClick={() => {
                        setCart([{ ...m, q: 1 }]);
                        setOpen(true);
                      }}
                    >
                      ✔ Complete Order
                    </button>
                  </div>
                </div>
              ))}
              {data && !ms.length && <p>No meals match.</p>}
            </div>
          </div>
        </div>
      )}
      {/* Confirm pop-up: client company + number of guests */}
      {open && (
        <div className="modal">
          <div className="card" style={{ padding: "34px 28px", width: "100%" }}>
            <div style={{ fontSize: 56 }}>✅</div>
            <h3>Order Ready</h3>
            <p style={{ color: "var(--mut)" }}>Please confirm your order before submitting.</p>
            {client && (
              <div className="f2" style={{ gridTemplateColumns: "1fr 1fr", textAlign: "left", marginBottom: 16 }}>
                <div>
                  <label>Client Company</label>
                  <select value={co} onChange={(e) => setCo(e.target.value)} disabled={!cos.length}>
                    {cos.map((c) => (
                      <option key={c.id}>{c.code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Guests</label>
                  <input type="number" min="1" value={g} onChange={(e) => setG(e.target.value)} />
                </div>
              </div>
            )}
            <button className="btn ol" onClick={() => setOpen(false)} style={{ marginRight: 8 }}>
              Cancel
            </button>
            <button className="btn" style={{ background: "#198754" }} disabled={busy || !co} onClick={confirm}>
              {busy ? "Submitting…" : "Confirm Order"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
