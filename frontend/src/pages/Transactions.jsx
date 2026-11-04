import { useSearchParams } from "react-router-dom";
import { Bar, Foot } from "../components/TableBar";
import { Status } from "../components/Status";
import { transactions } from "../api";
import { useApi } from "../hooks/useApi";
import { fmtDate } from "../utils/format";

// Transactions: every meal served (optionally for one company, ?company=CODE); admins can delete a row.
export function Tx({ go, toast }) {
  // ---- Data ----
  const co = useSearchParams()[0].get("company");
  const { data, loading, error, reload } = useApi(() => transactions.list({ company: co }), [co]);
  const rows = data || [];
  // ---- Delete a transaction (after confirmation) ----
  const remove = (t) => {
    if (!confirm(`Delete ${t.item} for ${t.customer_name}?`)) return;
    transactions
      .remove(t.id)
      .then(() => {
        toast("Transaction deleted");
        reload();
      })
      .catch((e) => toast(e.message));
  };
  // ---- Render ----
  return (
    <>
      {/* Toolbar (Export / Timesheet not built yet) */}
      <Bar ph="Search by date, name, client or meal type...">
        <button className="btn ol">Export</button>
        <button className="btn ol">Generate Timesheet</button>
      </Bar>
      {co && (
        <p>
          Filtered by <b>{co}</b> ·{" "}
          <a style={{ color: "var(--pri)" }} onClick={() => go("tx")}>
            show all
          </a>
        </p>
      )}
      <Status loading={loading} error={error} retry={reload} />
      {/* Transactions table */}
      <div className="card tw">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Client</th>
              <th>Meal Type</th>
              <th>Item</th>
              <th>Qty</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>{fmtDate(t.date)}</td>
                <td>
                  <b>{t.customer_name}</b>
                </td>
                <td>{t.company}</td>
                <td>
                  <span className={"pill " + t.meal_type}>{t.meal_type}</span>
                </td>
                <td>{t.item}</td>
                <td>
                  <b>{t.quantity}</b>
                </td>
                <td>
                  <button className="ib" style={{ color: "#dc2626" }} onClick={() => remove(t)}>
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Foot n={rows.length} />
      </div>
    </>
  );
}
