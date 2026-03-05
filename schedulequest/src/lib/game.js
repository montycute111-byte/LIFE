import { addDays, compareDateISO, isWeekday, toDateISO, weekKey } from "./date";
import { makeId } from "./ids";

const DEFAULT_SETTINGS = {
  dayStartHour: 6,
  notifications: false,
  theme: "dark",
  streakTaskTarget: 3,
  streakFocusMinutes: 30
};

const DEFAULT_POWERUPS = [
  {
    id: "focus_boost",
    name: "Focus Boost",
    effect: "+30% XP from focus timers",
    durationMin: 60,
    cost: 80,
    owned: 0,
    activeUntilISO: null,
    kind: "timed"
  },
  {
    id: "coin_magnet",
    name: "Coin Magnet",
    effect: "+50% coins",
    durationMin: 60,
    cost: 90,
    owned: 0,
    activeUntilISO: null,
    kind: "timed"
  },
  {
    id: "streak_shield",
    name: "Streak Shield",
    effect: "Protects one missed streak day each week",
    durationMin: 0,
    cost: 120,
    owned: 0,
    activeUntilISO: null,
    kind: "consumable"
  },
  {
    id: "time_warp",
    name: "Time Warp",
    effect: "Instantly complete one schedule block after 2 tasks today",
    durationMin: 0,
    cost: 110,
    owned: 0,
    activeUntilISO: null,
    kind: "consumable"
  }
];

const ACHIEVEMENT_KEYS = ["first_task", "perfect_day", "7_day_streak", "100_tasks", "early_bird", "night_owl"];
const COSMETIC_CATALOG = [
  { id: "skin_sunrise", name: "Sunrise Frame", cost: 70 },
  { id: "skin_mint", name: "Mint Streak Trail", cost: 95 },
  { id: "skin_pixel", name: "Pixel Hero Border", cost: 120 }
];

function cloneState(state) {
  if (typeof structuredClone === "function") {
    return structuredClone(state);
  }
  return JSON.parse(JSON.stringify(state));
}

function ensureAchievementsShape(achievements) {
  const shaped = {};
  for (const key of ACHIEVEMENT_KEYS) {
    shaped[key] = {
      unlocked: Boolean(achievements?.[key]?.unlocked),
      unlockedAt: achievements?.[key]?.unlockedAt || null
    };
  }
  return shaped;
}

function createDaily(dateISO) {
  return {
    dateISO,
    quests: [
      { id: "dq_complete_5", title: "Complete 5 tasks", target: 5, progress: 0, done: false },
      { id: "dq_focus_45", title: "Do 45 minutes focus", target: 45, progress: 0, done: false },
      { id: "dq_hard_1", title: "Finish 1 hard task", target: 1, progress: 0, done: false }
    ],
    chestClaimed: false,
    hardDoneCount: 0,
    categoryDoneCounts: {}
  };
}

function createPowerups(existing = []) {
  return DEFAULT_POWERUPS.map((catalog) => {
    const found = existing.find((item) => item.id === catalog.id);
    return {
      ...catalog,
      owned: Number(found?.owned || 0),
      activeUntilISO: found?.activeUntilISO || null
    };
  });
}

export function xpToNextLevel(level) {
  return 100 + (Number(level || 1) * 40);
}

export function createDefaultState(username, createdAt = Date.now()) {
  const todayISO = toDateISO();
  return {
    schemaVersion: 1,
    user: {
      username,
      createdAt
    },
    stats: {
      level: 1,
      xp: 0,
      coins: 0,
      streakDays: 0,
      lastCheckDateISO: todayISO,
      totalCompleted: 0,
      perfectDays: 0,
      lastShieldWeek: null
    },
    settings: {
      ...DEFAULT_SETTINGS
    },
    schedule: {
      dateISO: todayISO,
      blocks: [],
      completedBlockIds: []
    },
    tasks: [],
    powerups: createPowerups(),
    achievements: ensureAchievementsShape({}),
    history: {
      completionsByDate: {},
      focusMinutesByDate: {},
      perfectDaysByDate: {}
    },
    daily: createDaily(todayISO),
    inventory: {
      badges: [],
      cosmetics: []
    }
  };
}

