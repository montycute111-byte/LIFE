import { pushLog, syncLevelProgress } from "./gameState.js";
import { awardLevelUpCrates } from "./crates.js";
import { getPowerItemMultipliers } from "./powerItems.js";
import { trackQuestEvent } from "./quests/questEngine.js";
import { getRebirthRuntimeModifiers } from "./rebirth.js";

export const ABILITY_DURATION_MS = 21 * 60 * 60 * 1000;
const ORDER_MIN_MS = 30 * 1000;
const ORDER_MAX_MS = 3 * 60 * 1000;
const TIME_WARP_INTERVAL_MS = 10 * 60 * 1000;
const WARP_BEACON_INTERVAL_MS = 6 * 60 * 1000;
const SINGULARITY_CORE_INTERVAL_MS = 3 * 60 * 1000;
const JOB_SLOT_ITEM_ID = "job_slot_permit";
const JOB_SLOT_BASE_COST = 1000;
const JOB_SLOT_COST_GROWTH = 1.35;
const ABILITY_SLOT_ITEM_ID = "ability_slot_permit";
const ABILITY_SLOT_BASE_COST = 100000;
const ABILITY_SLOT_COST_GROWTH = 1.55;
const TIME_WARP_ITEM_INTERVALS = {
  time_warp_chip: TIME_WARP_INTERVAL_MS,
  warp_beacon: WARP_BEACON_INTERVAL_MS,
  singularity_core: SINGULARITY_CORE_INTERVAL_MS
};

export const STORE_ITEMS = [
  {
    id: "energy_drink",
    name: "Energy Drink",
    description: "Cuts job duration by 20% while active.",
    price: 500,
    ability: "Jobs complete 20% faster.",
    abilityDuration: "21 hours"
  },
  {
    id: "golden_calculator",
    name: "Golden Calculator",
    description: "Boosts job money rewards by 25% while active.",
    price: 1200,
    ability: "Earn 25% more money from jobs.",
    abilityDuration: "21 hours"
  },
  {
    id: "time_warp_chip",
    name: "Time Warp Chip",
    description: "Instantly completes one active job every 10 minutes while active.",
    price: 2500,
    ability: "Instantly finish one job every 10 minutes.",
    abilityDuration: "21 hours"
  },
  {
    id: "focus_headphones",
    name: "Focus Headphones",
    description: "Increases job XP gains by 50% while active.",
    price: 900,
    ability: "Gain +50% XP from jobs.",
    abilityDuration: "21 hours"
  },
  {
    id: "lucky_coin",
    name: "Lucky Coin",
    description: "Gives a 12% chance for each claimed job to pay double while active.",
    price: 1500,
    ability: "12% chance jobs pay double.",
    abilityDuration: "21 hours"
  },
  {
    id: "executive_espresso",
    name: "Executive Espresso",
    description: "Supercharges your deal flow for bigger job payouts.",
    price: 2800,
    ability: "Earn 40% more money from jobs.",
    abilityDuration: "21 hours"
  },
  {
    id: "chrono_gloves",
    name: "Chrono Gloves",
    description: "Compresses task time for faster job completions.",
    price: 3200,
    ability: "Jobs complete 30% faster.",
    abilityDuration: "21 hours"
  },
  {
    id: "neural_notebook",
    name: "Neural Notebook",
    description: "Boosted pattern retention for massive XP growth.",
    price: 3600,
    ability: "Gain +90% XP from jobs.",
    abilityDuration: "21 hours"
  },
  {
    id: "jackpot_router",
    name: "Jackpot Router",
    description: "Routes hot leads into high-value job outcomes.",
    price: 4600,
    ability: "Additional 18% chance jobs pay double.",
    abilityDuration: "21 hours"
  },
  {
    id: "warp_beacon",
    name: "Warp Beacon",
    description: "Sends periodic completion pulses to active jobs.",
    price: 6200,
    ability: "Instantly finish one active job every 6 minutes.",
    abilityDuration: "21 hours"
  },
  {
    id: "singularity_core",
    name: "Singularity Core",
    description: "High-energy core that rapidly closes active jobs.",
    price: 11800,
    ability: "Instantly finish one active job every 3 minutes.",
    abilityDuration: "21 hours"
  },
  {
    id: "ops_command_pass",
    name: "Ops Command Pass",
    description: "Temporary operations pass that adds one job slot.",
    price: 7800,
    ability: "+1 extra active job slot while active.",
    abilityDuration: "21 hours"
  },
  {
    id: JOB_SLOT_ITEM_ID,
    name: "Job Slot Permit",
    description: "Permanent +1 active job slot. Buy repeatedly; each purchase costs more.",
    price: JOB_SLOT_BASE_COST,
    ability: "Adds +1 permanent job slot.",
    abilityDuration: "Permanent"
  },
  {
    id: ABILITY_SLOT_ITEM_ID,
    name: "Item Slot Permit",
    description: "Permanent +1 active ability slot. Buy repeatedly; each purchase costs more.",
    price: ABILITY_SLOT_BASE_COST,
    ability: "Lets you run one more store ability at the same time.",
    abilityDuration: "Permanent"
  }
];

