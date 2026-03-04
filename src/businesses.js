import { getResidenceModifiers } from "./realEstate.js";

const OFFLINE_CAP_SECONDS = 12 * 60 * 60;
const MAX_BUY_ITERATIONS = 500;
const PASSIVE_BASE_INTERVAL_SECONDS = 25;
const PASSIVE_MIN_INTERVAL_SECONDS = 5;
const PASSIVE_INTERVAL_REDUCTION_PER_UPGRADE = 0.03;

export const BUSINESS_DEFS = [
  {
    id: "lemonade",
    name: "Lemonade Stand",
    unlockLevel: 2,
    baseCost: 150,
    costGrowth: 1.15,
    baseIncomePerSec: 2,
    incomeGrowthPerLevel: 1.08,
    description: "Simple street profit."
  },
  {
    id: "newspaper",
    name: "Newspaper Route",
    unlockLevel: 4,
    baseCost: 1200,
    costGrowth: 1.16,
    baseIncomePerSec: 18,
    incomeGrowthPerLevel: 1.09,
    description: "Steady local delivery income."
  },
  {
    id: "foodtruck",
    name: "Food Truck Fleet",
    unlockLevel: 6,
    baseCost: 8000,
    costGrowth: 1.17,
    baseIncomePerSec: 120,
    incomeGrowthPerLevel: 1.10,
    description: "Hungry crowds, fast cash."
  },
  {
    id: "pizza",
    name: "Pizza Franchises",
    unlockLevel: 8,
    baseCost: 45000,
    costGrowth: 1.18,
    baseIncomePerSec: 650,
    incomeGrowthPerLevel: 1.10,
    description: "Neighborhood pizza empire."
  },
  {
    id: "shrimp",
    name: "Shrimp Boats",
    unlockLevel: 10,
    baseCost: 250000,
    costGrowth: 1.19,
    baseIncomePerSec: 4200,
    incomeGrowthPerLevel: 1.11,
    description: "Harbor profits on every catch."
  },
  {
    id: "oil",
    name: "Oil Companies",
    unlockLevel: 14,
    baseCost: 2500000,
    costGrowth: 1.20,
    baseIncomePerSec: 52000,
    incomeGrowthPerLevel: 1.12,
    description: "Industrial-scale money printer."
  },
  {
    id: "chipfab",
    name: "Chip Foundries",
    unlockLevel: 18,
    baseCost: 12000000,
    costGrowth: 1.205,
    baseIncomePerSec: 180000,
    incomeGrowthPerLevel: 1.12,
    description: "High-tech factories with massive margins."
  },
  {
    id: "airline",
    name: "Cargo Airlines",
    unlockLevel: 24,
    baseCost: 65000000,
    costGrowth: 1.21,
    baseIncomePerSec: 620000,
    incomeGrowthPerLevel: 1.125,
    description: "Global shipping profits at scale."
  },
  {
    id: "spaceport",
    name: "Orbital Spaceports",
    unlockLevel: 32,
    baseCost: 380000000,
    costGrowth: 1.215,
    baseIncomePerSec: 2300000,
    incomeGrowthPerLevel: 1.13,
    description: "Interplanetary logistics money engine."
  },
  {
    id: "quantum_cloud",
    name: "Quantum Cloud Grid",
    unlockLevel: 42,
    baseCost: 2200000000,
    costGrowth: 1.22,
    baseIncomePerSec: 8400000,
    incomeGrowthPerLevel: 1.135,
    description: "Compute farms that print premium revenue."
  },
  {
    id: "megabank",
    name: "Megacity Banks",
    unlockLevel: 54,
    baseCost: 15000000000,
    costGrowth: 1.225,
    baseIncomePerSec: 32000000,
    incomeGrowthPerLevel: 1.14,
    description: "Financial dominance in every region."
  },
  {
    id: "lunar_colonies",
    name: "Lunar Colonies",
    unlockLevel: 70,
    baseCost: 110000000000,
    costGrowth: 1.23,
    baseIncomePerSec: 125000000,
    incomeGrowthPerLevel: 1.145,
    description: "Off-world infrastructure, elite returns."
  },
  {
    id: "galactic_mining",
    name: "Galactic Mining Guild",
    unlockLevel: 84,
    baseCost: 900000000000,
    costGrowth: 1.235,
    baseIncomePerSec: 480000000,
    incomeGrowthPerLevel: 1.15,
    description: "Rare materials from deep-space belts."
  },
  {
    id: "neural_finance",
    name: "Neural Finance Networks",
    unlockLevel: 100,
    baseCost: 7000000000000,
    costGrowth: 1.24,
    baseIncomePerSec: 1800000000,
    incomeGrowthPerLevel: 1.155,
    description: "AI-driven global capital routing."
  },
  {
    id: "planetary_ports",
    name: "Planetary Port Authority",
    unlockLevel: 120,
    baseCost: 60000000000000,
    costGrowth: 1.245,
    baseIncomePerSec: 7200000000,
    incomeGrowthPerLevel: 1.16,
    description: "Massive interplanetary trade tolls."
  },
  {
    id: "starlight_energy",
    name: "Starlight Energy Grid",
    unlockLevel: 145,
    baseCost: 500000000000000,
    costGrowth: 1.25,
    baseIncomePerSec: 28000000000,
    incomeGrowthPerLevel: 1.165,
    description: "Orbital power infrastructure monopoly."
  },
  {
    id: "singularity_holdings",
    name: "Singularity Holdings",
    unlockLevel: 175,
    baseCost: 4000000000000000,
    costGrowth: 1.255,
    baseIncomePerSec: 115000000000,
    incomeGrowthPerLevel: 1.17,
    description: "Late-game mega-corp at cosmic scale."
  }
];