function normalizeTask(task) {
  return {
    id: task.id || makeId("task"),
    title: String(task.title || "Untitled Task").trim(),
    notes: String(task.notes || ""),
    category: String(task.category || "general"),
    dueDateISO: task.dueDateISO || null,
    repeat: ["none", "daily", "weekdays", "weekly"].includes(task.repeat) ? task.repeat : "none",
    estMin: Math.max(5, Math.min(480, Number(task.estMin || 30))),
    difficulty: Math.max(1, Math.min(5, Number(task.difficulty || 1))),
    status: ["todo", "doing", "done"].includes(task.status) ? task.status : "todo",
    createdAt: task.createdAt || new Date().toISOString(),
    completedAt: task.completedAt || null
  };
}

function normalizeBlock(block) {
  return {
    id: block.id || makeId("blk"),
    title: String(block.title || "Block").trim(),
    startMin: Math.max(0, Math.min(1439, Number(block.startMin || 0))),
    endMin: Math.max(1, Math.min(1440, Number(block.endMin || 60))),
    category: String(block.category || "general"),
    repeat: ["none", "daily", "weekdays"].includes(block.repeat) ? block.repeat : "none",
    difficulty: Math.max(1, Math.min(5, Number(block.difficulty || 1)))
  };
}

function unlockAchievement(state, achievementId, timestampISO = new Date().toISOString()) {
  if (!state.achievements[achievementId] || state.achievements[achievementId].unlocked) {
    return;
  }
  state.achievements[achievementId].unlocked = true;
  state.achievements[achievementId].unlockedAt = timestampISO;
}

function getPowerup(state, powerupId) {
  return state.powerups.find((item) => item.id === powerupId);
}

function clearExpiredPowerups(state, nowISO = new Date().toISOString()) {
  for (const powerup of state.powerups) {
    if (powerup.kind !== "timed") {
      continue;
    }
    if (powerup.activeUntilISO && powerup.activeUntilISO <= nowISO) {
      powerup.activeUntilISO = null;
    }
  }
}

function isPowerupActive(state, powerupId, nowISO = new Date().toISOString()) {
  const powerup = getPowerup(state, powerupId);
  if (!powerup || !powerup.activeUntilISO) {
    return false;
  }
  return powerup.activeUntilISO > nowISO;
}

function shouldRepeatTaskOnDate(task, dateISO) {
  if (task.repeat === "none") {
    return false;
  }
  if (task.repeat === "daily") {
    return true;
  }
  if (task.repeat === "weekdays") {
    return isWeekday(dateISO);
  }
  if (task.repeat === "weekly") {
    const reference = task.dueDateISO || toDateISO(task.createdAt);
    const refDay = new Date(`${reference}T00:00:00`).getDay();
    const currentDay = new Date(`${dateISO}T00:00:00`).getDay();
    return refDay === currentDay;
  }
  return false;
}

function shouldRepeatBlockOnDate(block, dateISO) {
  if (block.repeat === "none") {
    return false;
  }
  if (block.repeat === "daily") {
    return true;
  }
  if (block.repeat === "weekdays") {
    return isWeekday(dateISO);
  }
  return false;
}

function refreshDailyQuestProgress(state) {
  const todayISO = state.daily.dateISO;
  const completions = Number(state.history.completionsByDate[todayISO] || 0);
  const focusMinutes = Number(state.history.focusMinutesByDate[todayISO] || 0);
  const hardDone = Number(state.daily.hardDoneCount || 0);

  for (const quest of state.daily.quests) {
    if (quest.id === "dq_complete_5") {
      quest.progress = Math.min(quest.target, completions);
    }
    if (quest.id === "dq_focus_45") {
      quest.progress = Math.min(quest.target, focusMinutes);
    }
    if (quest.id === "dq_hard_1") {
      quest.progress = Math.min(quest.target, hardDone);
    }
    quest.done = quest.progress >= quest.target;
  }
}

function maybeApplyLootDrop(state) {
  if (Math.random() >= 0.05) {
    return null;
  }
  if (Math.random() < 0.5) {
    const bonus = 15;
    state.stats.coins += bonus;
    return { type: "coins", amount: bonus };
  }

  const badgeName = `badge_${Math.random().toString(36).slice(2, 7)}`;
  if (!state.inventory.badges.includes(badgeName)) {
    state.inventory.badges.push(badgeName);
  } else {
    state.stats.coins += 10;
  }
  return { type: "badge", badge: badgeName };
}

