import { useState } from "react";
import { orders } from "../api";
import { Status } from "../components/Status";
import { useApi } from "../hooks/useApi";
import { N, fmtDate, fmtTime } from "../utils/format";

// Every meal the logged-in employee has been served, with filters, totals and paging.
export function MyOrders({ go }) {
  // ---- Filters, page number and the API data ----
  const [f, setF] = useState({ from: "", to: "", meal_type: "" });
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi(
    () => orders.history({ ...f, page }),
    [f.from, f.to, f.meal_type, page],
  );
  // ---- Filter helpers (changing a filter goes back to page 1) ----
  const set = (k) => (e) => {
    setF({ ...f, [k]: e.target.value });
    setPage(1);
  };
  const clear = () => {
    setF({ from: "", to: "", meal_type: "" });
    setPage(1);
  };
  // ---- Render ----
  const rows = data?.orders || [];
  const sum = data?.summary;
  return (
    <>
      {/* Totals for the current filter */}
      {sum && (
        <div className="stats">
          <div className="card">
            <b>{sum.count}</b>Meals{f.from || f.to || f.meal_type ? " (filtered)" : ""}
          </div>
          <div className="card">
            <b>{N(sum.amount)}</b>Total paid
          </div>
          {Object.entries(sum.by_meal_type).map(([t, n]) => (
            <div className="card" key={t}>
              <b>{n}</b>
              {t}
            </div>
          ))}
        </div>
      )}
      {/* Filters + back button */}
      <div className="bar">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <div>
            <div className="fl">FROM</div>
            <input type="date" value={f.from} onChange={set("from")} />
          </div>
          <div>
            <div className="fl">TO</div>
            <input type="date" value={f.to} onChange={set("to")} />
          </div>
          <div>
            <div className="fl">MEAL</div>
            <select value={f.meal_type} onChange={set("meal_type")}>
              <option value="">All meals</option>
              <option>Breakfast</option>
              <option>Lunch</option>
              <option>Dinner</option>
            </select>
          </div>
          {(f.from || f.to || f.meal_type) && (
            <button className="btn ol" onClick={clear}>
              Clear
            </button>
          )}
        </div>
        <button className="btn ol" onClick={() => go("profile")}>
          ‹ Back to My Profile
        </button>
      </div>
      <Status loading={loading} error={error} retry={reload} />
      {/* Orders table with Previous/Next paging */}
      <div className="card tw">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Meal</th>
              <th>Item</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>
                  <b>{fmtDate(t.date)}</b>
                </td>
                <td>{fmtTime(t.time)}</td>
                <td>
                  <span className={"pill " + t.meal_type}>{t.meal_type}</span>
                </td>
                <td>{t.item}</td>
                <td style={{ textAlign: "right" }}>{t.amount ? N(t.amount) : "Free"}</td>
              </tr>
            ))}
            {data && !rows.length && (
              <tr>
                <td colSpan="5" style={{ textAlign: "center", color: "var(--mut)" }}>
                  {f.from || f.to || f.meal_type ? "No orders match these filters." : "No orders yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {data && data.pages > 1 && (
          <div className="pg">
            <span>
              Page {data.page} of {data.pages}
            </span>
            <span>
              <button
                className="btn ol"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                style={{ marginRight: 6 }}
              >
                ‹ Previous
              </button>
              <button className="btn ol" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
                Next ›
              </button>
            </span>
          </div>
        )}
      </div>
    </>
  );
}
