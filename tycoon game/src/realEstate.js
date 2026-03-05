const MAX_DELIVERY_SPEED = 0.60;
const MAX_DAILY_REDUCTION_MS = 3 * 60 * 60 * 1000;

export const RESIDENCE_DEFS = [
  {
    id: "studio",
    name: "Starter Studio",
    unlockLevel: 2,
    basePrice: 2000,
    perkType: "JOB_PAYOUT_MULT",
    baseValue: 1.05,
    perUpgradeDelta: 0.02,
    maxUpgrade: 10,
    upgradeBaseCost: 1500,
    upgradeGrowth: 1.30,
    description: "A tiny place that boosts your hustle."
  },
  {
    id: "apartment",
    name: "Basic Apartment",
    unlockLevel: 4,
    basePrice: 9000,
    perkType: "JOB_XP_MULT",
    baseValue: 1.10,
    perUpgradeDelta: 0.03,
    maxUpgrade: 10,
    upgradeBaseCost: 5000,
    upgradeGrowth: 1.30,
    description: "A practical upgrade for focused growth."
  },
  {
    id: "loft",
    name: "City Loft",
    unlockLevel: 6,
    basePrice: 25000,
    perkType: "DELIVERY_SPEED",
    baseValue: 0.20,
    perUpgradeDelta: 0.05,
    maxUpgrade: 8,
    upgradeBaseCost: 12000,
    upgradeGrowth: 1.35,
    description: "Closer to the city means faster deliveries."
  },
  {
    id: "house_small",
    name: "Small House",
    unlockLevel: 8,
    basePrice: 80000,
    perkType: "JOB_SLOTS_BONUS",
    baseValue: 1,
    perUpgradeDelta: 0,
    maxUpgrade: 6,
    upgradeBaseCost: 25000,
    upgradeGrowth: 1.40,
    description: "Extra space for a larger operation."
  },
  {
    id: "house_nice",
    name: "Nice House",
    unlockLevel: 10,
    basePrice: 220000,
    perkType: "BUSINESS_INCOME_MULT",
    baseValue: 1.10,
    perUpgradeDelta: 0.04,
    maxUpgrade: 10,
    upgradeBaseCost: 60000,
    upgradeGrowth: 1.35,
    description: "Comfort plus stronger passive business returns."
  },
  {
    id: "mansion",
    name: "Luxury Mansion",
    unlockLevel: 14,
    basePrice: 900000,
    perkType: "DAILY_COOLDOWN_REDUCE_MS",
    baseValue: 60 * 60 * 1000,
    perUpgradeDelta: 10 * 60 * 1000,
    maxUpgrade: 12,
    upgradeBaseCost: 200000,
    upgradeGrowth: 1.40,
    description: "Elite perks with major daily cooldown relief."
  }
];

export function createDefaultRealEstateState() {
  return {
    owned: {},
    activeResidenceId: null
  };
}

export function ensureRealEstateState(state) {
  const fallback = createDefaultRealEstateState();
  const raw = state?.realEstate;
  const owned = raw?.owned && typeof raw.owned === "object" ? raw.owned : {};
  let activeResidenceId = typeof raw?.activeResidenceId === "string" ? raw.activeResidenceId : null;

  const activeDef = activeResidenceId ? getResidenceDef(activeResidenceId) : null;
  const activeOwned = activeResidenceId ? owned[activeResidenceId] : null;
  if (!activeDef || !activeOwned?.owned) {
    activeResidenceId = null;
  }

  state.realEstate = {
    owned,
    activeResidenceId
  };
  return state.realEstate;
}

export function getResidenceDef(residenceId) {
  return RESIDENCE_DEFS.find((entry) => entry.id === residenceId) || null;
}

export function getResidenceState(state, residenceId) {
  ensureRealEstateState(state);
  const current = state.realEstate.owned[residenceId];
  return {
    owned: Boolean(current?.owned),
    upgradeLevel: Math.max(0, Math.floor(Number(current?.upgradeLevel || 0)))
  };
}

export function getResidenceUpgradeCost(definition, upgradeLevel) {
  return Math.max(1, Math.round(definition.upgradeBaseCost * (definition.upgradeGrowth ** Math.max(0, upgradeLevel))));
}

export function getResidencePerkValue(definition, upgradeLevel) {
  const level = Math.max(0, Math.floor(Number(upgradeLevel || 0)));

  if (definition.perkType === "JOB_SLOTS_BONUS") {
    return definition.baseValue + Math.floor(level / 2);
  }
  if (definition.perkType === "DELIVERY_SPEED") {
    const speed = definition.baseValue + (definition.perUpgradeDelta * level);
    return Math.min(MAX_DELIVERY_SPEED, speed);
  }
  if (definition.perkType === "DAILY_COOLDOWN_REDUCE_MS") {
    const reduction = definition.baseValue + (definition.perUpgradeDelta * level);
    return Math.min(MAX_DAILY_REDUCTION_MS, reduction);
  }

  return definition.baseValue + (definition.perUpgradeDelta * level);
}