function applyProgression(state, options) {
  const nowISO = new Date().toISOString();
  const todayISO = toDateISO(nowISO);
  clearExpiredPowerups(state, nowISO);

  const difficulty = Math.max(1, Math.min(5, Number(options.difficulty || 1)));
  const estMin = Math.max(5, Number(options.estMin || 25));
  const streakBonus = Math.min(25, Number(state.stats.streakDays || 0) * 2);

  let xpGain = 10 + (difficulty * 5) + Math.round(estMin / 10) + streakBonus;
  if (options.isFocus && isPowerupActive(state, "focus_boost", nowISO)) {
    xpGain = Math.round(xpGain * 1.3);
  }

  let coinsGain = 2 + (difficulty * 2) + Math.max(1, Math.round(estMin / 20));
  if (isPowerupActive(state, "coin_magnet", nowISO)) {
    coinsGain = Math.round(coinsGain * 1.5);
  }

  state.stats.xp += xpGain;
  state.stats.coins += coinsGain;
  let levelsGained = 0;
  while (state.stats.xp >= xpToNextLevel(state.stats.level)) {
    state.stats.xp -= xpToNextLevel(state.stats.level);
    state.stats.level += 1;
    levelsGained += 1;
  }

  if (options.countCompletion !== false) {
    state.stats.totalCompleted += 1;
    state.history.completionsByDate[todayISO] = Number(state.history.completionsByDate[todayISO] || 0) + 1;
    if (options.category) {
      const current = Number(state.daily.categoryDoneCounts[options.category] || 0);
      state.daily.categoryDoneCounts[options.category] = current + 1;
    }
    if (difficulty >= 4) {
      state.daily.hardDoneCount = Number(state.daily.hardDoneCount || 0) + 1;
    }

    if (state.stats.totalCompleted >= 1) {
      unlockAchievement(state, "first_task", nowISO);
    }
    if (state.stats.totalCompleted >= 100) {
      unlockAchievement(state, "100_tasks", nowISO);
    }
    const hour = new Date(nowISO).getHours();
    if (hour < 9) {
      unlockAchievement(state, "early_bird", nowISO);
    }
    if (hour >= 23) {
      unlockAchievement(state, "night_owl", nowISO);
    }
  }

  const completedToday = Number(state.history.completionsByDate[todayISO] || 0);
  if (completedToday >= 10 && !state.history.perfectDaysByDate[todayISO]) {
    state.history.perfectDaysByDate[todayISO] = true;
    state.stats.perfectDays += 1;
    unlockAchievement(state, "perfect_day", nowISO);
  }

  refreshDailyQuestProgress(state);
  const loot = maybeApplyLootDrop(state);

  if (state.stats.streakDays >= 7) {
    unlockAchievement(state, "7_day_streak", nowISO);
  }

  return { xpGain, coinsGain, levelsGained, loot };
}

function maybeProtectStreakWithShield(state, dateISO) {
  const shield = getPowerup(state, "streak_shield");
  if (!shield || shield.owned <= 0) {
    return false;
  }
  const currentWeek = weekKey(dateISO);
  if (state.stats.lastShieldWeek === currentWeek) {
    return false;
  }
  shield.owned -= 1;
  state.stats.lastShieldWeek = currentWeek;
  return true;
}

function evaluateStreakForDay(state, dayISO) {
  const completed = Number(state.history.completionsByDate[dayISO] || 0);
  const focus = Number(state.history.focusMinutesByDate[dayISO] || 0);
  const met = completed >= Number(state.settings.streakTaskTarget || 3)
    || focus >= Number(state.settings.streakFocusMinutes || 30);

  if (met) {
    state.stats.streakDays += 1;
  } else if (state.stats.streakDays > 0) {
    const protectedByShield = maybeProtectStreakWithShield(state, dayISO);
    if (!protectedByShield) {
      state.stats.streakDays = 0;
    }
  }
}

function applyRolloverForDay(state, dayISO) {
  const repeatedBlocks = [];
  for (const block of state.schedule.blocks) {
    if (!shouldRepeatBlockOnDate(block, dayISO)) {
      continue;
    }
    repeatedBlocks.push({ ...block, id: makeId("blk") });
  }

  state.schedule.dateISO = dayISO;
  state.schedule.blocks = repeatedBlocks;
  state.schedule.completedBlockIds = [];

  state.tasks = state.tasks.map((task) => {
    if (!shouldRepeatTaskOnDate(task, dayISO)) {
      return task;
    }
    return {
      ...task,
      status: "todo",
      completedAt: null,
      dueDateISO: task.repeat === "none" ? task.dueDateISO : dayISO
    };
  });

  state.daily = createDaily(dayISO);
  if (state.history.focusMinutesByDate[dayISO] === undefined) {
    state.history.focusMinutesByDate[dayISO] = 0;
  }
}

