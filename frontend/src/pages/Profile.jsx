import { useState } from "react";
import { auth, orders, wallet } from "../api";
import { Status } from "../components/Status";
import { useApi } from "../hooks/useApi";
import { N, fmtDate, ord } from "../utils/format";

// My Profile (everyone's home page for staff): wallet balance + top up, links to My Orders / Today's Menu,
// personal details, change password and the 20 most recent orders.
export function Profile({ go, user, toast }) {
  // ---- State + API data (recent orders, wallet) ----
  const [pw, setPw] = useState({ cur: "", new: "" });
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = useApi(orders.mine);
  const w = useApi(wallet.me);
  // Avatar letters, e.g. "Jane Doe" -> "JD"
  const initials = user.full_name
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2);
  // ---- Change password ----
  const update = () =>
    auth
      .changePassword(pw.cur, pw.new)
      .then(() => {
        setPw({ cur: "", new: "" });
        toast("Password updated");
      })
      .catch((e) => toast(e.message));
  // ---- Top up wallet (closed after the monthly deadline; the server checks too) ----
  const topup = () => {
    if (!(+amt > 0)) return toast("Enter an amount");
    setBusy(true);
    wallet
      .topUp(+amt)
      .then((r) => {
        setOpen(false);
        setAmt("");
        toast(`Wallet topped up: ${N(r.topup.amount)}. New balance ${N(r.balance)}`);
        w.reload();
      })
      .catch((e) => toast(e.message))
      .finally(() => setBusy(false));
  };
  // ---- Render ----
  return (
    <>
      {/* Wallet card: balance, deadline note and the three main buttons */}
      <div className="card wal">
        <div>
          <div className="fl">WALLET BALANCE</div>
          <div className="bal">{w.data ? N(w.data.balance) : "…"}</div>
          {w.data && (
            <small style={{ color: w.data.topup_open ? "var(--mut)" : "#dc2626", display: "block" }}>
              {w.data.topup_open
                ? `Top-ups are open until the ${ord(w.data.topup_deadline_day)} of this month.`
                : `Top-ups for this month closed on the ${ord(w.data.topup_deadline_day)}. It will be reopen on the 1st.`}
            </small>
          )}
          <Status loading={false} error={w.error} retry={w.reload} />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn ol"
            onClick={() => setOpen(true)}
            disabled={w.data && !w.data.topup_open}
            title={
              w.data && !w.data.topup_open
                ? `Top-ups close on the ${ord(w.data.topup_deadline_day)} of each month`
                : undefined
            }
          >
            👛 Top up wallet
          </button>
          <button className="btn ol" onClick={() => go("myorders")}>
            🧾 My Orders
          </button>
          <button className="btn" onClick={() => go("pos")}>
            🍽️ Today's Menu
          </button>
        </div>
      </div>
      {/* Left: personal details. Right: change password + recent orders */}
      <div className="f2" style={{ alignItems: "start" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <span className="av" style={{ width: 90, height: 90, fontSize: 30, background: "#0d6efd", margin: 0 }}>
            {initials}
          </span>
          <h3 style={{ marginBottom: 2 }}>{user.full_name}</h3>
          <span className="pill Lunch">{user.role}</span>
          <div style={{ textAlign: "left", marginTop: 18, lineHeight: 2 }}>
            {user.job_title && (
              <>
                💼 {user.job_title}
                <br />
              </>
            )}
            📧 {user.email || "—"}
            <br />
            🏢 {user.department || user.company || "—"}
            <br />
            🆔 {user.employee_no || "—"}
            <br />
            📞 {user.phone || "—"}
          </div>
        </div>
        <div>
          {/* Change password */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ marginTop: 0 }}>Change Password</h4>
            <div className="f2">
              <div>
                <label>Current</label>
                <input type="password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} />
              </div>
              <div>
                <label>New</label>
                <input type="password" value={pw.new} onChange={(e) => setPw({ ...pw, new: e.target.value })} />
              </div>
            </div>
            <div style={{ textAlign: "right", marginTop: 14 }}>
              <button className="btn" onClick={update}>
                Update
              </button>
            </div>
          </div>
          <div className="card">
            <h4 style={{ marginTop: 0, display: "flex", justifyContent: "space-between" }}>
              My Recent Orders
              <a style={{ color: "var(--pri)", fontWeight: 400, fontSize: 13 }} onClick={() => go("myorders")}>
                View all ›
              </a>
            </h4>
            <Status loading={mine.loading} error={mine.error} retry={mine.reload} />
            {(mine.data || []).map((t) => (
              <div
                key={t.id}
                style={{
                  padding: "9px 0",
                  borderBottom: "1px solid var(--bd)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <span>
                  {t.quantity}× <b>{t.item}</b>
                  <br />
                  <small style={{ color: "var(--mut)" }}>
                    {fmtDate(t.date)} · {t.meal_type}
                  </small>
                </span>
                <span>{N(t.amount)}</span>
              </div>
            ))}
            {mine.data && !mine.data.length && (
              <p style={{ color: "var(--mut)" }}>
                No orders yet. Tap <b>Today's Menu</b> to place one.
              </p>
            )}
          </div>
        </div>
      </div>
      {/* Top-up pop-up */}
      {open && (
        <div className="modal">
          <div className="card" style={{ textAlign: "left", width: "100%" }}>
            <h3 style={{ marginTop: 0 }}>Top up wallet</h3>
            <p style={{ color: "var(--mut)", marginTop: 0 }}>The amount is added to your balance straight away.</p>
            <div className="f2" style={{ gridTemplateColumns: "1fr" }}>
              <div>
                <label>Amount (₦)</label>
                <input type="number" min="1" value={amt} onChange={(e) => setAmt(e.target.value)} autoFocus />
              </div>
            </div>
            {w.data?.monthly_limit > 0 && (
              <small style={{ color: "var(--mut)" }}>Monthly limit: {N(w.data.monthly_limit)}</small>
            )}
            {w.data?.history?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <b style={{ fontSize: 12 }}>Recent top-ups</b>
                {w.data.history.slice(0, 5).map((t) => (
                  <div key={t.id} style={{ fontSize: 13, color: "var(--mut)" }}>
                    {fmtDate(t.date)} · {N(t.amount)}
                  </div>
                ))}
              </div>
            )}
            <div style={{ textAlign: "right", marginTop: 16 }}>
              <button className="btn ol" onClick={() => setOpen(false)} style={{ marginRight: 8 }}>
                Cancel
              </button>
              <button className="btn gr" disabled={busy} onClick={topup}>
                {busy ? "Topping up…" : "Top up"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
