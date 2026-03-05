import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateSettings } from "../lib/game";
import { useAppStore } from "../store/AppStore";

export default function SettingsPage() {
  const { userState, updateState, resetAllLocalData } = useAppStore();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    dayStartHour: userState.settings.dayStartHour,
    notifications: userState.settings.notifications,
    theme: userState.settings.theme,
    streakTaskTarget: userState.settings.streakTaskTarget,
    streakFocusMinutes: userState.settings.streakFocusMinutes
  });

  function handleSave(event) {
    event.preventDefault();
    const result = updateSettings(userState, {
      dayStartHour: Math.max(0, Math.min(12, Number(form.dayStartHour))),
      notifications: Boolean(form.notifications),
      theme: form.theme === "light" ? "light" : "dark",
      streakTaskTarget: Math.max(1, Math.min(20, Number(form.streakTaskTarget))),
      streakFocusMinutes: Math.max(5, Math.min(180, Number(form.streakFocusMinutes)))
    });
    updateState(() => result.state, "Settings saved.");
  }

  function handleReset() {
    const confirmed = window.confirm("Delete all local ScheduleQuest data on this device?");
    if (!confirmed) {
      return;
    }
    resetAllLocalData();
    navigate("/auth");
  }

  return (
    <section className="page">
      <article className="card">
        <h2>Settings</h2>
        <form className="inline-grid" onSubmit={handleSave}>
          <label>
            Day start hour
            <input
              type="number"
              min="0"
              max="12"
              value={form.dayStartHour}
              onChange={(event) => setForm((prev) => ({ ...prev, dayStartHour: event.target.value }))}
            />
          </label>
          <label>
            Theme
            <select value={form.theme} onChange={(event) => setForm((prev) => ({ ...prev, theme: event.target.value }))}>
              <option value="dark">dark</option>
              <option value="light">light</option>
            </select>
          </label>
          <label>
            Streak target (tasks)
            <input
              type="number"
              min="1"
              max="20"
              value={form.streakTaskTarget}
              onChange={(event) => setForm((prev) => ({ ...prev, streakTaskTarget: event.target.value }))}
            />
          </label>
          <label>
            Streak target (focus min)
            <input
              type="number"
              min="5"
              max="180"
              value={form.streakFocusMinutes}
              onChange={(event) => setForm((prev) => ({ ...prev, streakFocusMinutes: event.target.value }))}
            />
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={form.notifications}
              onChange={(event) => setForm((prev) => ({ ...prev, notifications: event.target.checked }))}
            />
            Enable notifications (local flag only)
          </label>
          <button type="submit">Save settings</button>
        </form>
      </article>

      <article className="card">
        <h2>Data Management</h2>
        <p className="muted">All accounts and game progress are stored in localStorage only.</p>
        <button type="button" className="danger" onClick={handleReset}>Reset local data</button>
      </article>
    </section>
  );
}
