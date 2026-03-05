export const CRATE_DROP_CHANCE_JOB = 0.05;
export const CRATE_AWARD_ON_LEVELUP_COMMON = 1;
export const CRATE_RARITY_WEIGHTS = {
  common: 70,
  rare: 20,
  epic: 9,
  legendary: 1
};
export const HISTORY_LIMIT = 50;

const RARITY_KEYS = ["common", "rare", "epic", "legendary"];

const REWARD_WEIGHTS_BY_RARITY = {
  common: {
    MONEY_FLAT: 46,
    XP_FLAT: 30,
    MONEY_PERCENT: 12,
    XP_PERCENT: 10,
    JOB_INSTANT_TOKENS: 2
  },
  rare: {
    MONEY_FLAT: 34,
    XP_FLAT: 24,
    MONEY_PERCENT: 12,
    XP_PERCENT: 10,
    JOB_INSTANT_TOKENS: 12,
    BOOST_JOBS: 5,
    BOOST_BUSINESS: 3
  },
  epic: {
    MONEY_FLAT: 26,
    XP_FLAT: 18,
    MONEY_PERCENT: 12,
    XP_PERCENT: 10,
    JOB_INSTANT_TOKENS: 16,
    BOOST_JOBS: 10,
    BOOST_BUSINESS: 8
  },
  legendary: {
    MONEY_FLAT: 20,
    XP_FLAT: 16,
    MONEY_PERCENT: 12,
    XP_PERCENT: 10,
    JOB_INSTANT_TOKENS: 18,
    BOOST_JOBS: 12,
    BOOST_BUSINESS: 12
  }
};

export function createDefaultCratesInventory() {
  return {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0
  };
}

export function ensureCratesState(state) {
  const fallbackInventory = createDefaultCratesInventory();
  const rawInventory = state?.cratesInventory && typeof state.cratesInventory === "object"
    ? state.cratesInventory
    : {};
  state.cratesInventory = {
    common: clampWhole(rawInventory.common, fallbackInventory.common),
    rare: clampWhole(rawInventory.rare, fallbackInventory.rare),
    epic: clampWhole(rawInventory.epic, fallbackInventory.epic),
    legendary: clampWhole(rawInventory.legendary, fallbackInventory.legendary)
  };

  state.crateHistory = Array.isArray(state.crateHistory)
    ? state.crateHistory.filter((entry) => entry && typeof entry === "object").slice(0, HISTORY_LIMIT)
    : [];
  state.activeBoosts = Array.isArray(state.activeBoosts)
    ? state.activeBoosts.filter((entry) => entry && typeof entry === "object")
    : [];
  state.instantTokens = clampWhole(state.instantTokens, 0);
  return state;
}