export function applyDailyRollover(state) {
  const todayISO = toDateISO();
  if (!state) {
    return state;
  }

  const next = cloneState(state);
  next.schemaVersion = 1;
  clearExpiredPowerups(next);

  const lastCheck = next.stats.lastCheckDateISO || next.schedule.dateISO || todayISO;
  if (compareDateISO(lastCheck, todayISO) >= 0 && next.daily?.dateISO === todayISO && next.schedule?.dateISO === todayISO) {
    refreshDailyQuestProgress(next);
    return next;
  }

  let cursor = lastCheck;
  while (compareDateISO(cursor, todayISO) < 0) {
    evaluateStreakForDay(next, cursor);
    cursor = addDays(cursor, 1);
    applyRolloverForDay(next, cursor);
  }

  next.stats.lastCheckDateISO = todayISO;
  refreshDailyQuestProgress(next);
  return next;
}

export function hydrateUserState(rawState, username, createdAt) {
  const base = createDefaultState(username, createdAt || rawState?.user?.createdAt || Date.now());
  if (!rawState || typeof rawState !== "object") {
    return base;
  }

  const hydrated = {
    ...base,
    ...rawState,
    user: {
      ...base.user,
      ...(rawState.user || {}),
      username
    },
    stats: {
      ...base.stats,
      ...(rawState.stats || {})
    },
    settings: {
      ...base.settings,
      ...(rawState.settings || {})
    },
    schedule: {
      ...base.schedule,
      ...(rawState.schedule || {}),
      blocks: Array.isArray(rawState.schedule?.blocks)
        ? rawState.schedule.blocks.map(normalizeBlock)
        : base.schedule.blocks,
      completedBlockIds: Array.isArray(rawState.schedule?.completedBlockIds)
        ? rawState.schedule.completedBlockIds
        : []
    },
    tasks: Array.isArray(rawState.tasks) ? rawState.tasks.map(normalizeTask) : [],
    powerups: createPowerups(Array.isArray(rawState.powerups) ? rawState.powerups : []),
    achievements: ensureAchievementsShape(rawState.achievements),
    history: {
      ...base.history,
      ...(rawState.history || {}),
      completionsByDate: {
        ...(rawState.history?.completionsByDate || {})
      },
      focusMinutesByDate: {
        ...(rawState.history?.focusMinutesByDate || {})
      },
      perfectDaysByDate: {
        ...(rawState.history?.perfectDaysByDate || {})
      }
    },
    daily: {
      ...createDaily(rawState.daily?.dateISO || toDateISO()),
      ...(rawState.daily || {}),
      quests: Array.isArray(rawState.daily?.quests)
        ? rawState.daily.quests
        : createDaily(toDateISO()).quests,
      categoryDoneCounts: {
        ...(rawState.daily?.categoryDoneCounts || {})
      }
    },
    inventory: {
      badges: Array.isArray(rawState.inventory?.badges) ? rawState.inventory.badges : [],
      cosmetics: Array.isArray(rawState.inventory?.cosmetics) ? rawState.inventory.cosmetics : []
    }
  };

  return applyDailyRollover(hydrated);
}

export function findScheduleConflicts(blocks) {
  const sorted = [...(blocks || [])].sort((a, b) => a.startMin - b.startMin);
  const conflictIds = new Set();

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (current.endMin > next.startMin) {
      conflictIds.add(current.id);
      conflictIds.add(next.id);
    }
  }

  return conflictIds;
}

export function addScheduleBlock(state, blockInput) {
  const next = applyDailyRollover(state);
  const block = normalizeBlock(blockInput);
  if (block.endMin <= block.startMin) {
    return { state: next, error: "End time must be after start time." };
  }
  next.schedule.blocks.push(block);
  next.schedule.blocks.sort((a, b) => a.startMin - b.startMin);
  return { state: next };
}

export function updateScheduleBlock(state, blockId, updates) {
  const next = applyDailyRollover(state);
  next.schedule.blocks = next.schedule.blocks.map((block) => {
    if (block.id !== blockId) {
      return block;
    }
    return normalizeBlock({ ...block, ...updates, id: block.id });
  }).sort((a, b) => a.startMin - b.startMin);
  return { state: next };
}

export function deleteScheduleBlock(state, blockId) {
  const next = applyDailyRollover(state);
  next.schedule.blocks = next.schedule.blocks.filter((block) => block.id !== blockId);
  next.schedule.completedBlockIds = next.schedule.completedBlockIds.filter((id) => id !== blockId);
  return { state: next };
}

