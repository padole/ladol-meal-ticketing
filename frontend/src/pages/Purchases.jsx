import { useSearchParams } from "react-router-dom";
import { Bar, Foot } from "../components/TableBar";
import { Status } from "../components/Status";
import { staff } from "../api";
import { useApi } from "../hooks/useApi";
import { N, fmtDate, fmtTime } from "../utils/format";

// Account Management → Purchase History: one staff member's meals, grouped by date + meal time.
// Opened from the Staff List (?staff=<id>).
export function Purchases({ go }) {
  // ---- Data: which staff member, and their purchases ----
  const id = useSearchParams()[0].get("staff");
  const { data, loading, error, reload } = useApi(() => (id ? staff.purchases(id) : Promise.resolve(null)), [id]);
  // ---- Nothing selected yet ----
  if (!id)
    return (
      <p>
        Pick a staff member from the{" "}
        <a style={{ color: "var(--pri)" }} onClick={() => go("staff")}>
          Staff List
        </a>{" "}
        to see their purchases.
      </p>
    );
  const rows = data?.purchases || [];
  // ---- Render ----
  return (
    <>
      <Bar ph="Search by meal type, date or customer...">
        <button className="btn ol">⬇ Export</button>
      </Bar>
      {data && (
        <p>
          Purchases for <b>{data.staff.name}</b> ({data.staff.customer_no}, {data.staff.company})
        </p>
      )}
      <Status loading={loading} error={error} retry={reload} />
      {/* Purchases table; the eye button opens the item breakdown for that visit */}
      <div className="card tw">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Meal Type</th>
              <th>Items</th>
              <th>Amount</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.date + p.meal_type}>
                <td>
                  <b>{fmtDate(p.date)}</b>
                  <br />
                  <small style={{ color: "var(--mut)" }}>{fmtTime(p.time)}</small>
                </td>
                <td>
                  <span className={"pill " + p.meal_type}>{p.meal_type}</span>
                </td>
                <td>{p.items}</td>
                <td>{N(p.amount)}</td>
                <td>
                  <button
                    className="ib"
                    onClick={() => go("breakdown", { staff: id, date: p.date, meal_type: p.meal_type })}
                  >
                    👁
                  </button>
                </td>
              </tr>
            ))}
            {data && !rows.length && (
              <tr>
                <td colSpan="5" style={{ textAlign: "center", color: "var(--mut)" }}>
                  No purchases yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Foot n={rows.length} />
      </div>
    </>
  );
}
