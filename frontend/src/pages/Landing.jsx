// Public front page (/) - "Login" opens the sign-in form at /login.
export function Landing({ go }) {
  return (
    <div className="land">
      {/* White top bar with the logo */}
      <header className="land-top">
        <img src="/images/ladol-logo.jpg" alt="LADOL" />
      </header>
      {/* Full-screen photo with the headline, tagline and Login button */}
      <section className="land-hero">
        <div className="land-copy">
          <h1>Dining Connect Pro.</h1>
          <p>We are focused on providing you with the highest level of quality and excellent customer support</p>
          <button onClick={() => go("login")}>Login</button>
        </div>
      </section>
    </div>
  );
}
