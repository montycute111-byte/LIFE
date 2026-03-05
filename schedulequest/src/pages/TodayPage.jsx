import { useMemo, useState } from "react";
import {
  addScheduleBlock,
  completeScheduleBlock,
  deleteScheduleBlock,
  findScheduleConflicts,
  updateScheduleBlock
} from "../lib/game";
import { minutesFromTimeString, timeStringFromMinutes } from "../lib/date";
import { useAppStore } from "../store/AppStore";

export default function TodayPage() {
  const { userState, updateState, setAppError } = useAppStore();
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    start: "08:00",
    end: "09:00",
    category: "school",
    difficulty: 3,
    repeat: "none"
  });

  const blocks = userState.schedule.blocks || [];
  const conflictIds = useMemo(() => findScheduleConflicts(blocks), [blocks]);
  const completedIds = new Set(userState.schedule.completedBlockIds || []);

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
    applyResult(result, "Plan added.");
    if (!result?.error) {
      setForm((prev) => ({ ...prev, title: "" }));
      setShowPlanForm(false);
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
    applyResult(result, "Plan updated.");
  }

  function handleDeleteBlock(blockId) {
    const confirmed = window.confirm("Delete this plan block?");
    if (!confirmed) {
      return;
    }
    const result = deleteScheduleBlock(userState, blockId);
    applyResult(result, "Plan deleted.");
  }

  if (blocks.length === 0 && !showPlanForm) {
    return (
      <section className="page">
        <article className="card">
          <h2>Today Planner</h2>
          <p className="muted">No plan yet for {userState.schedule.dateISO}.</p>
          <button type="button" onClick={() => setShowPlanForm(true)}>Add new plan</button>
        </article>
      </section>
    );
  }

  return (
    <section className="page">
      <article className="card">
        <h2>Today Planner</h2>
        <p>Date: {userState.schedule.dateISO}</p>

        {!showPlanForm ? (
          <button type="button" onClick={() => setShowPlanForm(true)}>Add new plan</button>
        ) : (
          <form className="inline-grid" onSubmit={handleAddBlock}>
            <input
              required
              placeholder="Plan title"
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
            <div className="row-actions">
              <button type="submit">Save plan</button>
              <button type="button" onClick={() => setShowPlanForm(false)}>Cancel</button>
            </div>
          </form>
        )}

        {conflictIds.size > 0 ? (
          <p className="warning-text">Warning: {conflictIds.size} overlapping block(s).</p>
        ) : null}

        <ul className="list-clean block-list">
          {blocks.map((block) => {
            const done = completedIds.has(block.id);
            return (
              <li
                key={block.id}
                className={`task-row ${conflictIds.has(block.id) ? "is-conflict" : ""}`}
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
                  <button type="button" onClick={() => applyResult(completeScheduleBlock(userState, block.id), "Plan completed.")}>Complete</button>
                </div>
              </li>
            );
          })}
        </ul>
      </article>
    </section>
  );
}
