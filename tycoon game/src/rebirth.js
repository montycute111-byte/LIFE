export const REBIRTH_UNLOCK_LEVEL = 400;
export const REBIRTH_UNLOCK_MONEY = 100_000_000_000_000;

const REBIRTH_SHOP_DEFS = [
  {
    id: "starterMoneyLevel",
    name: "Starter Money",
    cost: 5,
    description: "Each level adds +$1,000,000 at the start of every rebirth run."
  },
  {
    id: "extraJobSlots",
    name: "Extra Job Slot",
    cost: 8,
    description: "Each purchase adds +1 permanent active job slot."
  },
  {
    id: "businessBoostLevel",
    name: "Business Boost",
    cost: 10,
    description: "Each level adds +50% business profit permanently."
  },
  {
    id: "instantJobTokens",
    name: "Instant Job Token",
    cost: 3,
    description: "Adds 1 token. Spend a token to instantly finish one active job."
  }
];

export function createDefaultRebirthBonuses() {
  return {
    incomeMult: 0,
    jobIncomeMult: 0,
    businessIncomeMult: 0,
    jobTimeMult: 1
  };
}

export function createDefaultRebirthShop() {
  return {
    starterMoneyLevel: 0,
    extraJobSlots: 0,
    businessBoostLevel: 0,
    instantJobTokens: 0
  };
}

export function ensureRebirthState(state) {
  const defaultBonuses = createDefaultRebirthBonuses();
  const defaultShop = createDefaultRebirthShop();

  state.rebirths = clampWholeNumber(state.rebirths, 0);
  state.rebirthPoints = clampWholeNumber(state.rebirthPoints, 0);
  state.rebirthPointsSpent = clampWholeNumber(state.rebirthPointsSpent, 0);
  state.rebirthTotalPointsEarned = clampWholeNumber(state.rebirthTotalPointsEarned, 0);

  const rawBonuses = state.rebirthBonuses && typeof state.rebirthBonuses === "object" ? state.rebirthBonuses : {};
  state.rebirthBonuses = {
    incomeMult: numberOr(rawBonuses.incomeMult, defaultBonuses.incomeMult),
    jobIncomeMult: numberOr(rawBonuses.jobIncomeMult, defaultBonuses.jobIncomeMult),
    businessIncomeMult: numberOr(rawBonuses.businessIncomeMult, defaultBonuses.businessIncomeMult),
    jobTimeMult: numberOr(rawBonuses.jobTimeMult, defaultBonuses.jobTimeMult)
  };

  const rawShop = state.rebirthShop && typeof state.rebirthShop === "object" ? state.rebirthShop : {};
  state.rebirthShop = {
    starterMoneyLevel: clampWholeNumber(rawShop.starterMoneyLevel, defaultShop.starterMoneyLevel),
    extraJobSlots: clampWholeNumber(rawShop.extraJobSlots, defaultShop.extraJobSlots),
    businessBoostLevel: clampWholeNumber(rawShop.businessBoostLevel, defaultShop.businessBoostLevel),
    instantJobTokens: clampWholeNumber(rawShop.instantJobTokens, defaultShop.instantJobTokens)
  };

  syncRebirthBonuses(state);
  return state;
}

export function calculateRebirthAward(level, money) {
  const safeLevel = Math.max(1, Math.floor(Number(level || 1)));
  const safeMoney = Math.max(1, Number(money || 0));
  return Math.max(0, Math.floor(safeLevel / 50) + Math.floor(Math.log10(safeMoney)));
}

export function getProjectedRebirthAward(state) {
  ensureRebirthState(state);
  return calculateRebirthAward(state.level, state.money);
}

export function isRebirthUnlocked(state) {
  return Number(state?.level || 0) >= REBIRTH_UNLOCK_LEVEL
    && Number(state?.money || 0) >= REBIRTH_UNLOCK_MONEY;
}

export function getRebirthRuntimeModifiers(state) {
  ensureRebirthState(state);
  const pointJobIncomeMult = 1 + Math.max(0, Number(state.rebirthBonuses.jobIncomeMult || 0));
  const pointBusinessIncomeMult = 1 + Math.max(0, Number(state.rebirthBonuses.businessIncomeMult || 0));
  const shopBusinessMult = 1 + Math.max(0, Number(state.rebirthShop.businessBoostLevel || 0)) * 0.5;
  const jobTimeMult = Math.max(0.1, Number(state.rebirthBonuses.jobTimeMult || 1));

  return {
    incomeMult: 1 + Math.max(0, Number(state.rebirthBonuses.incomeMult || 0)),
    jobIncomeMult: pointJobIncomeMult,
    businessIncomeMult: pointBusinessIncomeMult * shopBusinessMult,
    jobTimeMult,
    extraJobSlots: Math.max(0, Number(state.rebirthShop.extraJobSlots || 0)),
    starterMoney: getStarterMoneyFromShop(state),
    instantJobTokens: Math.max(0, Number(state.rebirthShop.instantJobTokens || 0))
  };
}

