export function toDateISO(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function minutesFromTimeString(timeValue) {
  const [hourRaw, minuteRaw] = String(timeValue || "0:0").split(":");
  const hours = Number(hourRaw || 0);
  const minutes = Number(minuteRaw || 0);
  return (hours * 60) + minutes;
}

export function timeStringFromMinutes(totalMinutes) {
  const safe = Math.max(0, Math.min(24 * 60, Number(totalMinutes || 0)));
  const h = String(Math.floor(safe / 60)).padStart(2, "0");
  const m = String(safe % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function addDays(dateISO, offsetDays) {
  const date = new Date(`${dateISO}T00:00:00`);
  date.setDate(date.getDate() + offsetDays);
  return toDateISO(date);
}

export function compareDateISO(a, b) {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

export function isWeekday(dateISO) {
  const day = new Date(`${dateISO}T00:00:00`).getDay();
  return day >= 1 && day <= 5;
}

export function weekKey(dateISO) {
  const date = new Date(`${dateISO}T00:00:00`);
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date - firstDay) / 86400000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}