export function buyStoreItem(state, itemId, now = Date.now()) {
  const item = STORE_ITEMS.find((entry) => entry.id === itemId);
  if (!item) {
    return {
      ok: false,
      message: "Item not found."
    };
  }
  const price = getStoreItemPrice(state, itemId);
  if (state.money < price) {
    return {
      ok: false,
      message: "Not enough cash."
    };
  }

  if (item.id === JOB_SLOT_ITEM_ID || item.id === ABILITY_SLOT_ITEM_ID) {
    state.money -= price;
    state.ownedItems = state.ownedItems && typeof state.ownedItems === "object" ? state.ownedItems : {};
    if (item.id === JOB_SLOT_ITEM_ID) {
      state.ownedItems[JOB_SLOT_ITEM_ID] = getJobSlotPermitCount(state) + 1;
    } else {
      state.ownedItems[ABILITY_SLOT_ITEM_ID] = getAbilitySlotPermitCount(state) + 1;
    }
    pushLog(state, `Purchased ${item.name} for $${price}.`, now);
    trackQuestEvent(state, "ITEM_BUY", { count: 1, amount: price });
    trackQuestEvent(state, "ITEM_SPEND", { amount: price });

    return {
      ok: true,
      purchasedItemName: item.name
    };
  }

  const baseDeliveryDelay = randomInt(ORDER_MIN_MS, ORDER_MAX_MS);
  const deliveryDelay = Math.max(1, Math.round(baseDeliveryDelay));
  const orderedAt = now;
  const deliveryTime = now + deliveryDelay;
  const order = {
    id: createOrderId(item.id, now),
    itemId: item.id,
    itemName: item.name,
    price,
    ability: item.ability,
    abilityDuration: item.abilityDuration,
    orderedAt,
    deliveryTime,
    status: "Ordered"
  };

  state.money -= price;
  state.orders.push(order);
  pushLog(state, `Ordered ${item.name} for $${price}.`, now);
  trackQuestEvent(state, "ITEM_BUY", { count: 1, amount: price });
  trackQuestEvent(state, "ITEM_SPEND", { amount: price });
  trackQuestEvent(state, "ORDER_PLACE", { count: 1, amount: 1 });

  return {
    ok: true,
    order,
    item
  };
}

export function activateInventoryItem(state, itemId, now = Date.now()) {
  const activeAbilities = getActiveAbilities(state, now);
  const maxSlots = getMaxActiveAbilitySlots(state);
  if (activeAbilities.length >= maxSlots) {
    return {
      ok: false,
      message: "All ability slots are in use."
    };
  }
  if (activeAbilities.some((entry) => entry.itemId === itemId)) {
    return {
      ok: false,
      message: "This ability is already active."
    };
  }

  const inventoryEntry = (Array.isArray(state.inventory) ? state.inventory : []).find((item) => item.itemId === itemId);
  if (!inventoryEntry || Number(inventoryEntry.qty || 0) < 1) {
    return {
      ok: false,
      message: "You do not own this item."
    };
  }

  const catalogItem = STORE_ITEMS.find((item) => item.id === itemId);
  if (!catalogItem) {
    return {
      ok: false,
      message: "Item not found."
    };
  }

  inventoryEntry.qty = Number(inventoryEntry.qty || 0) - 1;
  if (inventoryEntry.qty <= 0) {
    state.inventory = state.inventory.filter((item) => item.itemId !== itemId);
  }

  const newAbility = {
    itemId: catalogItem.id,
    itemName: catalogItem.name,
    effect: catalogItem.ability,
    activatedAt: now,
    expiresAt: now + ABILITY_DURATION_MS,
    nextInstantAt: TIME_WARP_ITEM_INTERVALS[catalogItem.id] ? now + TIME_WARP_ITEM_INTERVALS[catalogItem.id] : null
  };
  state.activeAbilities = [...activeAbilities, newAbility];
  state.activeAbility = state.activeAbilities[0] || null;

  pushLog(state, `Activated ${catalogItem.name} for 21 hours.`, now);
  trackQuestEvent(state, "ITEM_ACTIVATE", { count: 1, amount: 1 });
  return {
    ok: true,
    item: catalogItem
  };
}

