import { awardLevelUpCrates } from "../crates.js";
import { pushLog, syncLevelProgress } from "../gameState.js";
import { QUESTS, QUESTS_BY_ID } from "./questDefinitions.js";

const LOCAL_USER_ID_KEY = "fakebank_local_user_id";
const DAILY_QUEST_COUNT = 10;

export function createDefaultQuestState() {
  return {
    last_roll_date: "",
    daily_ids: [],
    progress: {},
    completed: {},
    claimed: {}
  };
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getStableLocalUserId() {
  try {
    const existing = String(localStorage.getItem(LOCAL_USER_ID_KEY) || "").trim();
    if (existing) {
      return existing;
    }
    const generated = generateUserId();
    localStorage.setItem(LOCAL_USER_ID_KEY, generated);
    return generated;
  } catch (_error) {
    return generateUserId();
  }
}

export function pickDailyQuestIds(userId, dateKey) {
  const seed = fnv1a32(`${userId}:${dateKey}`);
  const random = mulberry32(seed);
  const pool = QUESTS.map((quest) => quest.id);

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const temp = pool[i];
    pool[i] = pool[j];
    pool[j] = temp;
  }

  return pool.slice(0, DAILY_QUEST_COUNT);
}

export function ensureDailyQuests(state) {
  const quests = ensureQuestState(state);
  const userId = getStableLocalUserId();
  const dateKey = getLocalDateKey();
  const currentIds = Array.isArray(quests.daily_ids) ? quests.daily_ids : [];
  const hasValidDaily = currentIds.length === DAILY_QUEST_COUNT
    && new Set(currentIds).size === DAILY_QUEST_COUNT
    && currentIds.every((id) => Boolean(QUESTS_BY_ID[id]));

  let rolled = false;
  if (!hasValidDaily || quests.last_roll_date !== dateKey) {
    const dailyIds = pickDailyQuestIds(userId, dateKey);
    quests.last_roll_date = dateKey;
    quests.daily_ids = dailyIds;
    for (const questId of dailyIds) {
      quests.progress[questId] = 0;
      quests.completed[questId] = false;
      quests.claimed[questId] = false;
    }
    rolled = true;
  } else {
    for (const questId of quests.daily_ids) {
      if (!Number.isFinite(quests.progress[questId])) {
        quests.progress[questId] = 0;
      }
      if (typeof quests.completed[questId] !== "boolean") {
        quests.completed[questId] = false;
      }
      if (typeof quests.claimed[questId] !== "boolean") {
        quests.claimed[questId] = false;
      }
    }
  }

  const changedBySpecial = evaluateSpecialQuestProgress(state);
  return {
    state,
    rolled,
    changed: rolled || changedBySpecial,
    userId,
    dateKey,
    dailyIds: [...quests.daily_ids]
  };
}

export function trackQuestEvent(state, eventName, payload = {}) {
  ensureDailyQuests(state);
  const quests = ensureQuestState(state);
  let changed = false;
  const safeEvent = String(eventName || "").trim().toUpperCase();
  const amount = getPositiveNumber(payload.amount ?? payload.value);
  const count = getPositiveNumber(payload.count);

  for (const questId of quests.daily_ids) {
    const definition = QUESTS_BY_ID[questId];
    if (!definition || definition.requirement.event !== safeEvent || quests.claimed[questId]) {
      continue;
    }

    const current = Math.max(0, Number(quests.progress[questId] || 0));
    const delta = definition.requirement.mode === "sum"
      ? amount
      : (count > 0 ? count : 1);

    if (delta <= 0) {
      continue;
    }

    const next = current + delta;
    if (next !== current) {
      quests.progress[questId] = next;
      changed = true;
    }
    if (next >= definition.requirement.target && !quests.completed[questId]) {
      quests.completed[questId] = true;
      changed = true;
    }
  }

  if (evaluateSpecialQuestProgress(state)) {
    changed = true;
  }

  return {
    state,
    changed
  };
}

