import { awardLevelUpCrates, createDefaultCratesInventory, ensureCratesState } from "./crates.js";
import { createDefaultEducationPerks, createDefaultEducationState, ensureEducationState } from "./education.js";
import { getPowerItemMultipliers, POWER_ITEMS_UNLOCK_LEVEL } from "./powerItems.js";
import { createDefaultRealEstateState, ensureRealEstateState, getResidenceModifiers } from "./realEstate.js";
import { createDefaultRebirthBonuses, createDefaultRebirthShop, ensureRebirthState } from "./rebirth.js";

export const SCHEMA_VERSION = 8;

const DAILY_REWARD_MS = 24 * 60 * 60 * 1000;

export function createDefaultState(username, options = {}) {
  const now = Date.now();
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: {
      username,
      isGuest: Boolean(options.isGuest),
      createdAt: now,
      lastLoginAt: now
    },
    money: 250,
    level: 1,
    xp: 0,
    activeJobs: [],
    ownedItems: {},
    cooldowns: {},
    businesses: createDefaultBusinessesState(now),
    realEstate: createDefaultRealEstateState(),
    orders: [],
    inventory: [],
    activeAbility: null,
    activeAbilities: [],
    cratesInventory: createDefaultCratesInventory(),
    crateHistory: [],
    activeBoosts: [],
    instantTokens: 0,
    education: createDefaultEducationState(),
    educationPerks: createDefaultEducationPerks(),
    powerItems: createDefaultPowerItemsState(fallbackLevelFromOptions(options)),
    quests: createDefaultQuestState(),
    rebirths: 0,
    rebirthPoints: 0,
    rebirthPointsSpent: 0,
    rebirthTotalPointsEarned: 0,
    rebirthBonuses: createDefaultRebirthBonuses(),
    rebirthShop: createDefaultRebirthShop(),
    boosts: {
      focusBurstUntil: 0
    },
    streak: {
      count: 0,
      best: 0,
      lastClaimAt: 0,
      windowEndsAt: 0
    },
    daily: {
      lastClaimAt: 0,
      nextClaimAt: 0
    },
    settings: {
      compactMode: false,
      activeTab: "dashboard",
      autoFillJobs: false
    },
    stats: {
      jobsCompleted: 0,
      totalEarned: 250
    },
    log: [
      createLogEntry("Fresh account funded with a starter balance of $250.", now)
    ],
    lastSavedAt: 0
  };
}