export function getRebirthShopDefs() {
  return REBIRTH_SHOP_DEFS.slice();
}

export function getRebirthUpgradeCost(upgradeId) {
  const def = REBIRTH_SHOP_DEFS.find((entry) => entry.id === upgradeId);
  return def ? def.cost : 0;
}

export function buyRebirthShopUpgrade(state, upgradeId, now = Date.now()) {
  ensureRebirthState(state);
  const def = REBIRTH_SHOP_DEFS.find((entry) => entry.id === upgradeId);
  if (!def) {
    return {
      ok: false,
      message: "Upgrade not found."
    };
  }
  if (state.rebirthPoints < def.cost) {
    return {
      ok: false,
      message: "Not enough rebirth points."
    };
  }

  state.rebirthPoints -= def.cost;
  state.rebirthPointsSpent += def.cost;

  if (upgradeId === "starterMoneyLevel") {
    state.rebirthShop.starterMoneyLevel += 1;
  } else if (upgradeId === "extraJobSlots") {
    state.rebirthShop.extraJobSlots += 1;
  } else if (upgradeId === "businessBoostLevel") {
    state.rebirthShop.businessBoostLevel += 1;
  } else if (upgradeId === "instantJobTokens") {
    state.rebirthShop.instantJobTokens += 1;
  }

  pushLogLine(state, `Purchased Rebirth upgrade: ${def.name} (${def.cost} pts).`, now);
  return {
    ok: true,
    upgradeId,
    upgradeName: def.name,
    cost: def.cost
  };
}

export function performRebirth(state, now = Date.now()) {
  ensureRebirthState(state);
  if (!isRebirthUnlocked(state)) {
    return {
      ok: false,
      message: `Rebirth unlocks at Level ${REBIRTH_UNLOCK_LEVEL} and $${REBIRTH_UNLOCK_MONEY.toLocaleString()}.`
    };
  }

  const award = getProjectedRebirthAward(state);
  state.rebirths += 1;
  state.rebirthPoints += award;
  state.rebirthTotalPointsEarned += award;
  syncRebirthBonuses(state);

  const starterMoney = getStarterMoneyFromShop(state);

  state.money = starterMoney;
  state.level = 1;
  state.xp = 0;
  state.activeJobs = [];
  state.ownedItems = {};
  state.cooldowns = {};
  state.businesses = {
    buyMultiplier: 1,
    lastPassiveTickAt: now,
    owned: {}
  };
  state.realEstate = {
    owned: {},
    activeResidenceId: null
  };
  state.orders = [];
  state.inventory = [];
  state.activeAbility = null;
  state.activeAbilities = [];
  state.boosts = {
    focusBurstUntil: 0
  };
  state.streak = {
    count: 0,
    best: 0,
    lastClaimAt: 0,
    windowEndsAt: 0
  };
  state.daily = {
    lastClaimAt: 0,
    nextClaimAt: 0
  };
  state.stats = {
    jobsCompleted: 0,
    totalEarned: starterMoney
  };
  state.settings = {
    ...(state.settings && typeof state.settings === "object" ? state.settings : {}),
    activeTab: "rebirth"
  };

  state.log = [
    {
      message: `Rebirth complete! +${award} points earned. Fresh run started with $${starterMoney.toLocaleString()}.`,
      at: now
    }
  ];

  return {
    ok: true,
    award,
    rebirths: state.rebirths,
    starterMoney
  };
}

function syncRebirthBonuses(state) {
  const totalPoints = Math.max(0, Math.floor(Number(state.rebirthTotalPointsEarned || 0)));
  state.rebirthBonuses.incomeMult = 0.05 * totalPoints;
  state.rebirthBonuses.jobIncomeMult = 0.05 * totalPoints;
  state.rebirthBonuses.businessIncomeMult = 0.05 * totalPoints;
  state.rebirthBonuses.jobTimeMult = Math.max(0.1, 1 - 0.02 * totalPoints);
}

function getStarterMoneyFromShop(state) {
  return Math.max(0, Number(state?.rebirthShop?.starterMoneyLevel || 0)) * 1_000_000;
}

function pushLogLine(state, message, now) {
  const currentLog = Array.isArray(state.log) ? state.log : [];
  state.log = [{ message, at: now }, ...currentLog].slice(0, 15);
}

function clampWholeNumber(value, fallback) {
  const safe = Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.floor(safe));
}

function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

/*
Manual test checklist:
- New account: rebirth fields initialize to zero/defaults.
- Old save: ensureRebirthState fills missing fields without crashes.
- At level 400 and money 100T+: rebirth unlocks and award matches formula.
- Rebirth: core progress resets, rebirth stats persist, starter money applies.
- Rebirth shop purchases persist and rebirthPoints never go negative.
- Instant Job Token count can be spent by active-job token action.
*/