export function createDefaultBusinessesState(now = Date.now()) {
  return {
    buyMultiplier: 1,
    lastPassiveTickAt: now,
    owned: {}
  };
}

export function ensureBusinessesState(state, now = Date.now()) {
  const fallback = createDefaultBusinessesState(now);
  if (!state.businesses || typeof state.businesses !== "object") {
    state.businesses = fallback;
    return state.businesses;
  }

  const raw = state.businesses;
  const buyMultiplier = raw.buyMultiplier === 10 || raw.buyMultiplier === "max" ? raw.buyMultiplier : 1;
  const lastPassiveTickAt = Number.isFinite(raw.lastPassiveTickAt) && raw.lastPassiveTickAt > 0
    ? raw.lastPassiveTickAt
    : now;
  const owned = raw.owned && typeof raw.owned === "object" ? raw.owned : {};

  state.businesses = {
    buyMultiplier,
    lastPassiveTickAt,
    owned
  };

  return state.businesses;
}

export function setBusinessBuyMultiplier(state, mode) {
  const businesses = ensureBusinessesState(state);
  if (mode !== 1 && mode !== 10 && mode !== "max") {
    return {
      ok: false,
      message: "Invalid buy mode."
    };
  }
  businesses.buyMultiplier = mode;
  return {
    ok: true
  };
}

export function getBusinessState(state, businessId) {
  const businesses = ensureBusinessesState(state);
  const current = businesses.owned[businessId];
  if (!current || typeof current !== "object") {
    return {
      qty: 0,
      level: 1
    };
  }
  return {
    qty: Math.max(0, Math.floor(Number(current.qty || 0))),
    level: Math.max(1, Math.floor(Number(current.level || 1)))
  };
}

export function getNextUnitCost(definition, qtyOwned) {
  return Math.max(1, Math.round(definition.baseCost * (definition.costGrowth ** Math.max(0, qtyOwned))));
}

export function getUpgradeCost(definition, level) {
  return Math.max(1, Math.round((definition.baseCost * 10) * (1.25 ** Math.max(0, level - 1))));
}

export function getBusinessIncomePerSec(definition, businessState) {
  const qty = Math.max(0, Number(businessState?.qty || 0));
  const level = Math.max(1, Number(businessState?.level || 1));
  return qty * (definition.baseIncomePerSec * (definition.incomeGrowthPerLevel ** level));
}

