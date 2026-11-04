// Breadcrumb trail shown above each page title: page key -> [[label, page key], ...]
export const TRAIL = {
  companies: [["Dashboard", "dash"]],
  staff: [
    ["Dashboard", "dash"],
    ["Account Management", "companies"],
  ],
  purchases: [
    ["Dashboard", "dash"],
    ["Account Management", "companies"],
    ["Staff List", "staff"],
  ],
  breakdown: [
    ["Dashboard", "dash"],
    ["Account Management", "companies"],
    ["Staff List", "staff"],
    ["Purchase History", "purchases"],
  ],
  tx: [
    ["Dashboard", "dash"],
    ["Account Management", "companies"],
  ],
  menu: [["Dashboard", "dash"]],
  add: [
    ["Dashboard", "dash"],
    ["Menu Management", "menu"],
  ],
  pos: [["Dashboard", "dash"]],
  client: [["Dashboard", "dash"]],
  report: [["Dashboard", "dash"]],
  wallet: [["Dashboard", "dash"]],
  settings: [["Dashboard", "dash"]],
  profile: [["Dashboard", "dash"]],
  myorders: [
    ["Dashboard", "dash"],
    ["My Profile", "profile"],
  ],
};

// Page titles shown in the blue header
export const TITLE = {
  companies: "🏢 Company Management",
  staff: "👥 Company Staff List",
  purchases: "🧾 Purchase History",
  breakdown: "📊 Break Down",
  tx: "💸 Transactions",
  menu: "📋 Menu Management",
  add: "➕ Add New Menu",
  pos: "🍴 Staff Dining – Point of Sale",
  client: "🍽️ Client Dining Services",
  report: "📈 Reports",
  wallet: "👛 Wallet Approval",
  settings: "⚙️ Settings",
  profile: "👤 My Profile",
  myorders: "🧾 My Orders",
};
