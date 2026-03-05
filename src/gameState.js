import { createDefaultRealEstateState, ensureRealEstateState, getResidenceModifiers } from "./realEstate.js";

export const SCHEMA_VERSION = 5;

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
  return Math.round(60 + (Math.max(1, level) - 1) * 35);
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
  state.daily.nextClaimAt = now + effectiveCooldown;
  state.stats.totalEarned += reward;

  const levelsGained = syncLevelProgress(state);
  pushLog(state, `Claimed daily bonus: +$${reward} and +${xpGain} XP.`, now);
  if (levelsGained > 0) {
    pushLog(state, `Level up! You reached level ${state.level}.`, now);
  }

  return {
    ok: true,
    reward,
    xpGain,
    levelsGained
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
