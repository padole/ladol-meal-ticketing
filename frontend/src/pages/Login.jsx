import { useState } from "react";
import { auth } from "../api";
import { homeFor } from "../router/routes";

// Login form. Step 1: employee no.  Step 2: password, or "create password" on first login (surname check).
export function Login({ go, setUser }) {
  // ---- State: which step we're on, the form fields, error text and a busy flag ----
  const [step, setStep] = useState("id"); // id | password | create
  const [f, setF] = useState({ no: "", sn: "", p: "", p2: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // ---- Helpers: update a field; run an API call showing errors; finish by going to the user's home page ----
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const run = (p) => {
    setErr("");
    setBusy(true);
    return p.catch((x) => setErr(x.message)).finally(() => setBusy(false));
  };
  const done = (u) => {
    setUser(u);
    go(homeFor(u));
  };
  // ---- Submit: step 1 looks up the employee no.; step 2 logs in, or (first login) creates the password ----
  const submit = (e) => {
    e.preventDefault();
    if (step === "id") return run(auth.lookup(f.no).then((r) => setStep(r.needs_password ? "create" : "password")));
    if (step === "password") return run(auth.login(f.no, f.p).then(done));
    if (!f.sn.trim()) return setErr("Enter your surname");
    if (f.p.length < 8) return setErr("Password must be at least 8 characters");
    if (f.p !== f.p2) return setErr("Passwords do not match");
    run(auth.setupPassword(f.no, f.sn, f.p).then(done));
  };
  // ---- Back to step 1 (different employee no.) ----
  const back = () => {
    setStep("id");
    setF({ ...f, sn: "", p: "", p2: "" });
    setErr("");
  };
  // ---- Render ----
  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        {/* Logo + heading */}
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <img src="/images/ladol-logo.jpg" alt="LADOL" style={{ height: 60 }} />
          <h3 style={{ margin: "8px 0 2px" }}>{step === "create" ? "Create your password" : "Welcome Back"}</h3>
          <span style={{ color: "var(--mut)" }}>
            {step === "create"
              ? "First time here? Confirm your surname and choose a password."
              : "Sign in to the Service Portal"}
          </span>
        </div>
        {/* Step 1: employee no. (locked once we move to step 2) */}
        <input
          placeholder="Enter Employee no."
          autoComplete="username"
          value={f.no}
          onChange={s("no")}
          disabled={step !== "id"}
          autoFocus
          style={{ textTransform: "uppercase" }}
        />
        {/* Step 2a: password (returning user) */}
        {step === "password" && (
          <input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={f.p}
            onChange={s("p")}
            autoFocus
          />
        )}
        {/* Step 2b: first login - surname check + new password twice */}
        {step === "create" && (
          <>
            <input
              placeholder="Surname (as on your staff record)"
              autoComplete="family-name"
              value={f.sn}
              onChange={s("sn")}
              autoFocus
            />
            <input
              type="password"
              placeholder="New password (min. 8 characters)"
              autoComplete="new-password"
              value={f.p}
              onChange={s("p")}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              autoComplete="new-password"
              value={f.p2}
              onChange={s("p2")}
            />
          </>
        )}
        {/* Error message, main button and secondary links */}
        {err && <p style={{ color: "#dc2626", margin: "0 0 8px" }}>{err}</p>}
        <button className="btn" disabled={busy || !f.no.trim()}>
          {busy
            ? "Please wait…"
            : step === "id"
              ? "Continue"
              : step === "create"
                ? "Create password & sign in"
                : "Login"}
        </button>
        {step !== "id" && (
          <button type="button" className="btn ol" onClick={back}>
            ‹ Use a different employee no.
          </button>
        )}
        {step === "password" && (
          <p style={{ color: "var(--mut)", fontSize: 12, textAlign: "center", margin: "12px 0 0" }}>
            Forgot your password? Ask the canteen admin to reset it.
          </p>
        )}
      </form>
    </div>
  );
}
