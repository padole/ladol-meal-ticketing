import { useSearchParams } from "react-router-dom";
import { Status } from "../components/Status";
import { staff } from "../api";
import { useApi } from "../hooks/useApi";
import { N, fmtDate } from "../utils/format";

// Account Management → Break Down: items and cost for one staff member (optionally one date / meal time).
export function Breakdown({ go }) {
  // ---- Data: staff id + optional date/meal filters from the URL ----
  const [sp] = useSearchParams();
  const id = sp.get("staff"),
    date = sp.get("date"),
    meal_type = sp.get("meal_type");
  const { data, loading, error, reload } = useApi(
    () => (id ? staff.breakdown(id, { date, meal_type }) : Promise.resolve(null)),
    [id, date, meal_type],
  );
  // ---- Nothing selected yet ----
  if (!id)
    return (
      <p>
        Pick a staff member from the{" "}
        <a style={{ color: "var(--pri)" }} onClick={() => go("staff")}>
          Staff List
        </a>{" "}
        first.
      </p>
    );
  const rows = data?.items || [];
  // ---- Render ----
  return (
    <>
      {data && (
        <p>
          <b>{data.staff.name}</b>
          {date && <> · {fmtDate(date)}</>}
          {meal_type && <> · {meal_type}</>}
        </p>
      )}
      <Status loading={loading} error={error} retry={reload} />
      {/* Items table with a total row */}
      <div className="card tw">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Item</th>
              <th>Quantity</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.meal_type + r.item}>
                <td>
                  <span className={"pill " + r.meal_type}>{r.meal_type}</span>
                </td>
                <td>
                  <b>{r.item}</b>
                </td>
                <td>{r.quantity}</td>
                <td>{N(r.cost)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan="3" style={{ textAlign: "right" }}>
                <b>Total</b>
              </td>
              <td>
                <b>{N(data?.total)}</b>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