export function processStoreTimers(state, now = Date.now()) {
  const updates = {
    deliveredItems: []
  };
  updateOrderStatuses(state, now, updates);
  deliverArrivedOrders(state, now);
  expireAbilities(state, now);
  processTimeWarpTicks(state, now);
  return updates;
}

export function getActiveAbilities(state, now = Date.now()) {
  const all = normalizeActiveAbilities(state);
  const active = all.filter((entry) => Number(entry.expiresAt || 0) > now);
  state.activeAbilities = active;
  state.activeAbility = active[0] || null;
  return active;
}

export function getActiveAbility(state, now = Date.now()) {
  const list = getActiveAbilities(state, now);
  return list[0] || null;
}

export function getOrderStatus(order, now = Date.now()) {
  const total = Math.max(1, Number(order.deliveryTime || 0) - Number(order.orderedAt || 0));
  const elapsed = Math.max(0, now - Number(order.orderedAt || 0));
  const ratio = Math.min(1, elapsed / total);

  if (ratio >= 1) {
    return "Delivered";
  }
  if (ratio >= 0.75) {
    return "Out for delivery";
  }
  if (ratio >= 0.25) {
    return "Shipping";
  }
  return "Ordered";
}

export function getPlayerEffects(state, now = Date.now()) {
  const focusBurstActive = Number(state?.boosts?.focusBurstUntil || 0) > now;
  const activeAbilities = getActiveAbilities(state, now);
  const activeIds = new Set(activeAbilities.map((entry) => entry.itemId));
  const levelBonusSlots = Math.max(0, Math.floor(Number(state?.level || 1)) - 1);
  const purchasedSlotBonus = getJobSlotPermitCount(state);
  const rebirthModifiers = getRebirthRuntimeModifiers(state);
  const powerMultipliers = getPowerItemMultipliers(state, now);

  return {
    payoutMultiplier: (1 + (focusBurstActive ? 0.35 : 0))
      * (activeIds.has("golden_calculator") ? 1.25 : 1)
      * (activeIds.has("executive_espresso") ? 1.4 : 1)
      * rebirthModifiers.jobIncomeMult,
    xpMultiplier: (activeIds.has("focus_headphones") ? 1.5 : 1)
      * (activeIds.has("neural_notebook") ? 1.9 : 1),
    durationMultiplier: (activeIds.has("energy_drink") ? 0.8 : 1)
      * (activeIds.has("chrono_gloves") ? 0.7 : 1)
      * rebirthModifiers.jobTimeMult,
    cooldownMultiplier: Math.max(0, Number(powerMultipliers.cooldownMult || 1)),
    streakWindowMs: 12 * 60 * 60 * 1000,
    maxActiveJobs: 3
      + levelBonusSlots
      + purchasedSlotBonus
      + (activeIds.has("ops_command_pass") ? 1 : 0)
      + Math.max(0, Number(rebirthModifiers.extraJobSlots || 0)),
    focusBurstActive,
    luckyDoubleChance: (activeIds.has("lucky_coin") ? 0.12 : 0)
      + (activeIds.has("jackpot_router") ? 0.18 : 0)
      + Math.max(0, Number(powerMultipliers.luckBonus || 0))
  };
}

export function getStoreItemPrice(state, itemId) {
  const powerMultipliers = getPowerItemMultipliers(state);
  const costMult = Math.max(0, Number(powerMultipliers.costMult || 1));
  if (itemId === JOB_SLOT_ITEM_ID) {
    const owned = getJobSlotPermitCount(state);
    return Math.max(1, Math.round(JOB_SLOT_BASE_COST * (JOB_SLOT_COST_GROWTH ** owned) * costMult));
  }
  if (itemId === ABILITY_SLOT_ITEM_ID) {
    const owned = getAbilitySlotPermitCount(state);
    return Math.max(1, Math.round(ABILITY_SLOT_BASE_COST * (ABILITY_SLOT_COST_GROWTH ** owned) * costMult));
  }
  const item = STORE_ITEMS.find((entry) => entry.id === itemId);
  return item ? Math.max(1, Math.round(item.price * costMult)) : 0;
}

export function getMaxActiveAbilitySlots(state) {
  return 1 + getAbilitySlotPermitCount(state);
}