export function getTotalPassivePerSec(state) {
  ensureBusinessesState(state);
  let total = 0;
  for (const definition of BUSINESS_DEFS) {
    const businessState = getBusinessState(state, definition.id);
    total += getBusinessIncomePerSec(definition, businessState);
  }
  const residenceModifiers = getResidenceModifiers(state);
  const businessIncomeMult = Math.max(0, Number(residenceModifiers.businessIncomeMult || 1));
  return total * businessIncomeMult;
}

export function getPassiveIntervalSeconds(state) {
  ensureBusinessesState(state);
  const totalUpgradeLevels = getTotalUpgradeLevels(state);
  const reductionMultiplier = (1 - PASSIVE_INTERVAL_REDUCTION_PER_UPGRADE) ** totalUpgradeLevels;
  const intervalSeconds = Math.round(PASSIVE_BASE_INTERVAL_SECONDS * reductionMultiplier);
  return Math.max(PASSIVE_MIN_INTERVAL_SECONDS, intervalSeconds);
}

export function getPassiveCycleProgress(state, now = Date.now()) {
  const businesses = ensureBusinessesState(state, now);
  const intervalSeconds = getPassiveIntervalSeconds(state);
  const intervalMs = intervalSeconds * 1000;
  const elapsedMs = Math.max(0, now - Number(businesses.lastPassiveTickAt || now));
  const cycleMs = elapsedMs % intervalMs;
  const progress = Math.max(0, Math.min(1, cycleMs / intervalMs));
  const remainingMs = Math.max(0, intervalMs - cycleMs);

  return {
    progress,
    remainingMs,
    intervalSeconds
  };
}

export function getTotalPassivePayoutPerCycle(state) {
  const totalPerSec = getTotalPassivePerSec(state);
  const intervalSeconds = getPassiveIntervalSeconds(state);
  const rawPayout = totalPerSec * intervalSeconds;
  if (totalPerSec <= 0) {
    return 0;
  }
  return Math.max(1, Math.round(rawPayout));
}

export function getBusinessPurchasePreview(state, businessId) {
  ensureBusinessesState(state);
  const definition = BUSINESS_DEFS.find((entry) => entry.id === businessId);
  if (!definition) {
    return {
      qty: 0,
      cost: 0,
      nextUnitCost: 0
    };
  }

  const businessState = getBusinessState(state, businessId);
  const mode = state.businesses.buyMultiplier;
  const availableMoney = Number(state.money || 0);
  return buildPurchasePlan(definition, businessState.qty, availableMoney, mode);
}

export function buyBusinessUnits(state, businessId) {
  ensureBusinessesState(state);
  const definition = BUSINESS_DEFS.find((entry) => entry.id === businessId);
  if (!definition) {
    return {
      ok: false,
      message: "Business not found."
    };
  }
  if (state.level < definition.unlockLevel) {
    return {
      ok: false,
      message: `Unlocks at level ${definition.unlockLevel}.`
    };
  }

  const businessState = getBusinessState(state, businessId);
  const plan = buildPurchasePlan(
    definition,
    businessState.qty,
    Number(state.money || 0),
    state.businesses.buyMultiplier
  );

  if (plan.qty < 1 || plan.cost > Number(state.money || 0)) {
    return {
      ok: false,
      message: "Not enough cash."
    };
  }

  state.money -= plan.cost;
  state.businesses.owned[businessId] = {
    qty: businessState.qty + plan.qty,
    level: businessState.level
  };

  return {
    ok: true,
    businessName: definition.name,
    purchasedQty: plan.qty
  };
}