export function completeScheduleBlock(state, blockId) {
  const next = applyDailyRollover(state);
  if (next.schedule.completedBlockIds.includes(blockId)) {
    return { state: next, error: "Block already completed." };
  }
  const block = next.schedule.blocks.find((item) => item.id === blockId);
  if (!block) {
    return { state: next, error: "Block not found." };
  }
  next.schedule.completedBlockIds.push(blockId);
  const reward = applyProgression(next, {
    difficulty: block.difficulty,
    estMin: Math.max(10, block.endMin - block.startMin),
    category: block.category,
    countCompletion: true,
    isFocus: false
  });
  return { state: next, reward };
}

export function logFocusMinutes(state, minutes, blockId = null) {
  const next = applyDailyRollover(state);
  const safeMinutes = Math.max(1, Math.round(Number(minutes || 0)));
  const todayISO = toDateISO();
  next.history.focusMinutesByDate[todayISO] = Number(next.history.focusMinutesByDate[todayISO] || 0) + safeMinutes;

  const sourceBlock = blockId ? next.schedule.blocks.find((item) => item.id === blockId) : null;
  const reward = applyProgression(next, {
    difficulty: sourceBlock?.difficulty || 2,
    estMin: safeMinutes,
    category: sourceBlock?.category || "focus",
    countCompletion: false,
    isFocus: true
  });

  refreshDailyQuestProgress(next);
  return { state: next, reward };
}

export function addTask(state, taskInput) {
  const next = applyDailyRollover(state);
  const task = normalizeTask(taskInput);
  if (!task.title) {
    return { state: next, error: "Task title is required." };
  }
  next.tasks.unshift(task);
  return { state: next };
}

export function updateTask(state, taskId, updates) {
  const next = applyDailyRollover(state);
  next.tasks = next.tasks.map((task) => (task.id === taskId ? normalizeTask({ ...task, ...updates, id: task.id }) : task));
  return { state: next };
}

export function deleteTask(state, taskId) {
  const next = applyDailyRollover(state);
  next.tasks = next.tasks.filter((task) => task.id !== taskId);
  return { state: next };
}

export function completeTask(state, taskId) {
  const next = applyDailyRollover(state);
  const index = next.tasks.findIndex((item) => item.id === taskId);
  if (index < 0) {
    return { state: next, error: "Task not found." };
  }

  const task = next.tasks[index];
  if (task.status === "done") {
    return { state: next, error: "Task already completed." };
  }

  next.tasks[index] = {
    ...task,
    status: "done",
    completedAt: new Date().toISOString()
  };

  const reward = applyProgression(next, {
    difficulty: task.difficulty,
    estMin: task.estMin,
    category: task.category,
    countCompletion: true,
    isFocus: false
  });

  return { state: next, reward };
}

export function setTaskStatus(state, taskId, status) {
  if (status === "done") {
    return completeTask(state, taskId);
  }
  const next = applyDailyRollover(state);
  next.tasks = next.tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }
    return { ...task, status };
  });
  return { state: next };
}

export function generateSuggestedBlocks(options) {
  const goals = Array.isArray(options.goals) && options.goals.length > 0
    ? options.goals
    : ["school", "exercise", "cleaning", "hobbies"];

  const startHour = Math.max(0, Math.min(23, Number(options.startHour || 8)));
  const endHour = Math.max(startHour + 1, Math.min(24, Number(options.endHour || 22)));
  const durationByGoal = {
    school: 90,
    cleaning: 45,
    exercise: 60,
    hobbies: 60
  };

  const blocks = [];
  let cursor = startHour * 60;
  let goalIndex = 0;
  while (cursor + 30 <= endHour * 60) {
    const goal = goals[goalIndex % goals.length];
    const duration = durationByGoal[goal] || 60;
    const start = cursor;
    const end = Math.min(endHour * 60, start + duration);
    blocks.push(normalizeBlock({
      id: makeId("blk"),
      title: `${goal[0].toUpperCase()}${goal.slice(1)} Session`,
      startMin: start,
      endMin: end,
      category: goal,
      repeat: "none",
      difficulty: goal === "exercise" ? 4 : (goal === "school" ? 3 : 2)
    }));
    cursor = end + 15;
    goalIndex += 1;
  }
  return blocks;
}

export function currentBlock(state, now = new Date()) {
  const minute = (now.getHours() * 60) + now.getMinutes();
  return (state.schedule.blocks || []).find((block) => minute >= block.startMin && minute < block.endMin) || null;
}