export function awardXp(state, amount, now = Date.now()) {
  const powerMultipliers = getPowerItemMultipliers(state, now);
  const safeAmount = Math.max(0, Math.round(Number(amount || 0) * Math.max(0, Number(powerMultipliers.xpMult || 1))));
  state.xp += safeAmount;
  const levelsGained = syncLevelProgress(state);
  awardLevelUpCrates(state, levelsGained, now);
  trackQuestEvent(state, "XP_GAIN", { amount: safeAmount });
  if (levelsGained > 0) {
    trackQuestEvent(state, "LEVEL_UP", { count: levelsGained, amount: levelsGained });
  }
  if (levelsGained > 0) {
    pushLog(state, `Level up! You reached level ${state.level}.`, now);
  }
  return levelsGained;
}

function updateOrderStatuses(state, now, updates) {
  const orders = Array.isArray(state.orders) ? state.orders : [];
  for (const order of orders) {
    const previousStatus = String(order.status || "");
    const nextStatus = getOrderStatus(order, now);
    order.status = nextStatus;
    if (previousStatus !== "Delivered" && nextStatus === "Delivered") {
      updates.deliveredItems.push(order.itemName);
    }
  }
}

function deliverArrivedOrders(state, now) {
  const orders = Array.isArray(state.orders) ? state.orders : [];
  const activeOrders = [];

  for (const order of orders) {
    if (Number(order.deliveryTime || 0) <= now) {
      addInventoryItem(state, order);
      pushLog(state, `${order.itemName} was delivered to inventory.`, now);
      continue;
    }
    activeOrders.push(order);
  }

  state.orders = activeOrders;
}

function addInventoryItem(state, order) {
  const list = Array.isArray(state.inventory) ? state.inventory : [];
  const existing = list.find((entry) => entry.itemId === order.itemId);
  if (existing) {
    existing.qty = Number(existing.qty || 0) + 1;
    return;
  }

  list.push({
    itemId: order.itemId,
    itemName: order.itemName,
    ability: order.ability,
    abilityDuration: order.abilityDuration,
    qty: 1
  });
  state.inventory = list;
}

function expireAbilities(state, now) {
  const all = normalizeActiveAbilities(state);
  if (all.length < 1) {
    return;
  }
  const remaining = [];
  for (const ability of all) {
    if (Number(ability.expiresAt || 0) <= now) {
      pushLog(state, `${ability.itemName} ability expired.`, now);
      continue;
    }
    remaining.push(ability);
  }
  state.activeAbilities = remaining;
  state.activeAbility = remaining[0] || null;
}

function processTimeWarpTicks(state, now) {
  const warpAbilities = getActiveAbilities(state, now)
    .filter((entry) => Number(TIME_WARP_ITEM_INTERVALS[entry.itemId] || 0) > 0);
  if (warpAbilities.length < 1) {
    return;
  }

  for (const active of warpAbilities) {
    const intervalMs = Number(TIME_WARP_ITEM_INTERVALS[active.itemId] || TIME_WARP_INTERVAL_MS);
    let nextTick = Number(active.nextInstantAt || 0);
    if (nextTick <= 0) {
      nextTick = now + intervalMs;
    }
    while (nextTick <= now) {
      instantlyFinishOneJob(state, now);
      nextTick += intervalMs;
    }
    active.nextInstantAt = nextTick;
  }
}

function instantlyFinishOneJob(state, now) {
  const jobs = Array.isArray(state.activeJobs) ? state.activeJobs : [];
  if (!jobs.length) {
    return;
  }

  let soonest = jobs[0];
  for (const job of jobs) {
    if (job.endsAt < soonest.endsAt) {
      soonest = job;
    }
  }
  soonest.endsAt = Math.min(soonest.endsAt, now);
  pushLog(state, `Time Warp Chip instantly finished ${soonest.name}.`, now);
}

function createOrderId(itemId, now) {
  return `${itemId}_${now}_${Math.random().toString(36).slice(2, 8)}`;
}

function randomInt(min, max) {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function getJobSlotPermitCount(state) {
  return Math.max(0, Math.floor(Number(state?.ownedItems?.[JOB_SLOT_ITEM_ID] || 0)));
}

function getAbilitySlotPermitCount(state) {
  return Math.max(0, Math.floor(Number(state?.ownedItems?.[ABILITY_SLOT_ITEM_ID] || 0)));
}

function normalizeActiveAbilities(state) {
  const fromList = Array.isArray(state?.activeAbilities)
    ? state.activeAbilities.filter((entry) => entry && typeof entry === "object")
    : [];
  const legacy = state?.activeAbility && typeof state.activeAbility === "object"
    ? [state.activeAbility]
    : [];
  const merged = fromList.length > 0 ? fromList : legacy;
  state.activeAbilities = merged;
  state.activeAbility = merged[0] || null;
  return merged;
}