export function upgradeBusiness(state, businessId) {
  ensureBusinessesState(state);
  const definition = BUSINESS_DEFS.find((entry) => entry.id === businessId);
  if (!definition) {
    return {
      ok: false,
      message: "Business not found."
    };
  }
  if (state.level < definition.unlockLevel) {
    return {
      ok: false,
      message: `Unlocks at level ${definition.unlockLevel}.`
    };
  }

  const businessState = getBusinessState(state, businessId);
  if (businessState.qty < 1) {
    return {
      ok: false,
      message: "Buy at least one unit first."
    };
  }

  const upgradeCost = getUpgradeCost(definition, businessState.level);
  if (Number(state.money || 0) < upgradeCost) {
    return {
      ok: false,
      message: "Not enough cash for upgrade."
    };
  }

  state.money -= upgradeCost;
  state.businesses.owned[businessId] = {
    qty: businessState.qty,
    level: businessState.level + 1
  };

  return {
    ok: true,
    businessName: definition.name,
    newLevel: businessState.level + 1
  };
}

export function applyPassiveIncomeTick(state, now = Date.now()) {
  ensureBusinessesState(state, now);
  const lastTick = Number(state.businesses.lastPassiveTickAt || now);
  const intervalSeconds = getPassiveIntervalSeconds(state);
  const intervalMs = intervalSeconds * 1000;
  const elapsedMs = Math.max(0, now - lastTick);
  const cycles = Math.floor(elapsedMs / intervalMs);

  if (cycles < 1) {
    return {
      earned: 0,
      elapsedSeconds: 0,
      totalPerSec: getTotalPassivePerSec(state),
      intervalSeconds
    };
  }

  const totalPerSec = getTotalPassivePerSec(state);
  const rawEarned = totalPerSec * intervalSeconds * cycles;
  let earned = Math.round(rawEarned);
  if (cycles > 0 && totalPerSec > 0) {
    earned = Math.max(cycles, earned);
  }
  if (earned > 0) {
    state.money += earned;
  }
  state.businesses.lastPassiveTickAt = now;

  return {
    earned,
    elapsedSeconds: cycles * intervalSeconds,
    totalPerSec,
    intervalSeconds
  };
}

export function grantOfflineEarnings(state, now = Date.now()) {
  ensureBusinessesState(state, now);
  const lastTick = Number(state.businesses.lastPassiveTickAt || now);
  const elapsedSeconds = Math.max(0, Math.floor((now - lastTick) / 1000));
  const clampedSeconds = Math.min(elapsedSeconds, OFFLINE_CAP_SECONDS);
  const intervalSeconds = getPassiveIntervalSeconds(state);
  const cycles = Math.floor(clampedSeconds / intervalSeconds);
  const consumedSeconds = cycles * intervalSeconds;
  const totalPerSec = getTotalPassivePerSec(state);
  const rawEarned = totalPerSec * consumedSeconds;
  let earned = Math.round(rawEarned);
  if (cycles > 0 && totalPerSec > 0) {
    earned = Math.max(cycles, earned);
  }

  if (earned > 0) {
    state.money += earned;
  }
  state.businesses.lastPassiveTickAt = now;

  return {
    earned,
    elapsedSeconds: consumedSeconds
  };
}

function buildPurchasePlan(definition, qtyOwned, money, mode) {
  const maxCount = mode === "max"
    ? MAX_BUY_ITERATIONS
    : (mode === 10 ? 10 : 1);

  let qty = 0;
  let totalCost = 0;
  let nextQty = qtyOwned;
  let remaining = Math.max(0, Number(money || 0));

  for (let i = 0; i < maxCount; i += 1) {
    const cost = getNextUnitCost(definition, nextQty);
    if (remaining < cost) {
      break;
    }
    qty += 1;
    totalCost += cost;
    remaining -= cost;
    nextQty += 1;
  }

  return {
    qty,
    cost: totalCost,
    nextUnitCost: getNextUnitCost(definition, qtyOwned)
  };
}

function getTotalUpgradeLevels(state) {
  let total = 0;
  for (const definition of BUSINESS_DEFS) {
    const businessState = getBusinessState(state, definition.id);
    if (businessState.qty < 1) {
      continue;
    }
    total += Math.max(0, businessState.level - 1);
  }
  return total;
}