export function getDoNextTask(state, filters = {}) {
  const next = applyDailyRollover(state);
  const tasks = next.tasks.filter((task) => task.status !== "done");
  const categoryFilter = String(filters.category || "all");
  if (categoryFilter !== "all") {
    return scoreTasks(tasks.filter((task) => task.category === categoryFilter), next)[0] || null;
  }
  return scoreTasks(tasks, next)[0] || null;
}

function scoreTasks(tasks, state) {
  const todayISO = toDateISO();
  return [...tasks]
    .map((task) => {
      let score = 0;
      if (task.dueDateISO) {
        if (task.dueDateISO < todayISO) {
          score += 80;
        } else if (task.dueDateISO === todayISO) {
          score += 50;
        } else if (task.dueDateISO === addDays(todayISO, 1)) {
          score += 25;
        }
      }
      score += Number(task.difficulty || 1) * 8;
      if (Number(state.stats.streakDays || 0) < 2 && Number(task.difficulty || 1) >= 4) {
        score -= 10;
      }
      const categoryPenalty = Number(state.daily.categoryDoneCounts?.[task.category] || 0) * 6;
      score -= categoryPenalty;
      score += Math.max(0, 50 - Number(task.estMin || 30)) / 6;
      return { task, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.task);
}

export function claimDailyChest(state) {
  const next = applyDailyRollover(state);
  const allDone = next.daily.quests.every((quest) => quest.done);
  if (!allDone) {
    return { state: next, error: "Complete all daily quests first." };
  }
  if (next.daily.chestClaimed) {
    return { state: next, error: "Chest already claimed today." };
  }
  next.daily.chestClaimed = true;
  next.stats.coins += 75;
  const badge = `chest_${next.daily.dateISO}`;
  if (!next.inventory.badges.includes(badge)) {
    next.inventory.badges.push(badge);
  }
  return { state: next, reward: { coins: 75, badge } };
}

export function buyPowerup(state, powerupId) {
  const next = applyDailyRollover(state);
  const powerup = getPowerup(next, powerupId);
  if (!powerup) {
    return { state: next, error: "Powerup not found." };
  }
  if (next.stats.coins < powerup.cost) {
    return { state: next, error: "Not enough coins." };
  }
  next.stats.coins -= powerup.cost;
  powerup.owned += 1;
  return { state: next };
}

export function listCosmetics() {
  return COSMETIC_CATALOG;
}

export function buyCosmetic(state, cosmeticId) {
  const next = applyDailyRollover(state);
  const cosmetic = COSMETIC_CATALOG.find((item) => item.id === cosmeticId);
  if (!cosmetic) {
    return { state: next, error: "Cosmetic not found." };
  }
  if (next.inventory.cosmetics.includes(cosmeticId)) {
    return { state: next, error: "Cosmetic already owned." };
  }
  if (next.stats.coins < cosmetic.cost) {
    return { state: next, error: "Not enough coins." };
  }
  next.stats.coins -= cosmetic.cost;
  next.inventory.cosmetics.push(cosmeticId);
  return { state: next };
}

export function activatePowerup(state, powerupId) {
  const next = applyDailyRollover(state);
  const powerup = getPowerup(next, powerupId);
  if (!powerup) {
    return { state: next, error: "Powerup not found." };
  }
  if (powerup.kind !== "timed") {
    return { state: next, error: "This item is used automatically when triggered." };
  }
  if (powerup.owned <= 0) {
    return { state: next, error: "You do not own this powerup yet." };
  }
  powerup.owned -= 1;
  powerup.activeUntilISO = new Date(Date.now() + (powerup.durationMin * 60 * 1000)).toISOString();
  return { state: next };
}

export function useTimeWarp(state, blockId) {
  const next = applyDailyRollover(state);
  const todayISO = toDateISO();
  const completed = Number(next.history.completionsByDate[todayISO] || 0);
  if (completed < 2) {
    return { state: next, error: "Time Warp unlocks after completing at least 2 tasks today." };
  }
  const powerup = getPowerup(next, "time_warp");
  if (!powerup || powerup.owned <= 0) {
    return { state: next, error: "No Time Warp available." };
  }
  if (next.schedule.completedBlockIds.includes(blockId)) {
    return { state: next, error: "Block already completed." };
  }
  powerup.owned -= 1;
  return completeScheduleBlock(next, blockId);
}

export function updateSettings(state, settingPatch) {
  const next = applyDailyRollover(state);
  next.settings = {
    ...next.settings,
    ...settingPatch
  };
  return { state: next };
}
