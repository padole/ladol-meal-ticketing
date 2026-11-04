import { Bar } from "../components/TableBar";
import { Status } from "../components/Status";
import { MealPhoto } from "../components/MealPhoto";
import { meals } from "../api";
import { useApi } from "../hooks/useApi";
import { N, fmtDate, fmtTime } from "../utils/format";

// Menu Management: all meals (staff + client), with edit and delete. Staff meals show the staff price.
export function Menu({ go, toast }) {
  // ---- Data ----
  const { data, loading, error, reload } = useApi(() => meals.list());
  const rows = data || [];
  const av = rows.filter((m) => m.status === "Available").length;
  // ---- Delete a meal (after confirmation) ----
  const remove = (m) => {
    if (!confirm(`Delete ${m.name}?`)) return;
    meals
      .remove(m.id)
      .then(() => {
        toast("Meal deleted");
        reload();
      })
      .catch((e) => toast(e.message));
  };
  // ---- Render ----
  return (
    <>
      {/* Summary cards */}
      <div className="stats">
        <div className="card">
          <b>{rows.length}</b>Total Meals
        </div>
        <div className="card">
          <b>{av}</b>Available Today
        </div>
        <div className="card">
          <b>{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}</b>Today's Menu
        </div>
      </div>
      {/* Toolbar: Add New Meal */}
      <Bar ph="Search menu...">
        <button className="btn" onClick={() => go("add")}>
          + Add New Meal
        </button>
      </Bar>
      <Status loading={loading} error={error} retry={reload} />
      {/* Meals table: photo, Staff/Clients, type, place, time, price, status, edit/delete */}
      <div className="card tw">
        <table>
          <thead>
            <tr>
              <th>Meal</th>
              <th>Menu</th>
              <th>Category</th>
              <th>Restaurant</th>
              <th>Time</th>
              <th>Price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>
                  <MealPhoto meal={m} size={44} />
                  <b>{m.name}</b>
                  <br />
                  <small style={{ color: "var(--mut)" }}>{m.description}</small>
                </td>
                <td>
                  <span className={"pill " + (m.for_staff ? "Lunch" : "")}>{m.for_staff ? "Staff" : "Clients"}</span>
                  {m.for_staff && (
                    <>
                      <br />
                      <small style={{ color: "var(--mut)" }}>{m.menu_date ? fmtDate(m.menu_date) : "every day"}</small>
                    </>
                  )}
                </td>
                <td>{m.meal_type}</td>
                <td>{m.location}</td>
                <td>{fmtTime(m.serve_time)}</td>
                <td>
                  {m.for_staff ? (
                    <>
                      {m.staff_price ? N(m.staff_price) : "Free"}
                      <br />
                      <small style={{ color: "var(--mut)" }}>staff price</small>
                    </>
                  ) : (
                    N(m.price)
                  )}
                </td>
                <td>
                  <span className={"pill " + (m.status === "Available" ? "ok" : "sch")}>{m.status}</span>
                </td>
                <td>
                  <button className="ib" onClick={() => go("add", { id: m.id })}>
                    ✏️
                  </button>
                  <button className="ib" onClick={() => remove(m)}>
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