export function migrateState(oldState, username) {
  if (!oldState || typeof oldState !== "object") {
    return createDefaultState(username);
  }

  const fallback = createDefaultState(username || String(oldState?.profile?.username || "Player"));
  const state = deepClone(oldState);

  state.schemaVersion = SCHEMA_VERSION;
  state.profile = {
    ...fallback.profile,
    ...(state.profile && typeof state.profile === "object" ? state.profile : {})
  };
  state.profile.username = username || state.profile.username || fallback.profile.username;
  state.money = numberOr(state.money, fallback.money);
  state.level = Math.max(1, Math.floor(numberOr(state.level, fallback.level)));
  state.xp = Math.max(0, Math.floor(numberOr(state.xp, fallback.xp)));
  state.activeJobs = Array.isArray(state.activeJobs) ? state.activeJobs : [];
  state.ownedItems = state.ownedItems && typeof state.ownedItems === "object" ? state.ownedItems : {};
  state.cooldowns = state.cooldowns && typeof state.cooldowns === "object" ? state.cooldowns : {};
  state.businesses = normalizeBusinessesState(state.businesses, fallback.businesses, Date.now());
  state.realEstate = normalizeRealEstateState(state.realEstate, fallback.realEstate);
  ensureRealEstateState(state);
  state.orders = Array.isArray(state.orders) ? state.orders : [];
  state.inventory = Array.isArray(state.inventory) ? state.inventory : [];
  const legacyActiveAbility = state.activeAbility && typeof state.activeAbility === "object" ? state.activeAbility : null;
  const activeAbilities = Array.isArray(state.activeAbilities)
    ? state.activeAbilities.filter((entry) => entry && typeof entry === "object")
    : [];
  if (activeAbilities.length < 1 && legacyActiveAbility) {
    activeAbilities.push(legacyActiveAbility);
  }
  state.activeAbilities = activeAbilities;
  state.activeAbility = activeAbilities[0] || null;
  ensureCratesState(state);
  ensureEducationState(state);
  ensureRebirthState(state);
  state.powerItems = normalizePowerItemsState(state.powerItems, fallback.powerItems, state.level);
  state.quests = normalizeQuestState(state.quests, fallback.quests);
  state.boosts = {
    ...fallback.boosts,
    ...(state.boosts && typeof state.boosts === "object" ? state.boosts : {})
  };
  state.streak = {
    ...fallback.streak,
    ...(state.streak && typeof state.streak === "object" ? state.streak : {})
  };
  state.daily = {
    ...fallback.daily,
    ...(state.daily && typeof state.daily === "object" ? state.daily : {})
  };
  state.settings = {
    ...fallback.settings,
    ...(state.settings && typeof state.settings === "object" ? state.settings : {})
  };
  state.stats = {
    ...fallback.stats,
    ...(state.stats && typeof state.stats === "object" ? state.stats : {})
  };
  state.log = Array.isArray(state.log) ? state.log.slice(0, 15) : fallback.log;
  state.lastSavedAt = numberOr(state.lastSavedAt, 0);

  syncLevelProgress(state);
  return state;
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function xpRequiredForLevel(level) {
  const safeLevel = Math.max(1, Number(level || 1));
  const baseXp = 60 + (safeLevel - 1) * 35;

  // Faster early progression, but still keeps late-game (toward 400) meaningfully grindy.
  let speedFactor = 1;
  if (safeLevel <= 100) {
    speedFactor = 0.72;
  } else if (safeLevel <= 250) {
    speedFactor = 0.82;
  } else if (safeLevel <= 400) {
    speedFactor = 0.9;
  }

  return Math.max(25, Math.round(baseXp * speedFactor));
}

export function syncLevelProgress(state) {
  let levelsGained = 0;
  while (state.xp >= xpRequiredForLevel(state.level)) {
    state.xp -= xpRequiredForLevel(state.level);
    state.level += 1;
    levelsGained += 1;
  }
  return levelsGained;
}

export function updateLastLogin(state, now = Date.now()) {
  state.profile.lastLoginAt = now;
}

export function createLogEntry(message, now = Date.now()) {
  return {
    message,
    at: now
  };
}

export function pushLog(state, message, now = Date.now()) {
  state.log = [createLogEntry(message, now), ...(Array.isArray(state.log) ? state.log : [])].slice(0, 15);
}

export function claimDailyReward(state, now = Date.now()) {
  const nextClaimAt = numberOr(state?.daily?.nextClaimAt, 0);
  if (nextClaimAt > now) {
    return {
      ok: false,
      message: "Daily reward is still on cooldown."
    };
  }

  const reward = 150 + state.level * 35;
  const xpGain = 18 + state.level * 2;

  state.money += reward;
  state.xp += xpGain;
  state.daily.lastClaimAt = now;
  const residenceModifiers = getResidenceModifiers(state);
  const cooldownReduction = Math.max(0, Math.min(3 * 60 * 60 * 1000, Number(residenceModifiers.dailyCooldownReduceMs || 0)));
  const effectiveCooldown = Math.max(1, DAILY_REWARD_MS - cooldownReduction);
  const powerMultipliers = getPowerItemMultipliers(state, now);
  const finalCooldownMs = Math.max(1, Math.round(effectiveCooldown * Math.max(0, Number(powerMultipliers.cooldownMult || 1))));
  state.daily.nextClaimAt = now + finalCooldownMs;
  state.stats.totalEarned += reward;

  const levelsGained = syncLevelProgress(state);
  const cratesAwarded = awardLevelUpCrates(state, levelsGained, now);
  pushLog(state, `Claimed daily bonus: +$${reward} and +${xpGain} XP.`, now);
  if (levelsGained > 0) {
    pushLog(state, `Level up! You reached level ${state.level}.`, now);
  }

  return {
    ok: true,
    reward,
    xpGain,
    levelsGained,
    cratesAwarded
  };
}

function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function createDefaultBusinessesState(now = Date.now()) {
  return {
    buyMultiplier: 1,
    lastPassiveTickAt: now,
    owned: {}
  };
}

function normalizeBusinessesState(value, fallback, now) {
  const base = fallback && typeof fallback === "object" ? fallback : createDefaultBusinessesState(now);
  if (!value || typeof value !== "object") {
    return base;
  }

  return {
    buyMultiplier: value.buyMultiplier === 10 || value.buyMultiplier === "max" ? value.buyMultiplier : 1,
    lastPassiveTickAt: Number.isFinite(value.lastPassiveTickAt) && value.lastPassiveTickAt > 0
      ? value.lastPassiveTickAt
      : base.lastPassiveTickAt,
    owned: value.owned && typeof value.owned === "object" ? value.owned : {}
  };
}

function normalizeRealEstateState(value, fallback) {
  const base = fallback && typeof fallback === "object" ? fallback : createDefaultRealEstateState();
  if (!value || typeof value !== "object") {
    return base;
  }

  return {
    owned: value.owned && typeof value.owned === "object" ? value.owned : {},
    activeResidenceId: typeof value.activeResidenceId === "string" ? value.activeResidenceId : null
  };
}

function createDefaultPowerItemsState(level = 1) {
  return {
    unlocked: Number(level || 0) >= POWER_ITEMS_UNLOCK_LEVEL,
    owned: {},
    active: {
      itemId: null,
      startedAt: null,
      endsAt: null
    }
  };
}

function normalizePowerItemsState(value, fallback, level = 1) {
  const base = fallback && typeof fallback === "object" ? fallback : createDefaultPowerItemsState(level);
  if (!value || typeof value !== "object") {
    return base;
  }
  const active = value.active && typeof value.active === "object" ? value.active : {};
  return {
    unlocked: Number(level || 0) >= POWER_ITEMS_UNLOCK_LEVEL,
    owned: value.owned && typeof value.owned === "object" ? value.owned : {},
    active: {
      itemId: typeof active.itemId === "string" ? active.itemId : null,
      startedAt: Number.isFinite(active.startedAt) ? active.startedAt : null,
      endsAt: Number.isFinite(active.endsAt) ? active.endsAt : null
    }
  };
}

function fallbackLevelFromOptions(options) {
  return Math.max(1, Math.floor(Number(options?.level || 1)));
}

function createDefaultQuestState() {
  return {
    last_roll_date: "",
    daily_ids: [],
    progress: {},
    completed: {},
    claimed: {}
  };
}

function normalizeQuestState(value, fallback) {
  const base = fallback && typeof fallback === "object" ? fallback : createDefaultQuestState();
  if (!value || typeof value !== "object") {
    return base;
  }
  return {
    last_roll_date: typeof value.last_roll_date === "string" ? value.last_roll_date : "",
    daily_ids: Array.isArray(value.daily_ids) ? value.daily_ids.filter((id) => typeof id === "string") : [],
    progress: value.progress && typeof value.progress === "object" ? value.progress : {},
    completed: value.completed && typeof value.completed === "object" ? value.completed : {},
    claimed: value.claimed && typeof value.claimed === "object" ? value.claimed : {}
  };
}
