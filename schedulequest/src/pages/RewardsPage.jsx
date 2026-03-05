import { useMemo, useState } from "react";
import {
  activatePowerup,
  buyCosmetic,
  buyPowerup,
  claimDailyChest,
  listCosmetics,
  useTimeWarp
} from "../lib/game";
import { useAppStore } from "../store/AppStore";

export default function RewardsPage() {
  const { userState, updateState, setAppError } = useAppStore();
  const [warpBlockId, setWarpBlockId] = useState("");
  const cosmetics = listCosmetics();

  const incompleteBlocks = useMemo(() => {
    const done = new Set(userState.schedule.completedBlockIds || []);
    return userState.schedule.blocks.filter((block) => !done.has(block.id));
  }, [userState.schedule.blocks, userState.schedule.completedBlockIds]);

  function applyResult(result, notice) {
    if (result?.error) {
      setAppError(result.error);
      return;
    }
    updateState(() => result.state, notice);
  }

  const dailyComplete = userState.daily.quests.every((quest) => quest.done);

  return (
    <section className="page">
      <div className="grid two-col">
        <article className="card">
          <h2>Daily Quests</h2>
          <ul className="list-clean block-list">
            {userState.daily.quests.map((quest) => (
              <li key={quest.id} className="task-row">
                <div>
                  <strong>{quest.title}</strong>
                  <p className="muted">{quest.progress}/{quest.target}</p>
                </div>
                <span className={`pill ${quest.done ? "done" : ""}`}>{quest.done ? "Done" : "In progress"}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={!dailyComplete || userState.daily.chestClaimed}
            onClick={() => applyResult(claimDailyChest(userState), "Daily chest claimed (+75 coins + badge).")}
          >
            {userState.daily.chestClaimed ? "Chest claimed" : "Claim daily chest"}
          </button>
        </article>

        <article className="card">
          <h2>Powerups</h2>
          <ul className="list-clean block-list">
            {userState.powerups.map((powerup) => (
              <li key={powerup.id} className="task-row">
                <div>
                  <strong>{powerup.name}</strong>
                  <p className="muted">{powerup.effect}</p>
                  <p className="muted">Cost: {powerup.cost} | Owned: {powerup.owned}</p>
                  {powerup.activeUntilISO ? <p className="muted">Active until {new Date(powerup.activeUntilISO).toLocaleTimeString()}</p> : null}
                </div>
                <div className="row-actions">
                  <button type="button" onClick={() => applyResult(buyPowerup(userState, powerup.id), `${powerup.name} purchased.`)}>Buy</button>
                  {powerup.kind === "timed" ? (
                    <button type="button" onClick={() => applyResult(activatePowerup(userState, powerup.id), `${powerup.name} activated.`)}>Activate</button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          <div className="sub-card">
            <h3>Use Time Warp</h3>
            <p className="muted">Requires at least 2 completions today.</p>
            <select value={warpBlockId} onChange={(event) => setWarpBlockId(event.target.value)}>
              <option value="">Select a schedule block</option>
              {incompleteBlocks.map((block) => (
                <option key={block.id} value={block.id}>{block.title}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={!warpBlockId}
              onClick={() => applyResult(useTimeWarp(userState, warpBlockId), "Time Warp consumed.")}
            >
              Warp complete
            </button>
          </div>
        </article>
      </div>

      <div className="grid two-col">
        <article className="card">
          <h2>Achievements</h2>
          <ul className="list-clean">
            {Object.entries(userState.achievements).map(([id, info]) => (
              <li key={id} className="task-row">
                <span>{id}</span>
                <span className={`pill ${info.unlocked ? "done" : ""}`}>{info.unlocked ? "Unlocked" : "Locked"}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Badges</h2>
          {userState.inventory.badges.length === 0 ? <p className="muted">No badges yet. Complete tasks and quests for loot drops.</p> : null}
          <div className="badge-grid">
            {userState.inventory.badges.map((badge) => (
              <span key={badge} className="badge-item">{badge}</span>
            ))}
          </div>
        </article>
      </div>

      <article className="card">
        <h2>Cosmetics Shop</h2>
        <ul className="list-clean block-list">
          {cosmetics.map((cosmetic) => {
            const owned = userState.inventory.cosmetics.includes(cosmetic.id);
            return (
              <li key={cosmetic.id} className="task-row">
                <div>
                  <strong>{cosmetic.name}</strong>
                  <p className="muted">Cost: {cosmetic.cost} coins</p>
                </div>
                <button
                  type="button"
                  disabled={owned}
                  onClick={() => applyResult(buyCosmetic(userState, cosmetic.id), `${cosmetic.name} unlocked.`)}
                >
                  {owned ? "Owned" : "Buy cosmetic"}
                </button>
              </li>
            );
          })}
        </ul>
      </article>
    </section>
  );
}