export function claimQuest(state, questId, now = Date.now()) {
  ensureDailyQuests(state);
  const quests = ensureQuestState(state);
  const safeQuestId = String(questId || "").trim();
  const definition = QUESTS_BY_ID[safeQuestId];

  if (!definition || !quests.daily_ids.includes(safeQuestId)) {
    return {
      ok: false,
      message: "Quest not available today."
    };
  }
  if (!quests.completed[safeQuestId]) {
    return {
      ok: false,
      message: "Quest is not complete yet."
    };
  }
  if (quests.claimed[safeQuestId]) {
    return {
      ok: false,
      message: "Quest already claimed."
    };
  }

  const cash = Math.max(0, Math.floor(Number(definition.reward?.cash || 0)));
  const xp = Math.max(0, Math.floor(Number(definition.reward?.xp || 0)));
  let levelsGained = 0;

  if (cash > 0) {
    state.money = Number(state.money || 0) + cash;
  }
  if (xp > 0 && Number.isFinite(state.xp)) {
    state.xp += xp;
    levelsGained = syncLevelProgress(state);
    awardLevelUpCrates(state, levelsGained, now);
    if (levelsGained > 0) {
      pushLog(state, `Level up! You reached level ${state.level}.`, now);
    }
  }

  quests.claimed[safeQuestId] = true;
  pushLog(
    state,
    `Quest claimed: ${definition.title} (${cash > 0 ? `+$${cash}` : ""}${cash > 0 && xp > 0 ? ", " : ""}${xp > 0 ? `+${xp} XP` : ""}).`,
    now
  );

  // Keep dependent progress in sync after rewards change balance/xp/level.
  trackQuestEvent(state, "XP_GAIN", { amount: xp });
  if (levelsGained > 0) {
    trackQuestEvent(state, "LEVEL_UP", { count: levelsGained, amount: levelsGained });
  }
  trackQuestEvent(state, "CASH_BALANCE", { amount: Number(state.money || 0) });

  return {
    ok: true,
    questId: safeQuestId,
    questTitle: definition.title,
    reward: { cash, xp },
    levelsGained
  };
}

function ensureQuestState(state) {
  if (!state.quests || typeof state.quests !== "object") {
    state.quests = createDefaultQuestState();
    return state.quests;
  }

  const current = state.quests;
  state.quests = {
    last_roll_date: typeof current.last_roll_date === "string" ? current.last_roll_date : "",
    daily_ids: Array.isArray(current.daily_ids) ? current.daily_ids.filter((id) => typeof id === "string") : [],
    progress: current.progress && typeof current.progress === "object" ? current.progress : {},
    completed: current.completed && typeof current.completed === "object" ? current.completed : {},
    claimed: current.claimed && typeof current.claimed === "object" ? current.claimed : {}
  };
  return state.quests;
}

function evaluateSpecialQuestProgress(state) {
  const quests = ensureQuestState(state);
  let changed = false;
  const money = Math.max(0, Number(state.money || 0));
  const hsDone = state?.education?.hs?.status === "completed";
  const collegeDone = state?.education?.college?.status === "completed";

  for (const questId of quests.daily_ids) {
    const definition = QUESTS_BY_ID[questId];
    if (!definition || quests.claimed[questId]) {
      continue;
    }

    let value = null;
    if (definition.requirement.event === "CASH_BALANCE") {
      value = money;
    } else if (definition.requirement.event === "EDU_HS_COMPLETED") {
      value = hsDone ? 1 : 0;
    } else if (definition.requirement.event === "EDU_COLLEGE_COMPLETED") {
      value = collegeDone ? 1 : 0;
    } else if (definition.requirement.event === "EDU_BOTH_COMPLETED") {
      value = hsDone && collegeDone ? 1 : 0;
    }

    if (value === null) {
      continue;
    }

    const nextProgress = Math.max(
      Math.max(0, Number(quests.progress[questId] || 0)),
      value
    );
    if (nextProgress !== quests.progress[questId]) {
      quests.progress[questId] = nextProgress;
      changed = true;
    }
    const nowCompleted = nextProgress >= definition.requirement.target;
    if (nowCompleted !== Boolean(quests.completed[questId])) {
      quests.completed[questId] = nowCompleted;
      changed = true;
    }
  }

  return changed;
}

function generateUserId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `uid_${Math.random().toString(16).slice(2)}${Date.now()}`;
}

function fnv1a32(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function random() {
    t += 0x6D2B79F5;
    let value = Math.imul(t ^ (t >>> 15), 1 | t);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function getPositiveNumber(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Number(value));
}
