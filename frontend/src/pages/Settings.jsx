import { useEffect, useState } from "react";
import { Status } from "../components/Status";
import { settings } from "../api";
import { useApi } from "../hooks/useApi";
import { StaffRoles } from "../components/StaffRoles";
import { ord } from "../utils/format";

// Settings page: Staff Roles & Permissions (Administrator only) and the General settings card.

// The top-up deadline is a day of the month; show it on the calendar as that day in the current month (clamped to its length)
const deadlineDate = (day) => {
  const n = new Date(),
    last = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(Math.min(+day || 1, last)).padStart(2, "0")}`;
};

export function Settings({ toast, user }) {
  // ---- Load settings into an editable copy (g) ----
  const { data, loading, error, reload } = useApi(settings.get);
  const [g, setG] = useState({
    topup_deadline_day: 20,
    monthly_wallet_limit: "",
    email_notifications: true,
    staff_price_breakfast: 0,
    staff_price_lunch: 0,
    staff_price_dinner: 0,
  });
  useEffect(() => {
    if (data) setG(data.general);
  }, [data]);
  // ---- Save all general settings (the server checks who may change what) ----
  const save = () =>
    settings
      .save({ general: g })
      .then(() => toast("Settings saved"))
      .catch((e) => toast(e.message));
  // ---- Render ----
  return (
    <>
      <Status loading={loading} error={error} retry={reload} />
      {/* Staff roles, account status and password resets */}
      {user.role === "Administrator" && <StaffRoles me={user} toast={toast} />}
      {/* General: top-up deadline (Administrator / HR Admin only), wallet limit, email notifications */}
      <div className="card">
        <h4 style={{ marginTop: 0 }}>General</h4>
        <div className="f2">
          <div>
            <label>Monthly wallet top-up deadline</label>
            <input
              type="date"
              value={deadlineDate(g.topup_deadline_day)}
              onChange={(e) => e.target.value && setG({ ...g, topup_deadline_day: +e.target.value.slice(8, 10) })}
              disabled={!user.can_set_topup_deadline}
              title={
                user.can_set_topup_deadline
                  ? "Pick the day top-ups close each month"
                  : "Only an Administrator or HR Admin can change this"
              }
            />
            <small style={{ color: "var(--mut)" }}>
              Staff can top up from the 1st until the <b>{ord(g.topup_deadline_day)} of every month</b>
              {g.topup_deadline_day > 28 ? " (or the month's last day if shorter)" : ""}.
              {!user.can_set_topup_deadline && " Only an Administrator or HR Admin can change this."}
            </small>
          </div>
          <div>
            <label>Monthly wallet limit (₦)</label>
            <input
              type="number"
              value={g.monthly_wallet_limit}
              onChange={(e) => setG({ ...g, monthly_wallet_limit: e.target.value })}
            />
          </div>
          <div>
            <label>Email notifications</label>
            <select
              value={g.email_notifications ? "on" : "off"}
              onChange={(e) => setG({ ...g, email_notifications: e.target.value === "on" })}
            >
              <option value="on">Enabled</option>
              <option value="off">Disabled</option>
            </select>
          </div>
        </div>
        {/* Staff meal prices (also charged to contractors) */}
        <h4 style={{ margin: "22px 0 4px" }}>Staff meal prices</h4>
        <p style={{ color: "var(--mut)", margin: "0 0 10px", fontSize: 13 }}>
          What an employee is charged per meal time, whatever the dish. 0 = free (still recorded as the employee's
          order).
        </p>
        <div className="f2">
          {["breakfast", "lunch", "dinner"].map((t) => (
            <div key={t}>
              <label style={{ textTransform: "capitalize" }}>{t} (₦)</label>
              <input
                type="number"
                min="0"
                value={g["staff_price_" + t]}
                onChange={(e) => setG({ ...g, ["staff_price_" + t]: e.target.value })}
              />
            </div>
          ))}
        </div>
        {/* Serving windows for each meal (enforced at the counter) */}
        <h4 style={{ margin: "22px 0 4px" }}>Meal serving times</h4>
        <p style={{ color: "var(--mut)", margin: "0 0 10px", fontSize: 13 }}>
          Meals can only be served during their time, for today (Administrators and PF Admins alike).
        </p>
        <div className="f2">
          {["breakfast", "lunch", "dinner"].map((t) => (
            <div key={t}>
              <label style={{ textTransform: "capitalize" }}>{t}</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="time"
                  value={g[`serve_${t}_start`] || ""}
                  onChange={(e) => setG({ ...g, [`serve_${t}_start`]: e.target.value })}
                  style={{ flex: 1 }}
                />
                <span>to</span>
                <input
                  type="time"
                  value={g[`serve_${t}_end`] || ""}
                  onChange={(e) => setG({ ...g, [`serve_${t}_end`]: e.target.value })}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
          ))}
        </div>
        {/* Save */}
        <div style={{ textAlign: "right", marginTop: 16 }}>
          <button className="btn" onClick={save}>
            Save Changes
          </button>
        </div>
      </div>
    </>
  );
}