export function nowMs() {
  return Date.now();
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function rollWeighted(weightsObj) {
  const entries = Object.entries(weightsObj || {}).filter(([, weight]) => Number(weight) > 0);
  if (entries.length < 1) {
    return null;
  }
  const total = entries.reduce((sum, [, weight]) => sum + Number(weight), 0);
  let roll = Math.random() * total;
  for (const [key, weight] of entries) {
    roll -= Number(weight);
    if (roll <= 0) {
      return key;
    }
  }
  return entries[entries.length - 1][0];
}

export function maybeAwardCrate(state, source, now = nowMs()) {
  ensureCratesState(state);
  if (source === "jobComplete") {
    if (Math.random() > CRATE_DROP_CHANCE_JOB) {
      return null;
    }
  }
  const rarity = rollWeighted(CRATE_RARITY_WEIGHTS) || "common";
  awardCrate(state, rarity, 1);
  return {
    source,
    rarity,
    at: now
  };
}

export function awardLevelUpCrates(state, levelsGained, now = nowMs()) {
  ensureCratesState(state);
  const levels = clampWhole(levelsGained, 0);
  if (levels < 1) {
    return 0;
  }
  const count = levels * CRATE_AWARD_ON_LEVELUP_COMMON;
  awardCrate(state, "common", count);
  pushLogLine(state, `Level-up crate reward: +${count} Common crate${count > 1 ? "s" : ""}.`, now);
  return count;
}

export function openCrate(state, rarity, now = nowMs()) {
  ensureCratesState(state);
  const key = normalizeRarity(rarity);
  if (!key) {
    return {
      ok: false,
      message: "Invalid crate rarity."
    };
  }
  if (state.cratesInventory[key] < 1) {
    return {
      ok: false,
      message: "No crates of this rarity left."
    };
  }

  state.cratesInventory[key] = Math.max(0, state.cratesInventory[key] - 1);
  const reward = rollCrateReward(state, key, now);
  appendCrateHistory(state, {
    timestamp: now,
    rarity: key,
    rewardType: reward.type,
    rewardAmount: reward.amount,
    description: reward.description
  });
  pushLogLine(state, `Opened ${capitalize(key)} Crate: ${reward.description}`, now);

  return {
    ok: true,
    rarity: key,
    rewardType: reward.type,
    rewardAmount: reward.amount,
    description: reward.description
  };
}

export function pruneExpiredBoosts(state, now = nowMs()) {
  ensureCratesState(state);
  const current = Array.isArray(state.activeBoosts) ? state.activeBoosts : [];
  const alive = [];
  let expiredCount = 0;
  for (const boost of current) {
    if (Number(boost.endsAt || 0) <= now) {
      expiredCount += 1;
      continue;
    }
    alive.push(boost);
  }
  state.activeBoosts = alive;
  return expiredCount;
}

export function getCrateBoostMultipliers(state, now = nowMs()) {
  ensureCratesState(state);
  pruneExpiredBoosts(state, now);
  let jobPayoutMultiplier = 1;
  let businessPayoutMultiplier = 1;
  for (const boost of state.activeBoosts) {
    if (boost.type === "BOOST_JOBS") {
      jobPayoutMultiplier *= Math.max(1, Number(boost.multiplier || 1));
    }
    if (boost.type === "BOOST_BUSINESS") {
      businessPayoutMultiplier *= Math.max(1, Number(boost.multiplier || 1));
    }
  }
  return {
    jobPayoutMultiplier,
    businessPayoutMultiplier
  };
}

export function getInstantJobTokenCount(state) {
  const crateTokens = Math.max(0, Math.floor(Number(state?.instantTokens || 0)));
  const rebirthTokens = Math.max(0, Math.floor(Number(state?.rebirthShop?.instantJobTokens || 0)));
  return crateTokens + rebirthTokens;
}

function rollCrateReward(state, rarity, now) {
  const rewardType = rollWeighted(REWARD_WEIGHTS_BY_RARITY[rarity] || REWARD_WEIGHTS_BY_RARITY.common) || "MONEY_FLAT";
  const level = Math.max(1, Number(state.level || 1));
  const money = Math.max(0, Number(state.money || 0));
  const scale = getScale(level, money);

  if (rewardType === "MONEY_FLAT") {
    const amount = rollMoneyFlat(rarity, scale);
    state.money += amount;
    return {
      type: "MONEY_FLAT",
      amount,
      description: `+$${formatNum(amount)} cash`
    };
  }

  if (rewardType === "MONEY_PERCENT") {
    const percent = rollMoneyPercent(rarity);
    const amount = clamp(Math.round(money * percent), 1, moneyPercentCap(rarity, level));
    state.money += amount;
    return {
      type: "MONEY_PERCENT",
      amount,
      description: `+$${formatNum(amount)} cash (${Math.round(percent * 100)}% bonus)`
    };
  }

  if (rewardType === "XP_FLAT") {
    const amount = rollXpFlat(rarity, scale, level);
    state.xp = Math.max(0, Number(state.xp || 0) + amount);
    return {
      type: "XP_FLAT",
      amount,
      description: `+${formatNum(amount)} XP`
    };
  }

  if (rewardType === "XP_PERCENT") {
    const percent = rollXpPercent(rarity);
    const base = Math.max(100, Math.round(level * 220));
    const amount = clamp(Math.round(base * percent), 1, xpPercentCap(rarity, level));
    state.xp = Math.max(0, Number(state.xp || 0) + amount);
    return {
      type: "XP_PERCENT",
      amount,
      description: `+${formatNum(amount)} XP (${Math.round(percent * 100)}% scaled)`
    };
  }

  if (rewardType === "JOB_INSTANT_TOKENS") {
    const amount = rollTokenAmount(rarity);
    state.instantTokens = clampWhole(state.instantTokens, 0) + amount;
    return {
      type: "JOB_INSTANT_TOKENS",
      amount,
      description: `+${amount} instant job token${amount > 1 ? "s" : ""}`
    };
  }

  if (rewardType === "BOOST_JOBS") {
    const boost = createBoost("BOOST_JOBS", rarity, now);
    state.activeBoosts.push(boost);
    return {
      type: "BOOST_JOBS",
      amount: boost.multiplier,
      description: `Job payout boost x${boost.multiplier.toFixed(2)} for ${formatDuration(boost.endsAt - now)}`
    };
  }

  const boost = createBoost("BOOST_BUSINESS", rarity, now);
  state.activeBoosts.push(boost);
  return {
    type: "BOOST_BUSINESS",
    amount: boost.multiplier,
    description: `Business payout boost x${boost.multiplier.toFixed(2)} for ${formatDuration(boost.endsAt - now)}`
  };
}

function awardCrate(state, rarity, amount) {
  const key = normalizeRarity(rarity);
  if (!key) {
    return;
  }
  const count = clampWhole(amount, 0);
  state.cratesInventory[key] = Math.max(0, clampWhole(state.cratesInventory[key], 0) + count);
}

function appendCrateHistory(state, entry) {
  const list = Array.isArray(state.crateHistory) ? state.crateHistory : [];
  state.crateHistory = [entry, ...list].slice(0, HISTORY_LIMIT);
}

function normalizeRarity(value) {
  const key = String(value || "").trim().toLowerCase();
  return RARITY_KEYS.includes(key) ? key : null;
}

function getScale(level, money) {
  const logMoney = Math.log10(Math.max(1, money) + 1);
  return Math.max(1, level * 1.5 + logMoney * 25);
}

function rollMoneyFlat(rarity, scale) {
  if (rarity === "legendary") return clamp(Math.round(scale * 3000), 250_000, 5_000_000_000_000);
  if (rarity === "epic") return clamp(Math.round(scale * 900), 100_000, 500_000_000_000);
  if (rarity === "rare") return clamp(Math.round(scale * 260), 10_000, 50_000_000_000);
  return clamp(Math.round(scale * 60), 500, 5_000_000_000);
}

function rollMoneyPercent(rarity) {
  if (rarity === "legendary") return 0.12;
  if (rarity === "epic") return 0.08;
  if (rarity === "rare") return 0.05;
  return 0.03;
}

function moneyPercentCap(rarity, level) {
  if (rarity === "legendary") return 5_000_000_000_000;
  if (rarity === "epic") return 700_000_000_000;
  if (rarity === "rare") return 90_000_000_000;
  return Math.max(10_000_000, level * 6_000_000);
}

function rollXpFlat(rarity, scale, level) {
  if (rarity === "legendary") return clamp(Math.round(level * 220 + scale * 45), 2_000, 2_500_000);
  if (rarity === "epic") return clamp(Math.round(level * 120 + scale * 22), 800, 900_000);
  if (rarity === "rare") return clamp(Math.round(level * 55 + scale * 10), 250, 300_000);
  return clamp(Math.round(level * 18 + scale * 4), 40, 90_000);
}

function rollXpPercent(rarity) {
  if (rarity === "legendary") return 0.45;
  if (rarity === "epic") return 0.30;
  if (rarity === "rare") return 0.20;
  return 0.10;
}

function xpPercentCap(rarity, level) {
  if (rarity === "legendary") return 2_000_000;
  if (rarity === "epic") return 750_000;
  if (rarity === "rare") return 300_000;
  return Math.max(50_000, level * 900);
}

function rollTokenAmount(rarity) {
  if (rarity === "legendary") return randomInt(5, 15);
  if (rarity === "epic") return randomInt(2, 5);
  if (rarity === "rare") return randomInt(1, 2);
  return 1;
}

function createBoost(type, rarity, now) {
  if (type === "BOOST_JOBS") {
    if (rarity === "legendary") return { id: boostId(type, now), type, multiplier: 1.9, endsAt: now + 3 * 60 * 60 * 1000 };
    if (rarity === "epic") return { id: boostId(type, now), type, multiplier: 1.5, endsAt: now + 90 * 60 * 1000 };
    if (rarity === "rare") return { id: boostId(type, now), type, multiplier: 1.25, endsAt: now + 45 * 60 * 1000 };
    return { id: boostId(type, now), type, multiplier: 1.1, endsAt: now + 20 * 60 * 1000 };
  }
  if (rarity === "legendary") return { id: boostId(type, now), type, multiplier: 1.8, endsAt: now + 3 * 60 * 60 * 1000 };
  if (rarity === "epic") return { id: boostId(type, now), type, multiplier: 1.45, endsAt: now + 90 * 60 * 1000 };
  if (rarity === "rare") return { id: boostId(type, now), type, multiplier: 1.2, endsAt: now + 45 * 60 * 1000 };
  return { id: boostId(type, now), type, multiplier: 1.1, endsAt: now + 20 * 60 * 1000 };
}

function boostId(type, now) {
  return `${type}_${now}_${Math.random().toString(36).slice(2, 8)}`;
}

function pushLogLine(state, message, now) {
  const currentLog = Array.isArray(state.log) ? state.log : [];
  state.log = [{ message, at: now }, ...currentLog].slice(0, 15);
}

function formatDuration(ms) {
  const totalMinutes = Math.max(1, Math.floor(ms / (60 * 1000)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  return `${minutes}m`;
}

function formatNum(value) {
  return Math.round(value).toLocaleString();
}

function randomInt(min, max) {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function capitalize(value) {
  const text = String(value || "");
  if (!text) {
    return "";
  }
  return text[0].toUpperCase() + text.slice(1);
}

function clampWhole(value, fallback) {
  const safe = Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.floor(safe));
}
