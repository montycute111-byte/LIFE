import { getCrateBoostMultipliers } from "./crates.js";
import { getEducationMultipliers, getEducationProgram, isEducationCompleted } from "./education.js";
import { getPowerItemMultipliers } from "./powerItems.js";
import { getResidenceModifiers } from "./realEstate.js";
import { getRebirthRuntimeModifiers } from "./rebirth.js";

const OFFLINE_CAP_SECONDS = 12 * 60 * 60;
const MAX_BUY_ITERATIONS = 500;
const TIER_INTERVAL_MS = {
  low: 5 * 60 * 1000,
  mid: 10 * 60 * 1000,
  high: 20 * 60 * 1000,
  ultra: 30 * 60 * 1000
};
const TIER_UPKEEP_RATE = {
  low: 0.05,
  mid: 0.1,
  high: 0.15,
  ultra: 0.2
};
const TIER_REVENUE_MULTIPLIER = {
  low: 1,
  mid: 1.35,
  high: 1.85,
  ultra: 2.35
};
const TIER_EFFECTIVE_MULTIPLIER_CAP = {
  low: 6,
  mid: 10,
  high: 15,
  ultra: 20
};

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
  },
  {
    id: "hs_research_park",
    name: "HS Research Parks",
    unlockLevel: 96,
    educationRequired: "hs",
    baseCost: 14000000000000,
    costGrowth: 1.245,
    baseIncomePerSec: 4100000000,
    incomeGrowthPerLevel: 1.16,
    description: "Education-gated research campuses with premium contracts."
  },
  {
    id: "diploma_capital_group",
    name: "Diploma Capital Group",
    unlockLevel: 118,
    educationRequired: "hs",
    baseCost: 92000000000000,
    costGrowth: 1.25,
    baseIncomePerSec: 14200000000,
    incomeGrowthPerLevel: 1.165,
    description: "Large-scale alumni finance operations."
  },
  {
    id: "college_endowment_fund",
    name: "College Endowment Funds",
    unlockLevel: 152,
    educationRequired: "college",
    baseCost: 820000000000000,
    costGrowth: 1.255,
    baseIncomePerSec: 62000000000,
    incomeGrowthPerLevel: 1.17,
    description: "University-backed funds with elite returns."
  },
  {
    id: "doctorate_ai_labs",
    name: "Doctorate AI Labs",
    unlockLevel: 182,
    educationRequired: "college",
    baseCost: 6200000000000000,
    costGrowth: 1.26,
    baseIncomePerSec: 235000000000,
    incomeGrowthPerLevel: 1.175,
    description: "Cutting-edge labs generating extreme passive profit."
  },
  {
    id: "interstellar_grant_network",
    name: "Interstellar Grant Network",
    unlockLevel: 225,
    educationRequired: "college",
    baseCost: 51000000000000000,
    costGrowth: 1.265,
    baseIncomePerSec: 890000000000,
    incomeGrowthPerLevel: 1.18,
    description: "Highest-tier education enterprise with cosmic funding."
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
  const sourceOwned = raw.owned && typeof raw.owned === "object" ? raw.owned : {};
  const owned = {};

  for (const [businessId, rawEntry] of Object.entries(sourceOwned)) {
    const definition = BUSINESS_DEFS.find((entry) => entry.id === businessId) || null;
    const normalized = normalizeOwnedBusiness(rawEntry, definition, now, lastPassiveTickAt);
    if (normalized.qty > 0 || normalized.level > 1 || normalized.paused) {
      owned[businessId] = normalized;
    }
  }

  state.businesses = {
    ...(raw && typeof raw === "object" ? raw : {}),
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

export function getBusinessState(state, businessId, now = Date.now()) {
  const businesses = ensureBusinessesState(state);
  const definition = BUSINESS_DEFS.find((entry) => entry.id === businessId) || null;
  const current = businesses.owned[businessId];
  return normalizeOwnedBusiness(current, definition, now, Number(businesses.lastPassiveTickAt || now));
}

export function getNextUnitCost(definition, qtyOwned, state = null, now = Date.now()) {
  const powerMultipliers = state ? getPowerItemMultipliers(state, now) : null;
  const costMult = Math.max(0, Number(powerMultipliers?.costMult || 1));
  return Math.max(1, Math.round(definition.baseCost * (definition.costGrowth ** Math.max(0, qtyOwned)) * costMult));
}

export function getUpgradeCost(definition, level, state = null, now = Date.now()) {
  const powerMultipliers = state ? getPowerItemMultipliers(state, now) : null;
  const costMult = Math.max(0, Number(powerMultipliers?.costMult || 1));
  return Math.max(1, Math.round((definition.baseCost * 10) * (1.25 ** Math.max(0, level - 1)) * costMult));
}

export function getBusinessIncomePerSec(definition, businessState) {
  const revenue = getBusinessRevenuePerCycle(definition, businessState);
  const upkeep = getBusinessUpkeepForRevenue(definition, businessState, revenue);
  const intervalSeconds = Math.max(1, Math.floor(Number(businessState?.payoutIntervalMs || TIER_INTERVAL_MS.mid) / 1000));
  const netPerCycle = Math.max(0, revenue - upkeep);
  return netPerCycle / intervalSeconds;
}

export function getTotalPassivePerSec(state, now = Date.now()) {
  ensureBusinessesState(state);
  const payoutMult = getBusinessPayoutMultiplier(state, now);
  let total = 0;
  for (const definition of BUSINESS_DEFS) {
    const businessState = getBusinessState(state, definition.id, now);
    if (businessState.paused || businessState.qty < 1) {
      continue;
    }
    const revenue = getBusinessRevenuePerCycle(definition, businessState);
    const scaledRevenue = Math.max(0, Math.round(revenue * payoutMult));
    const upkeep = getBusinessUpkeepForRevenue(definition, businessState, scaledRevenue);
    const netPerCycle = Math.max(0, scaledRevenue - upkeep);
    const intervalSeconds = Math.max(1, Math.floor(businessState.payoutIntervalMs / 1000));
    total += netPerCycle / intervalSeconds;
  }
  return total;
}

export function getPassiveIntervalSeconds(state) {
  ensureBusinessesState(state);
  return Math.floor(TIER_INTERVAL_MS.low / 1000);
}

export function getPassiveCycleProgress(state, now = Date.now()) {
  const businesses = ensureBusinessesState(state, now);
  const elapsedMs = Math.max(0, now - Number(businesses.lastPassiveTickAt || now));
  const progress = Math.max(0, Math.min(1, elapsedMs / TIER_INTERVAL_MS.low));
  const remainingMs = Math.max(0, TIER_INTERVAL_MS.low - elapsedMs);

  return {
    progress,
    remainingMs,
    intervalSeconds: Math.floor(TIER_INTERVAL_MS.low / 1000)
  };
}

export function getTotalPassivePayoutPerCycle(state) {
  const totalPerSec = getTotalPassivePerSec(state);
  if (totalPerSec <= 0) {
    return 0;
  }
  return Math.max(1, Math.round(totalPerSec * 60));
}

export function getBusinessCycleProgress(state, businessId, now = Date.now()) {
  const definition = BUSINESS_DEFS.find((entry) => entry.id === businessId);
  const businessState = getBusinessState(state, businessId, now);
  const intervalMs = Math.max(1, Number(businessState.payoutIntervalMs || getTierIntervalMs(getTier(definition))));

  if (businessState.paused) {
    return {
      progress: 0,
      remainingMs: 0,
      intervalMs
    };
  }

  const nextPayoutAt = Number(businessState.nextPayoutAt || now + intervalMs);
  const lastPayoutAt = Number(businessState.lastPayoutAt || (nextPayoutAt - intervalMs));
  const elapsedMs = Math.max(0, now - lastPayoutAt);
  const progress = Math.max(0, Math.min(1, elapsedMs / intervalMs));
  const remainingMs = Math.max(0, nextPayoutAt - now);
  return {
    progress,
    remainingMs,
    intervalMs
  };
}

export function getBusinessNextUpkeepCost(state, businessId, now = Date.now()) {
  const definition = BUSINESS_DEFS.find((entry) => entry.id === businessId);
  if (!definition) {
    return 0;
  }
  const businessState = getBusinessState(state, businessId, now);
  if (businessState.qty < 1) {
    return 0;
  }
  const payoutMult = getBusinessPayoutMultiplier(state, now);
  const revenue = Math.max(0, Math.round(getBusinessRevenuePerCycle(definition, businessState) * payoutMult));
  return getBusinessUpkeepForRevenue(definition, businessState, revenue);
}

export function payBusinessUpkeep(state, businessId, now = Date.now()) {
  ensureBusinessesState(state, now);
  const definition = BUSINESS_DEFS.find((entry) => entry.id === businessId);
  if (!definition) {
    return {
      ok: false,
      message: "Business not found."
    };
  }
  const businessState = getBusinessState(state, businessId, now);
  if (!businessState.paused) {
    return {
      ok: false,
      message: "Business is already running."
    };
  }
  const upkeepCost = getBusinessNextUpkeepCost(state, businessId, now);
  if (Number(state.money || 0) < upkeepCost) {
    return {
      ok: false,
      message: "Not enough cash to pay upkeep."
    };
  }

  state.money -= upkeepCost;
  state.businesses.owned[businessId] = {
    ...businessState,
    paused: false,
    lastPayoutAt: now,
    nextPayoutAt: now + businessState.payoutIntervalMs
  };
  return {
    ok: true,
    businessName: definition.name,
    upkeepPaid: upkeepCost
  };
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
  return buildPurchasePlan(definition, businessState.qty, availableMoney, mode, state);
}

export function buyBusinessUnits(state, businessId) {
  const now = Date.now();
  ensureBusinessesState(state, now);
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
  if (definition.educationRequired && !isEducationCompleted(state, definition.educationRequired)) {
    return {
      ok: false,
      message: `Requires completed ${getEducationRequirementLabel(definition.educationRequired)}.`
    };
  }

  const businessState = getBusinessState(state, businessId, now);
  const plan = buildPurchasePlan(
    definition,
    businessState.qty,
    Number(state.money || 0),
    state.businesses.buyMultiplier,
    state
  );

  if (plan.qty < 1 || plan.cost > Number(state.money || 0)) {
    return {
      ok: false,
      message: "Not enough cash."
    };
  }

  state.money -= plan.cost;
  const hadNoUnits = businessState.qty < 1;
  state.businesses.owned[businessId] = {
    ...businessState,
    qty: businessState.qty + plan.qty,
    level: businessState.level,
    paused: false,
    lastPayoutAt: hadNoUnits ? now : businessState.lastPayoutAt,
    nextPayoutAt: hadNoUnits ? (now + businessState.payoutIntervalMs) : businessState.nextPayoutAt
  };

  return {
    ok: true,
    businessName: definition.name,
    purchasedQty: plan.qty
  };
}

export function upgradeBusiness(state, businessId) {
  const now = Date.now();
  ensureBusinessesState(state, now);
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
  if (definition.educationRequired && !isEducationCompleted(state, definition.educationRequired)) {
    return {
      ok: false,
      message: `Requires completed ${getEducationRequirementLabel(definition.educationRequired)}.`
    };
  }

  const businessState = getBusinessState(state, businessId, now);
  if (businessState.qty < 1) {
    return {
      ok: false,
      message: "Buy at least one unit first."
    };
  }

  const upgradeCost = getUpgradeCost(definition, businessState.level, state);
  if (Number(state.money || 0) < upgradeCost) {
    return {
      ok: false,
      message: "Not enough cash for upgrade."
    };
  }

  state.money -= upgradeCost;
  state.businesses.owned[businessId] = {
    ...businessState,
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
  const result = processPassiveCycles(state, now, false);
  state.businesses.lastPassiveTickAt = now;

  return {
    earned: result.earned,
    elapsedSeconds: result.elapsedSeconds,
    totalPerSec: getTotalPassivePerSec(state, now),
    intervalSeconds: Math.floor(TIER_INTERVAL_MS.low / 1000),
    cycles: result.cycles
  };
}

export function grantOfflineEarnings(state, now = Date.now()) {
  ensureBusinessesState(state, now);
  const result = processPassiveCycles(state, now, true);
  state.businesses.lastPassiveTickAt = now;

  return {
    earned: result.earned,
    elapsedSeconds: result.elapsedSeconds,
    cycles: result.cycles
  };
}

function buildPurchasePlan(definition, qtyOwned, money, mode, state = null) {
  const maxCount = mode === "max"
    ? MAX_BUY_ITERATIONS
    : (mode === 10 ? 10 : 1);

  let qty = 0;
  let totalCost = 0;
  let nextQty = qtyOwned;
  let remaining = Math.max(0, Number(money || 0));

  for (let i = 0; i < maxCount; i += 1) {
    const cost = getNextUnitCost(definition, nextQty, state);
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
    nextUnitCost: getNextUnitCost(definition, qtyOwned, state)
  };
}

function getEducationRequirementLabel(programId) {
  return getEducationProgram(programId)?.name || "education program";
}

function processPassiveCycles(state, now, applyOfflineCap) {
  const payoutMult = getBusinessPayoutMultiplier(state, now);
  const lastTick = Number(state.businesses.lastPassiveTickAt || now);
  const maxProcessStart = applyOfflineCap
    ? Math.max(lastTick, now - OFFLINE_CAP_SECONDS * 1000)
    : lastTick;

  let earned = 0;
  let elapsedSeconds = 0;
  let cycles = 0;

  for (const definition of BUSINESS_DEFS) {
    const businessState = getBusinessState(state, definition.id, now);
    if (businessState.qty < 1) {
      state.businesses.owned[definition.id] = businessState;
      continue;
    }
    const processed = processBusinessDefinitionCycles(
      state,
      definition,
      businessState,
      now,
      maxProcessStart,
      payoutMult
    );
    state.businesses.owned[definition.id] = processed.nextState;
    earned += processed.earned;
    elapsedSeconds += processed.elapsedSeconds;
    cycles += processed.cycles;
  }

  return {
    earned,
    elapsedSeconds,
    cycles
  };
}

function processBusinessDefinitionCycles(state, definition, businessState, now, processStart, payoutMult) {
  const intervalMs = Math.max(1, Number(businessState.payoutIntervalMs || getTierIntervalMs(businessState.tier)));
  if (businessState.paused) {
    return {
      earned: 0,
      elapsedSeconds: 0,
      cycles: 0,
      nextState: businessState
    };
  }

  let nextPayoutAt = Number(businessState.nextPayoutAt || 0);
  let lastPayoutAt = Number(businessState.lastPayoutAt || 0);
  if (!Number.isFinite(nextPayoutAt) || nextPayoutAt <= 0) {
    const seed = Math.max(processStart, now);
    nextPayoutAt = seed + intervalMs;
  }
  if (!Number.isFinite(lastPayoutAt) || lastPayoutAt <= 0) {
    lastPayoutAt = Math.max(0, nextPayoutAt - intervalMs);
  }

  if (nextPayoutAt < processStart) {
    const skippedCycles = Math.floor((processStart - nextPayoutAt) / intervalMs);
    nextPayoutAt += skippedCycles * intervalMs;
    if (nextPayoutAt < processStart) {
      nextPayoutAt += intervalMs;
    }
    lastPayoutAt = nextPayoutAt - intervalMs;
  }

  let earned = 0;
  let cycles = 0;
  let paused = false;

  while (nextPayoutAt <= now) {
    const revenue = Math.max(0, Math.round(getBusinessRevenuePerCycle(definition, businessState) * payoutMult));
    const upkeep = getBusinessUpkeepForRevenue(definition, businessState, revenue);
    if (Number(state.money || 0) < upkeep) {
      paused = true;
      break;
    }
    const net = Math.max(0, revenue - upkeep);
    state.money += net;
    earned += net;
    cycles += 1;
    lastPayoutAt = nextPayoutAt;
    nextPayoutAt += intervalMs;
  }

  return {
    earned,
    elapsedSeconds: Math.floor((cycles * intervalMs) / 1000),
    cycles,
    nextState: {
      ...businessState,
      paused,
      lastPayoutAt,
      nextPayoutAt
    }
  };
}

function getBusinessRevenuePerCycle(definition, businessState) {
  const qty = Math.max(0, Math.floor(Number(businessState?.qty || 0)));
  if (qty < 1) {
    return 0;
  }
  const level = Math.max(1, Math.floor(Number(businessState?.level || 1)));
  const tier = normalizeTier(businessState?.tier || getTier(definition));
  const baseRevenue = getBaseRevenuePerUnit(definition) * qty;
  const growthMultiplier = 1 + (level ** 0.65);
  const rawEffectiveMultiplier = growthMultiplier * getTierRevenueMultiplier(tier);
  const effectiveMultiplier = applyTierSoftcap(rawEffectiveMultiplier, tier);
  return Math.max(0, Math.round(baseRevenue * effectiveMultiplier));
}

function getBusinessUpkeepForRevenue(definition, businessState, revenuePerCycle) {
  const qty = Math.max(0, Math.floor(Number(businessState?.qty || 0)));
  const tier = normalizeTier(businessState?.tier || getTier(definition));
  const rate = Math.max(0, Number(businessState?.upkeepRate || getTierUpkeepRate(tier)));
  const baseUpkeep = Math.max(1, Math.round(getBaseRevenuePerUnit(definition) * Math.max(1, qty) * 0.03));
  return Math.max(baseUpkeep, Math.round(Math.max(0, revenuePerCycle) * rate));
}

function getBusinessPayoutMultiplier(state, now = Date.now()) {
  const residenceModifiers = getResidenceModifiers(state);
  const rebirthModifiers = getRebirthRuntimeModifiers(state);
  const crateMultipliers = getCrateBoostMultipliers(state);
  const educationMultipliers = getEducationMultipliers(state);
  const powerMultipliers = getPowerItemMultipliers(state, now);
  return Math.max(0, Number(residenceModifiers.businessIncomeMult || 1))
    * Math.max(0, Number(rebirthModifiers.businessIncomeMult || 1))
    * Math.max(0, Number(crateMultipliers.businessPayoutMultiplier || 1))
    * Math.max(0, Number(educationMultipliers.businessMultiplier || 1))
    * Math.max(0, Number(powerMultipliers.bizPayoutMult || 1));
}

function normalizeOwnedBusiness(rawEntry, definition, now = Date.now(), fallbackLastPayoutAt = now) {
  const base = rawEntry && typeof rawEntry === "object" ? rawEntry : {};
  const tier = normalizeTier(base.tier || getTier(definition));
  const payoutIntervalMs = getTierIntervalMs(tier);
  const upkeepRate = getTierUpkeepRate(tier);
  const qty = Math.max(0, Math.floor(Number(base.qty || 0)));
  const level = Math.max(1, Math.floor(Number(base.level || 1)));
  const lastPayoutAt = Number.isFinite(base.lastPayoutAt) && Number(base.lastPayoutAt) > 0
    ? Number(base.lastPayoutAt)
    : Math.max(0, Number(fallbackLastPayoutAt || now));
  const nextPayoutAtRaw = Number(base.nextPayoutAt || 0);
  const nextPayoutAt = Number.isFinite(nextPayoutAtRaw) && nextPayoutAtRaw > 0
    ? Math.max(nextPayoutAtRaw, lastPayoutAt + payoutIntervalMs)
    : (lastPayoutAt + payoutIntervalMs);
  return {
    ...base,
    qty,
    level,
    tier,
    payoutIntervalMs,
    upkeepRate,
    paused: Boolean(base.paused),
    nextPayoutAt,
    lastPayoutAt
  };
}

function getBaseRevenuePerUnit(definition) {
  const base = Math.max(1, Number(definition?.baseIncomePerSec || 1));
  return Math.max(25, Math.round((base ** 0.62) * 120));
}

function applyTierSoftcap(multiplier, tier) {
  const safe = Math.max(1, Number(multiplier || 1));
  const cap = Math.max(1, Number(TIER_EFFECTIVE_MULTIPLIER_CAP[normalizeTier(tier)] || TIER_EFFECTIVE_MULTIPLIER_CAP.mid));
  if (safe <= cap) {
    return safe;
  }
  return cap + Math.log10(1 + (safe - cap));
}

function getTier(definition) {
  const unlockLevel = Math.max(1, Number(definition?.unlockLevel || 1));
  if (unlockLevel < 25) {
    return "low";
  }
  if (unlockLevel < 80) {
    return "mid";
  }
  if (unlockLevel < 160) {
    return "high";
  }
  return "ultra";
}

function normalizeTier(tier) {
  const key = String(tier || "").trim().toLowerCase();
  if (key === "low" || key === "mid" || key === "high" || key === "ultra") {
    return key;
  }
  return "mid";
}

function getTierIntervalMs(tier) {
  return TIER_INTERVAL_MS[normalizeTier(tier)] || TIER_INTERVAL_MS.mid;
}

function getTierUpkeepRate(tier) {
  return TIER_UPKEEP_RATE[normalizeTier(tier)] || TIER_UPKEEP_RATE.mid;
}

function getTierRevenueMultiplier(tier) {
  return TIER_REVENUE_MULTIPLIER[normalizeTier(tier)] || TIER_REVENUE_MULTIPLIER.mid;
}
