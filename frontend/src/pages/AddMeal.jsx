import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { meals } from "../api";
import { imageSrc } from "../components/MealPhoto";

// Image upload limits (the server checks these too)
const MAX_MB = 5;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

// Menu Management → Add / Edit meal (edit when opened as /add-meal?id=3), including the meal photo.
export function Add({ go, toast }) {
  // ---- Form state (id is set when editing an existing meal) ----
  const id = useSearchParams()[0].get("id");
  const [f, setF] = useState({
    name: "",
    meal_type: "Lunch",
    package: "Combo",
    location: "Main Restaurant",
    menu_date: "",
    serve_time: "",
    price: "",
    description: "",
    status: "Available",
    for_staff: false,
  });
  const [busy, setBusy] = useState(false);
  // ---- Editing: load the existing meal into the form ----
  useEffect(() => {
    if (id)
      meals
        .get(id)
        .then((m) =>
          setF({
            ...m,
            menu_date: m.menu_date || "",
            serve_time: m.serve_time || "",
            description: m.description || "",
          }),
        )
        .catch((e) => toast(e.message));
  }, [id]);
  // Update one form field
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  // ---- Meal photo: pick a file (checked here), preview it, or remove the current one ----
  // image: file = new upload waiting for Save, cleared = existing photo to remove on Save
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [cleared, setCleared] = useState(false);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  const pick = (e) => {
    const fl = e.target.files[0];
    e.target.value = "";
    if (!fl) return;
    if (!TYPES.includes(fl.type)) return toast("Choose a JPG, PNG or WebP image");
    if (fl.size > MAX_MB * 1024 * 1024) return toast(`Image must be ${MAX_MB} MB or smaller`);
    setFile(fl);
    setPreview(URL.createObjectURL(fl));
    setCleared(false);
  };
  const clearImg = () => {
    setFile(null);
    setPreview(null);
    setCleared(true);
  };
  const shown = preview || (!cleared && imageSrc(f));
  // ---- Save: create/update the meal, then upload or remove its photo, then back to Menu Management ----
  const save = () => {
    if (!f.name) return toast("Meal name is required");
    setBusy(true);
    (id ? meals.update(id, f) : meals.create(f))
      .then((m) => (file ? meals.uploadImage(m.id, file) : cleared && f.image_url ? meals.removeImage(m.id) : m))
      .then(() => {
        toast("Menu saved");
        go("menu");
      })
      .catch((e) => toast(e.message))
      .finally(() => setBusy(false));
  };
  // ---- Render ----
  return (
    <div className="card">
      <div className="f2">
        <div>
          <label>Meal Name *</label>
          <input value={f.name} onChange={s("name")} />
        </div>
        <div>
          <label>Meal Type *</label>
          <select value={f.meal_type} onChange={s("meal_type")}>
            <option>Breakfast</option>
            <option>Lunch</option>
            <option>Dinner</option>
          </select>
        </div>
        <div>
          <label>Package *</label>
          <select value={f.package} onChange={s("package")}>
            <option>Combo</option>
            <option>Standard</option>
            <option>Premium</option>
          </select>
        </div>
        <div>
          <label>Serving Location *</label>
          <select value={f.location} onChange={s("location")}>
            <option>Main Restaurant</option>
            <option>PKL</option>
            <option>VIP Restaurant</option>
          </select>
        </div>
        <div>
          <label>Menu Date (blank = every day)</label>
          <input type="date" value={f.menu_date} onChange={s("menu_date")} />
        </div>
        <div>
          <label>Serving Time</label>
          <input type="time" value={f.serve_time} onChange={s("serve_time")} />
        </div>
        {/* Price only for client meals (staff pay the staff price from Settings) */}
        {!f.for_staff && (
          <div>
            <label>Price (₦)</label>
            <input type="number" value={f.price} onChange={s("price")} />
          </div>
        )}
        <div>
          <label>Menu for *</label>
          <select value={f.for_staff ? "1" : "0"} onChange={(e) => setF({ ...f, for_staff: e.target.value === "1" })}>
            <option value="0">Clients &amp; visitors</option>
            <option value="1">Staff (one per meal time per day)</option>
          </select>
        </div>
        <div>
          <label>Status</label>
          <select value={f.status} onChange={s("status")}>
            <option>Available</option>
            <option>Scheduled</option>
            <option>Unavailable</option>
          </select>
        </div>
        {/* Explains how staff meals work */}
        {f.for_staff && (
          <p style={{ gridColumn: "1/-1", margin: 0, color: "var(--mut)", fontSize: 13 }}>
            Staff get one breakfast, one lunch and one dinner a day. Leave <b>Menu Date</b> blank to make this the
            everyday staff {f.meal_type.toLowerCase()}, or pick a date to replace it on that day only. Employees pay the
            staff {f.meal_type.toLowerCase()} price set in <b>Settings</b>, not a price per dish.
          </p>
        )}
        <div style={{ gridColumn: "1/-1" }}>
          <label>Meal Image</label>
          <div className="imgpick">
            <div className="prev">{shown ? <img src={shown} alt="Meal" /> : <span>{f.emoji || "🍽️"}</span>}</div>
            <div>
              <label
                className="btn ol"
                style={{ display: "inline-block", cursor: "pointer", color: "var(--tx)", fontSize: 14 }}
              >
                📷 {shown ? "Change image" : "Upload image"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={pick}
                  style={{ display: "none" }}
                />
              </label>
              {shown && (
                <button type="button" className="btn rd" style={{ marginLeft: 8 }} onClick={clearImg}>
                  Remove
                </button>
              )}
              <div style={{ color: "var(--mut)", fontSize: 12, marginTop: 6 }}>
                JPG, PNG or WebP, up to {MAX_MB} MB. Shown on Today's Menu.
              </div>
            </div>
          </div>
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label>Meal Description *</label>
          <textarea rows="3" value={f.description} onChange={s("description")} />
        </div>
      </div>
      {/* Cancel / Save */}
      <div style={{ textAlign: "right", marginTop: 18 }}>
        <button className="btn ol" onClick={() => go("menu")} style={{ marginRight: 8 }}>
          Cancel
        </button>
        <button className="btn" disabled={busy} onClick={save}>
          ✓ {id ? "Update" : "Save"} Menu
        </button>
      </div>
    </div>
  );
}
