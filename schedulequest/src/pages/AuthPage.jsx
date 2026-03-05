import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppStore } from "../store/AppStore";

export default function AuthPage() {
  const { accounts, activeUser, signUp, login, continueAsGuest, error, notice } = useAppStore();
  const [loginForm, setLoginForm] = useState({ username: "", secret: "" });
  const [signupForm, setSignupForm] = useState({ username: "", secret: "" });
  const navigate = useNavigate();

  async function handleLogin(event) {
    event.preventDefault();
    const ok = await login(loginForm.username, loginForm.secret);
    if (ok) {
      navigate("/today");
    }
  }

  async function handleSignup(event) {
    event.preventDefault();
    const ok = await signUp(signupForm.username, signupForm.secret);
    if (ok) {
      navigate("/today");
    }
  }

  async function handleGuest() {
    await continueAsGuest();
    navigate("/today");
  }

  return (
    <main className="auth-page">
      <section className="hero-card">
        <h1>ScheduleQuest</h1>
        <p>Plan your day, finish tasks, level up, and keep every bit of progress on this device.</p>
        {activeUser ? <Link to="/today" className="ghost-link">Continue as {activeUser}</Link> : null}
      </section>

      {(error || notice) ? (
        <section className="flash-row standalone">
          {error ? <p className="flash flash-error">{error}</p> : null}
          {notice ? <p className="flash flash-notice">{notice}</p> : null}
        </section>
      ) : null}

      <section className="auth-grid">
        <form className="card" onSubmit={handleLogin}>
          <h2>Login</h2>
          <label>
            Username
            <input
              required
              value={loginForm.username}
              onChange={(event) => setLoginForm((prev) => ({ ...prev, username: event.target.value }))}
              placeholder="username"
            />
          </label>
          <label>
            Password or PIN
            <input
              type="password"
              value={loginForm.secret}
              onChange={(event) => setLoginForm((prev) => ({ ...prev, secret: event.target.value }))}
              placeholder="optional"
            />
          </label>
          <button type="submit">Login</button>
        </form>

        <form className="card" onSubmit={handleSignup}>
          <h2>Sign Up</h2>
          <label>
            Username
            <input
              required
              value={signupForm.username}
              onChange={(event) => setSignupForm((prev) => ({ ...prev, username: event.target.value }))}
              placeholder="new username"
            />
          </label>
          <label>
            Password or PIN (optional)
            <input
              type="password"
              value={signupForm.secret}
              onChange={(event) => setSignupForm((prev) => ({ ...prev, secret: event.target.value }))}
              placeholder="empty is allowed"
            />
          </label>
          <button type="submit">Create account</button>
          <p className="hint">PINs must be 4-8 digits if numeric.</p>
        </form>
      </section>

      <section className="card compact">
        <h3>Guest mode</h3>
        <p>Creates a local account like <code>guest_4821</code>.</p>
        <button type="button" onClick={handleGuest}>Continue as guest</button>
      </section>

      <section className="card compact">
        <h3>Accounts on this device</h3>
        {Object.keys(accounts).length === 0 ? <p>No local accounts yet.</p> : (
          <ul className="list-clean">
            {Object.keys(accounts).sort().map((username) => (
              <li key={username} className="task-row">
                <span>{username}</span>
                <button
                  type="button"
                  onClick={() => setLoginForm((prev) => ({ ...prev, username }))}
                >
                  Use
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
