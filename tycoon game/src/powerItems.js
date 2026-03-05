export const POWER_ITEMS_UNLOCK_LEVEL = 75;
export const POWER_ITEM_DURATION_MS = 15 * 60 * 60 * 1000;

export const POWER_ITEMS = [
  {
    id: "overclock_chip",
    name: "Overclock Chip",
    description: "Doubles all job payout claims while active.",
    cost: 50_000_000,
    durationMs: POWER_ITEM_DURATION_MS,
    effect: { jobPayoutMult: 2 }
  },
  {
    id: "golden_contract",
    name: "Golden Contract",
    description: "Cuts new job durations by 50% while active.",
    cost: 65_000_000,
    durationMs: POWER_ITEM_DURATION_MS,
    effect: { jobTimeMult: 0.5 }
  },
  {
    id: "corporate_magnet",
    name: "Corporate Magnet",
    description: "Boosts business payouts by +150% (2.5x) while active.",
    cost: 95_000_000,
    durationMs: POWER_ITEM_DURATION_MS,
    effect: { bizPayoutMult: 2.5 }
  },
  {
    id: "time_dilation_core",
    name: "Time Dilation Core",
    description: "Reduces cooldown timers by 60% while active.",
    cost: 120_000_000,
    durationMs: POWER_ITEM_DURATION_MS,
    effect: { cooldownMult: 0.4 }
  },
  {
    id: "xp_injector",
    name: "XP Injector",
    description: "Triples all XP gains while active.",
    cost: 80_000_000,
    durationMs: POWER_ITEM_DURATION_MS,
    effect: { xpMult: 3 }
  },
  {
    id: "lucky_algorithm",
    name: "Lucky Algorithm",
    description: "Adds +30% lucky payout chance while active.",
    cost: 70_000_000,
    durationMs: POWER_ITEM_DURATION_MS,
    effect: { luckBonus: 0.30 }
  },
  {
    id: "auto_collector",
    name: "Auto Collector",
    description: "Automatically claims ready jobs while active.",
    cost: 140_000_000,
    durationMs: POWER_ITEM_DURATION_MS,
    effect: { autoCollectJobs: true }
  },
  {
    id: "tax_evasion_suite",
    name: "Tax Evasion Suite",
    description: "Reduces store/business costs by 25% while active.",
    cost: 110_000_000,
    durationMs: POWER_ITEM_DURATION_MS,
    effect: { costMult: 0.75 }
  }
];

