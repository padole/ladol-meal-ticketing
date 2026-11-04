import { useState } from "react";
import { Status } from "../components/Status";
import { reports } from "../api";
import { useApi } from "../hooks/useApi";
import { N } from "../utils/format";

// Reports: meals served, revenue, active staff and a per-company breakdown for the last 7/30/90 days.

// Bar colour per meal time
const COLORS = { Breakfast: "#f59e0b", Lunch: "#3b82f6", Dinner: "#8b5cf6" };

export function Report() {
  // ---- Data for the chosen period ----
  const [r, setR] = useState("7");
  const { data, loading, error, reload } = useApi(() => reports.summary(r), [r]);
  const by = data?.by_meal_type || [];
  const mx = Math.max(1, ...by.map((x) => x.count));
  // ---- Render ----
  return (
    <>
      {/* Period picker (Export not built yet) */}
      <div className="bar">
        <select value={r} onChange={(e) => setR(e.target.value)}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
        <button className="btn ol">⬇ Export Report</button>
      </div>
      <Status loading={loading} error={error} retry={reload} />
      {data && (
        <>
          {/* Headline numbers */}
          <div className="stats">
            <div className="card">
              <b>{data.meals_served.toLocaleString()}</b>Meals served
            </div>
            <div className="card">
              <b>{N(data.revenue)}</b>Revenue
            </div>
            <div className="card">
              <b>{data.active_staff}</b>Active staff
            </div>
            <div className="card">
              <b>{N(Math.round(data.avg_meal_value))}</b>Avg. meal value
            </div>
          </div>
          <div className="f2">
            {/* Bar chart: meals by meal time */}
            <div className="card">
              <h4 style={{ marginTop: 0 }}>Meals by type</h4>
              {by.map(({ meal_type: n, count: v }) => (
                <div key={n} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{n}</span>
                    <b>{v.toLocaleString()}</b>
                  </div>
                  <div style={{ background: "var(--soft)", borderRadius: 8, height: 14 }}>
                    <div style={{ width: (v / mx) * 100 + "%", background: COLORS[n], height: 14, borderRadius: 8 }} />
                  </div>
                </div>
              ))}
            </div>
            {/* Companies with staff or meals in the period */}
            <div className="card tw">
              <h4 style={{ marginTop: 0 }}>By client company</h4>
              <table style={{ minWidth: 0 }}>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Staff</th>
                    <th>Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_company.map((c) => (
                    <tr key={c.company}>
                      <td>
                        <b>{c.company}</b> <small style={{ color: "var(--mut)" }}>{c.name}</small>
                      </td>
                      <td>{c.staff}</td>
                      <td>{c.transactions}</td>
                    </tr>
                  ))}
                  {!data.by_company.length && (
                    <tr>
                      <td colSpan="3" style={{ textAlign: "center", color: "var(--mut)" }}>
                        No company activity in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
