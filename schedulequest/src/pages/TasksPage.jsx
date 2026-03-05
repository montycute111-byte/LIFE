import { useMemo, useState } from "react";
import { addTask, deleteTask, getDoNextTask, setTaskStatus, updateTask } from "../lib/game";
import { useAppStore } from "../store/AppStore";

const INITIAL_FORM = {
  title: "",
  notes: "",
  category: "school",
  dueDateISO: "",
  repeat: "none",
  estMin: 30,
  difficulty: 3
};

export default function TasksPage() {
  const { userState, updateState, setAppError } = useAppStore();
  const [form, setForm] = useState(INITIAL_FORM);
  const [quickTitle, setQuickTitle] = useState("");
  const [filters, setFilters] = useState({ category: "all", status: "all" });

  const categories = useMemo(() => {
    const found = new Set(userState.tasks.map((task) => task.category));
    return ["all", ...Array.from(found).sort()];
  }, [userState.tasks]);

  const filteredTasks = useMemo(() => {
    return userState.tasks.filter((task) => {
      if (filters.category !== "all" && task.category !== filters.category) {
        return false;
      }
      if (filters.status !== "all" && task.status !== filters.status) {
        return false;
      }
      return true;
    });
  }, [userState.tasks, filters]);

  function applyResult(result, notice) {
    if (result?.error) {
      setAppError(result.error);
      return;
    }
    updateState(() => result.state, notice);
  }

  function handleAdd(event) {
    event.preventDefault();
    const result = addTask(userState, {
      title: form.title,
      notes: form.notes,
      category: form.category,
      dueDateISO: form.dueDateISO || null,
      repeat: form.repeat,
      estMin: Number(form.estMin),
      difficulty: Number(form.difficulty),
      status: "todo"
    });
    applyResult(result, "Task added.");
    if (!result?.error) {
      setForm(INITIAL_FORM);
    }
  }

  function handleQuickAdd(event) {
    event.preventDefault();
    if (!quickTitle.trim()) {
      return;
    }
    const result = addTask(userState, {
      title: quickTitle,
      category: "general",
      repeat: "none",
      estMin: 20,
      difficulty: 2,
      status: "todo"
    });
    applyResult(result, "Quick task added.");
    if (!result?.error) {
      setQuickTitle("");
    }
  }

  function handleEdit(task) {
    const title = window.prompt("Task title", task.title);
    if (!title) {
      return;
    }
    const notes = window.prompt("Notes", task.notes || "") ?? task.notes;
    const result = updateTask(userState, task.id, { title, notes });
    applyResult(result, "Task updated.");
  }

  function handleDoNext() {
    const nextTask = getDoNextTask(userState, { category: filters.category });
    if (!nextTask) {
      setAppError("No available task for current filters.");
      return;
    }
    const result = setTaskStatus(userState, nextTask.id, "doing");
    applyResult(result, `Do next: ${nextTask.title}`);
  }

  return (
    <section className="page">
      <div className="grid two-col">
        <article className="card">
          <h2>Add Task</h2>
          <form className="inline-grid" onSubmit={handleAdd}>
            <input
              required
              placeholder="Task title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
            <textarea
              placeholder="Notes"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
            <input
              placeholder="Category"
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
            />
            <label>
              Due date
              <input
                type="date"
                value={form.dueDateISO}
                onChange={(event) => setForm((prev) => ({ ...prev, dueDateISO: event.target.value }))}
              />
            </label>
            <select value={form.repeat} onChange={(event) => setForm((prev) => ({ ...prev, repeat: event.target.value }))}>
              <option value="none">No repeat</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option>
            </select>
            <label>
              Est minutes
              <input
                type="number"
                min="5"
                max="480"
                value={form.estMin}
                onChange={(event) => setForm((prev) => ({ ...prev, estMin: event.target.value }))}
              />
            </label>
            <label>
              Difficulty
              <input
                type="number"
                min="1"
                max="5"
                value={form.difficulty}
                onChange={(event) => setForm((prev) => ({ ...prev, difficulty: event.target.value }))}
              />
            </label>
            <button type="submit">Add task</button>
          </form>
        </article>

        <article className="card">
          <h2>Quick Add</h2>
          <form className="row-inline" onSubmit={handleQuickAdd}>
            <input
              placeholder="clean room"
              value={quickTitle}
              onChange={(event) => setQuickTitle(event.target.value)}
            />
            <button type="submit">Add</button>
          </form>
          <button type="button" onClick={handleDoNext}>Do next</button>
          <p className="muted">Do next weighs due date, difficulty, streak pressure, and category repetition.</p>
        </article>
      </div>

      <article className="card">
        <h2>Tasks</h2>
        <div className="filter-row">
          <label>
            Category
            <select value={filters.category} onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="all">all</option>
              <option value="todo">todo</option>
              <option value="doing">doing</option>
              <option value="done">done</option>
            </select>
          </label>
        </div>

        <ul className="list-clean block-list">
          {filteredTasks.length === 0 ? <li className="muted">No tasks match current filter.</li> : null}
          {filteredTasks.map((task) => (
            <li key={task.id} className="task-row">
              <div>
                <p>
                  <strong>{task.title}</strong>
                  <span className={`pill ${task.status === "done" ? "done" : ""}`}>{task.status}</span>
                </p>
                <p className="muted">{task.category} | {task.estMin}m | d{task.difficulty} | repeat {task.repeat}</p>
                {task.dueDateISO ? <p className="muted">Due: {task.dueDateISO}</p> : null}
              </div>
              <div className="row-actions">
                <button type="button" onClick={() => applyResult(setTaskStatus(userState, task.id, "todo"), "Task set to todo.")}>Todo</button>
                <button type="button" onClick={() => applyResult(setTaskStatus(userState, task.id, "doing"), "Task in progress.")}>Doing</button>
                <button type="button" onClick={() => applyResult(setTaskStatus(userState, task.id, "done"), "Task completed.")}>Done</button>
                <button type="button" onClick={() => handleEdit(task)}>Edit</button>
                <button type="button" onClick={() => applyResult(deleteTask(userState, task.id), "Task deleted.")}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
