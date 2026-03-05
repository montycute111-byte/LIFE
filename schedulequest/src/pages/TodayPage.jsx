import { useEffect, useMemo, useState } from "react";
import {
  addScheduleBlock,
  completeScheduleBlock,
  currentBlock,
  deleteScheduleBlock,
  findScheduleConflicts,
  generateSuggestedBlocks,
  logFocusMinutes,
  updateScheduleBlock
} from "../lib/game";
import { minutesFromTimeString, timeStringFromMinutes } from "../lib/date";
import { useAppStore } from "../store/AppStore";

const GOAL_OPTIONS = ["school", "cleaning", "exercise", "hobbies"];

export default function TodayPage() {
  const { userState, updateState, setAppError } = useAppStore();
  const [form, setForm] = useState({
    title: "",
    start: "08:00",
    end: "09:00",
    category: "school",
    difficulty: 3,
    repeat: "none"
  });
  const [generator, setGenerator] = useState({
    startHour: 8,
    endHour: 20,
    goals: ["school", "exercise"]
  });
  const [focus, setFocus] = useState({ running: false, blockId: null, startedAt: 0, elapsedSec: 0 });

  const blocks = userState.schedule.blocks || [];
  const conflictIds = useMemo(() => findScheduleConflicts(blocks), [blocks]);
  const current = useMemo(() => currentBlock(userState), [userState]);

  useEffect(() => {
    if (!focus.running) {
      return undefined;
    }
    const timer = setInterval(() => {
      setFocus((prev) => ({ ...prev, elapsedSec: Math.floor((Date.now() - prev.startedAt) / 1000) }));
    }, 1000);
    return () => clearInterval(timer);
  }, [focus.running]);

  function applyResult(result, successNotice) {
    if (result?.error) {
      setAppError(result.error);
      return;
    }
    updateState(() => result.state, successNotice);
  }

  function handleAddBlock(event) {
    event.preventDefault();
    const result = addScheduleBlock(userState, {
      title: form.title,
      startMin: minutesFromTimeString(form.start),
      endMin: minutesFromTimeString(form.end),
      category: form.category,
      difficulty: Number(form.difficulty),
      repeat: form.repeat
    });
    applyResult(result, "Schedule block added.");
    if (!result?.error) {
      setForm((prev) => ({ ...prev, title: "" }));
    }
  }

  function handleEditBlock(block) {
    const startInput = window.prompt("Start time (HH:MM)", timeStringFromMinutes(block.startMin));
    const endInput = window.prompt("End time (HH:MM)", timeStringFromMinutes(block.endMin));
    if (!startInput || !endInput) {
      return;
    }
    const result = updateScheduleBlock(userState, block.id, {
      startMin: minutesFromTimeString(startInput),
      endMin: minutesFromTimeString(endInput)
    });
    applyResult(result, "Schedule block updated.");
  }

  function handleDeleteBlock(blockId) {
    const confirmed = window.confirm("Delete this schedule block?");
    if (!confirmed) {
      return;
    }
    const result = deleteScheduleBlock(userState, blockId);
    applyResult(result, "Schedule block deleted.");
  }

  function handleGenerateSchedule() {
    const suggested = generateSuggestedBlocks(generator);
    updateState((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        blocks: suggested,
        completedBlockIds: []
      }
    }), "Generated schedule with balanced blocks.");
  }

  function toggleGoal(goal) {
    setGenerator((prev) => {
      const has = prev.goals.includes(goal);
      const goals = has ? prev.goals.filter((item) => item !== goal) : [...prev.goals, goal];
      return { ...prev, goals: goals.length ? goals : [goal] };
    });
  }

  function startFocusTimer(blockId) {
    setFocus({ running: true, blockId, startedAt: Date.now(), elapsedSec: 0 });
  }

  function stopFocusTimer() {
    if (!focus.running) {
      return;
    }
    const minutes = Math.max(1, Math.round(focus.elapsedSec / 60));
    const result = logFocusMinutes(userState, minutes, focus.blockId);
    applyResult(result, `Focus session logged (${minutes} min).`);
    setFocus({ running: false, blockId: null, startedAt: 0, elapsedSec: 0 });
  }

  const dayStartHour = Number(userState.settings.dayStartHour || 6);
  const hours = Array.from({ length: 24 - dayStartHour }, (_, index) => dayStartHour + index);
  const completedIds = new Set(userState.schedule.completedBlockIds || []);

  return (
    <section className="page">
      <div className="grid two-col">
        <article className="card">
          <h2>Today Planner</h2>
          <p>Date: {userState.schedule.dateISO}</p>
          <form className="inline-grid" onSubmit={handleAddBlock}>
            <input
              required
              placeholder="Block title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
            <input
              type="time"
              value={form.start}
              onChange={(event) => setForm((prev) => ({ ...prev, start: event.target.value }))}
            />
            <input
              type="time"
              value={form.end}
              onChange={(event) => setForm((prev) => ({ ...prev, end: event.target.value }))}
            />
            <input
              placeholder="Category"
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
            />
            <select
              value={form.difficulty}
              onChange={(event) => setForm((prev) => ({ ...prev, difficulty: event.target.value }))}
            >
              {[1, 2, 3, 4, 5].map((level) => (
                <option key={level} value={level}>Difficulty {level}</option>
              ))}
            </select>
            <select
              value={form.repeat}
              onChange={(event) => setForm((prev) => ({ ...prev, repeat: event.target.value }))}
            >
              <option value="none">No repeat</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
            </select>
            <button type="submit">Add block</button>
          </form>

          {conflictIds.size > 0 ? (
            <p className="warning-text">Warning: {conflictIds.size} block(s) overlap.</p>
          ) : (
            <p className="muted">No schedule conflicts detected.</p>
          )}

          <ul className="list-clean block-list">
            {blocks.length === 0 ? <li className="muted">No blocks yet.</li> : null}
            {blocks.map((block) => {
              const done = completedIds.has(block.id);
              const isCurrent = current?.id === block.id;
              return (
                <li
                  key={block.id}
                  className={`task-row ${isCurrent ? "is-current" : ""} ${conflictIds.has(block.id) ? "is-conflict" : ""}`}
                >
                  <div>
                    <p>
                      <strong>{block.title}</strong>
                      {done ? <span className="pill done">Done</span> : null}
                    </p>
                    <p className="muted">
                      {timeStringFromMinutes(block.startMin)} - {timeStringFromMinutes(block.endMin)}
                      {" "}({block.category}, d{block.difficulty})
                    </p>
                  </div>
                  <div className="row-actions">
                    <button type="button" onClick={() => handleEditBlock(block)}>Edit</button>
                    <button type="button" onClick={() => handleDeleteBlock(block.id)}>Delete</button>
                    <button type="button" onClick={() => applyResult(completeScheduleBlock(userState, block.id), "Block completed.")}>Complete</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </article>

        <article className="card">
          <h2>Follow Mode</h2>
          {current ? (
            <div className="focus-box">
              <p className="pill">Current block</p>
              <h3>{current.title}</h3>
              <p>{timeStringFromMinutes(current.startMin)} - {timeStringFromMinutes(current.endMin)}</p>
              {!focus.running ? (
                <button type="button" className="primary" onClick={() => startFocusTimer(current.id)}>
                  Start Focus
                </button>
              ) : (
                <>
                  <p className="focus-time">{Math.floor(focus.elapsedSec / 60)}m {focus.elapsedSec % 60}s</p>
                  <button type="button" onClick={stopFocusTimer}>Stop Focus</button>
                </>
              )}
            </div>
          ) : (
            <p className="muted">No active block right now.</p>
          )}

          <h3>Generate schedule</h3>
          <div className="inline-grid">
            <label>
              Start hour
              <input
                type="number"
                min="0"
                max="23"
                value={generator.startHour}
                onChange={(event) => setGenerator((prev) => ({ ...prev, startHour: Number(event.target.value) }))}
              />
            </label>
            <label>
              End hour
              <input
                type="number"
                min="1"
                max="24"
                value={generator.endHour}
                onChange={(event) => setGenerator((prev) => ({ ...prev, endHour: Number(event.target.value) }))}
              />
            </label>
            <div>
              <p className="muted">Goals</p>
              <div className="pill-row">
                {GOAL_OPTIONS.map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    className={generator.goals.includes(goal) ? "pill active" : "pill"}
                    onClick={() => toggleGoal(goal)}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" onClick={handleGenerateSchedule}>Generate schedule</button>
          </div>
        </article>
      </div>

      <article className="card">
        <h2>Timeline</h2>
        <div className="timeline">
          {hours.map((hour) => (
            <div key={hour} className="timeline-row">
              <span className="timeline-hour">{String(hour).padStart(2, "0")}:00</span>
              <div className="timeline-content">
                {blocks
                  .filter((block) => Math.floor(block.startMin / 60) === hour)
                  .map((block) => (
                    <span key={block.id} className={`timeline-chip ${completedIds.has(block.id) ? "done" : ""}`}>
                      {timeStringFromMinutes(block.startMin)} {block.title}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
