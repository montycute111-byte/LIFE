import { addDays, toDateISO } from "../lib/date";
import { xpToNextLevel } from "../lib/game";
import { useAppStore } from "../store/AppStore";

export default function StatsPage() {
  const { userState } = useAppStore();
  const today = toDateISO();

  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const dateISO = addDays(today, -i);
    days.push({
      dateISO,
      completions: Number(userState.history.completionsByDate[dateISO] || 0),
      focus: Number(userState.history.focusMinutesByDate[dateISO] || 0)
    });
  }

  const maxCompletion = Math.max(1, ...days.map((day) => day.completions));
  const maxFocus = Math.max(1, ...days.map((day) => day.focus));

  return (
    <section className="page">
      <div className="grid two-col">
        <article className="card">
          <h2>Progress</h2>
          <p>Level: {userState.stats.level}</p>
          <p>XP: {userState.stats.xp}/{xpToNextLevel(userState.stats.level)}</p>
          <p>Coins: {userState.stats.coins}</p>
          <p>Streak: {userState.stats.streakDays} day(s)</p>
          <p>Total completions: {userState.stats.totalCompleted}</p>
          <p>Perfect days: {userState.stats.perfectDays}</p>
        </article>

        <article className="card">
          <h2>Streak Rules</h2>
          <p>
            Daily streak advances if you finish at least
            {" "}<strong>{userState.settings.streakTaskTarget}</strong> tasks
            {" "}or <strong>{userState.settings.streakFocusMinutes}</strong> focus minutes.
          </p>
          <p className="muted">Missed days reset streak unless a Streak Shield is available (once per week).</p>
        </article>
      </div>

      <article className="card">
        <h2>Last 7 Days</h2>
        <div className="stat-grid">
          {days.map((day) => (
            <div key={day.dateISO} className="stat-row">
              <div>
                <strong>{day.dateISO}</strong>
                <p className="muted">{day.completions} completions, {day.focus} focus min</p>
              </div>
              <div className="bars">
                <div className="bar bar-complete" style={{ width: `${(day.completions / maxCompletion) * 100}%` }} />
                <div className="bar bar-focus" style={{ width: `${(day.focus / maxFocus) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