export function getResidenceModifiers(state) {
  ensureRealEstateState(state);
  const defaults = {
    jobPayoutMult: 1,
    jobXpMult: 1,
    deliverySpeed: 0,
    jobSlotsBonus: 0,
    businessIncomeMult: 1,
    dailyCooldownReduceMs: 0
  };

  const activeId = state.realEstate.activeResidenceId;
  if (!activeId) {
    return defaults;
  }

  const definition = getResidenceDef(activeId);
  const residenceState = getResidenceState(state, activeId);
  if (!definition || !residenceState.owned) {
    state.realEstate.activeResidenceId = null;
    return defaults;
  }

  const perkValue = getResidencePerkValue(definition, residenceState.upgradeLevel);
  const modifiers = { ...defaults };

  if (definition.perkType === "JOB_PAYOUT_MULT") {
    modifiers.jobPayoutMult = perkValue;
  } else if (definition.perkType === "JOB_XP_MULT") {
    modifiers.jobXpMult = perkValue;
  } else if (definition.perkType === "DELIVERY_SPEED") {
    modifiers.deliverySpeed = perkValue;
  } else if (definition.perkType === "JOB_SLOTS_BONUS") {
    modifiers.jobSlotsBonus = perkValue;
  } else if (definition.perkType === "BUSINESS_INCOME_MULT") {
    modifiers.businessIncomeMult = perkValue;
  } else if (definition.perkType === "DAILY_COOLDOWN_REDUCE_MS") {
    modifiers.dailyCooldownReduceMs = perkValue;
  }

  return modifiers;
}

export function buyResidence(state, residenceId) {
  ensureRealEstateState(state);
  const definition = getResidenceDef(residenceId);
  if (!definition) {
    return {
      ok: false,
      message: "Residence not found."
    };
  }
  if (state.level < definition.unlockLevel) {
    return {
      ok: false,
      message: `Unlocks at level ${definition.unlockLevel}.`
    };
  }

  const current = getResidenceState(state, residenceId);
  if (current.owned) {
    return {
      ok: false,
      message: "Residence already owned."
    };
  }
  if (Number(state.money || 0) < definition.basePrice) {
    return {
      ok: false,
      message: "Not enough cash."
    };
  }

  state.money -= definition.basePrice;
  state.realEstate.owned[residenceId] = {
    owned: true,
    upgradeLevel: 0
  };

  return {
    ok: true,
    residenceName: definition.name
  };
}

export function moveInResidence(state, residenceId) {
  ensureRealEstateState(state);
  const definition = getResidenceDef(residenceId);
  if (!definition) {
    return {
      ok: false,
      message: "Residence not found."
    };
  }
  const current = getResidenceState(state, residenceId);
  if (!current.owned) {
    return {
      ok: false,
      message: "You do not own this residence."
    };
  }

  state.realEstate.activeResidenceId = residenceId;
  return {
    ok: true,
    residenceName: definition.name,
    movedIn: true
  };
}

export function moveOutResidence(state) {
  ensureRealEstateState(state);
  state.realEstate.activeResidenceId = null;
  return {
    ok: true,
    movedOut: true
  };
}

export function upgradeActiveResidence(state) {
  ensureRealEstateState(state);
  const activeId = state.realEstate.activeResidenceId;
  if (!activeId) {
    return {
      ok: false,
      message: "No active residence selected."
    };
  }

  const definition = getResidenceDef(activeId);
  const residenceState = getResidenceState(state, activeId);
  if (!definition || !residenceState.owned) {
    state.realEstate.activeResidenceId = null;
    return {
      ok: false,
      message: "Active residence is invalid."
    };
  }
  if (residenceState.upgradeLevel >= definition.maxUpgrade) {
    return {
      ok: false,
      message: "Residence is max upgrade."
    };
  }

  const upgradeCost = getResidenceUpgradeCost(definition, residenceState.upgradeLevel);
  if (Number(state.money || 0) < upgradeCost) {
    return {
      ok: false,
      message: "Not enough cash for upgrade."
    };
  }

  state.money -= upgradeCost;
  state.realEstate.owned[activeId] = {
    owned: true,
    upgradeLevel: residenceState.upgradeLevel + 1
  };

  return {
    ok: true,
    residenceName: definition.name,
    newLevel: residenceState.upgradeLevel + 1
  };
}

export function formatResidencePerk(definition, perkValue) {
  if (definition.perkType === "JOB_PAYOUT_MULT" || definition.perkType === "JOB_XP_MULT" || definition.perkType === "BUSINESS_INCOME_MULT") {
    return `${Math.round((perkValue - 1) * 100)}% bonus`;
  }
  if (definition.perkType === "DELIVERY_SPEED") {
    return `${Math.round(perkValue * 100)}% faster deliveries`;
  }
  if (definition.perkType === "JOB_SLOTS_BONUS") {
    return `+${Math.round(perkValue)} job slots`;
  }
  if (definition.perkType === "DAILY_COOLDOWN_REDUCE_MS") {
    return `${Math.round(perkValue / (60 * 1000))} min daily cooldown reduction`;
  }
  return "";
}