const POWER_ITEMS_BY_ID = POWER_ITEMS.reduce((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {});

export function createDefaultPowerItemsState(level = 1) {
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

export function ensurePowerItemsState(state, now = Date.now()) {
  const fallback = createDefaultPowerItemsState(state?.level || 1);
  if (!state.powerItems || typeof state.powerItems !== "object") {
    state.powerItems = fallback;
    return state.powerItems;
  }

  const current = state.powerItems;
  const active = current.active && typeof current.active === "object" ? current.active : {};
  const itemId = typeof active.itemId === "string" && POWER_ITEMS_BY_ID[active.itemId] ? active.itemId : null;
  const startedAt = Number.isFinite(active.startedAt) ? active.startedAt : null;
  const endsAt = Number.isFinite(active.endsAt) ? active.endsAt : null;

  state.powerItems = {
    unlocked: Number(state?.level || 0) >= POWER_ITEMS_UNLOCK_LEVEL,
    owned: current.owned && typeof current.owned === "object" ? current.owned : {},
    active: {
      itemId,
      startedAt,
      endsAt
    }
  };

  if (state.powerItems.active.itemId && Number(state.powerItems.active.endsAt || 0) <= now) {
    clearActivePowerItem(state);
  }

  return state.powerItems;
}

export function syncPowerItems(state, now = Date.now()) {
  ensurePowerItemsState(state, now);
  const activeId = state.powerItems.active.itemId;
  if (!activeId) {
    return {
      changed: false,
      expiredItemName: ""
    };
  }
  if (Number(state.powerItems.active.endsAt || 0) > now) {
    return {
      changed: false,
      expiredItemName: ""
    };
  }
  const expiredItemName = getPowerItemById(activeId)?.name || "Power Item";
  clearActivePowerItem(state);
  appendLog(state, `${expiredItemName} expired.`, now);
  return {
    changed: true,
    expiredItemName
  };
}

export function getActivePowerItem(state, now = Date.now()) {
  ensurePowerItemsState(state, now);
  const activeId = state.powerItems.active.itemId;
  if (!activeId) {
    return null;
  }
  const item = getPowerItemById(activeId);
  if (!item) {
    return null;
  }
  const remainingMs = Math.max(0, Number(state.powerItems.active.endsAt || 0) - now);
  return {
    item,
    remainingMs,
    startedAt: state.powerItems.active.startedAt,
    endsAt: state.powerItems.active.endsAt
  };
}

export function getPowerItemMultipliers(state, now = Date.now()) {
  ensurePowerItemsState(state, now);
  const defaults = {
    jobPayoutMult: 1,
    jobTimeMult: 1,
    bizPayoutMult: 1,
    xpMult: 1,
    costMult: 1,
    cooldownMult: 1,
    luckBonus: 0,
    autoCollectJobs: false
  };
  const activeId = state.powerItems.active.itemId;
  if (!activeId) {
    return defaults;
  }
  const item = getPowerItemById(activeId);
  if (!item || Number(state.powerItems.active.endsAt || 0) <= now) {
    clearActivePowerItem(state);
    return defaults;
  }
  return {
    ...defaults,
    ...(item.effect || {})
  };
}

export function getPowerItemPrice(state, itemId, now = Date.now()) {
  const item = getPowerItemById(itemId);
  if (!item) {
    return 0;
  }
  const multipliers = getPowerItemMultipliers(state, now);
  return Math.max(1, Math.round(item.cost * Math.max(0, Number(multipliers.costMult || 1))));
}

export function buyPowerItem(state, itemId, now = Date.now()) {
  ensurePowerItemsState(state, now);
  const item = getPowerItemById(itemId);
  if (!item) {
    return {
      ok: false,
      message: "Power item not found."
    };
  }
  if (!state.powerItems.unlocked) {
    return {
      ok: false,
      message: `Reach level ${POWER_ITEMS_UNLOCK_LEVEL} to unlock Power Items.`
    };
  }
  const price = getPowerItemPrice(state, itemId, now);
  if (Number(state.money || 0) < price) {
    return {
      ok: false,
      message: "Not enough cash."
    };
  }

  state.money -= price;
  const ownedNow = Math.max(0, Math.floor(Number(state.powerItems.owned[itemId] || 0)));
  state.powerItems.owned[itemId] = ownedNow + 1;
  appendLog(state, `Purchased power item ${item.name} for $${price}.`, now);
  return {
    ok: true,
    purchasedItemName: item.name,
    price
  };
}

export function activatePowerItem(state, itemId, now = Date.now()) {
  ensurePowerItemsState(state, now);
  const item = getPowerItemById(itemId);
  if (!item) {
    return {
      ok: false,
      message: "Power item not found."
    };
  }
  if (!state.powerItems.unlocked) {
    return {
      ok: false,
      message: `Reach level ${POWER_ITEMS_UNLOCK_LEVEL} to unlock Power Items.`
    };
  }

  const ownedNow = Math.max(0, Math.floor(Number(state.powerItems.owned[itemId] || 0)));
  if (ownedNow < 1) {
    return {
      ok: false,
      message: "You do not own this power item."
    };
  }

  const previousId = state.powerItems.active.itemId;
  state.powerItems.owned[itemId] = ownedNow - 1;
  state.powerItems.active.itemId = item.id;
  state.powerItems.active.startedAt = now;
  state.powerItems.active.endsAt = now + POWER_ITEM_DURATION_MS;

  const previousName = previousId && previousId !== item.id ? getPowerItemById(previousId)?.name : "";
  if (previousName) {
    appendLog(state, `Replaced ${previousName} with ${item.name}.`, now);
  } else {
    appendLog(state, `Activated ${item.name} for 15 hours.`, now);
  }

  return {
    ok: true,
    activatedItemName: item.name,
    replacedItemName: previousName || ""
  };
}

export function getPowerItemById(itemId) {
  return POWER_ITEMS_BY_ID[String(itemId || "")] || null;
}

function clearActivePowerItem(state) {
  state.powerItems.active = {
    itemId: null,
    startedAt: null,
    endsAt: null
  };
}

function appendLog(state, message, now) {
  const log = Array.isArray(state.log) ? state.log : [];
  state.log = [{ message, at: now }, ...log].slice(0, 15);
}
