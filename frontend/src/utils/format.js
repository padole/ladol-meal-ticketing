// Display helpers shared by all pages.

// 1234.5 -> "₦1,234.5"
export const N = (n) => "₦" + Number(n || 0).toLocaleString();

// "2026-10-06" -> "06 Oct 2026"
export const fmtDate = (iso, opts = { day: "2-digit", month: "short", year: "numeric" }) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", opts) : "—";

// "13:00" -> "1:00 PM"
export const fmtTime = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

// Today's date as "YYYY-MM-DD" in the browser's time zone (for <input type="date">)
export const today = () => new Date().toLocaleDateString("en-CA");

// 1 -> "1st", 22 -> "22nd", 13 -> "13th"
export const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
