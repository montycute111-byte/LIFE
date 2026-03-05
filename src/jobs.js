import { getCrateBoostMultipliers, getInstantJobTokenCount, maybeAwardCrate } from "./crates.js";
import { getEducationMultipliers, getEducationProgram, isEducationCompleted } from "./education.js";
import { pushLog } from "./gameState.js";
import { getPowerItemMultipliers } from "./powerItems.js";
import { trackQuestEvent } from "./quests/questEngine.js";
import { getResidenceModifiers } from "./realEstate.js";
import { awardXp, getPlayerEffects, processStoreTimers } from "./store.js";

const JOB_XP_CLAIM_MULTIPLIER = 0.35;

export const JOBS = [
  {
    id: "street_flyers",
    name: "Street Flyers",
    durationMs: 15 * 1000,
    payout: 45,
    xp: 14,
    levelRequired: 1
  },
  {
    id: "data_entry",
    name: "Data Entry Shift",
    durationMs: 30 * 1000,
    payout: 120,
    xp: 28,
    levelRequired: 2
  },
  {
    id: "delivery_loop",
    name: "Delivery Loop",
    durationMs: 45 * 1000,
    payout: 260,
    xp: 52,
    levelRequired: 4
  },
  {
    id: "night_audit",
    name: "Night Audit",
    durationMs: 70 * 1000,
    payout: 520,
    xp: 95,
    levelRequired: 6
  },
  {
    id: "vault_consulting",
    name: "Vault Consulting",
    durationMs: 110 * 1000,
    payout: 1100,
    xp: 180,
    levelRequired: 9
  },
  {
    id: "asset_recovery",
    name: "Asset Recovery Ops",
    durationMs: 150 * 1000,
    payout: 1700,
    xp: 255,
    levelRequired: 12
  },
  {
    id: "compliance_sweep",
    name: "Compliance Sweep",
    durationMs: 195 * 1000,
    payout: 2550,
    xp: 360,
    levelRequired: 15
  },
  {
    id: "hedge_modeling",
    name: "Hedge Modeling",
    durationMs: 250 * 1000,
    payout: 3800,
    xp: 500,
    levelRequired: 18
  },
  {
    id: "risk_command",
    name: "Risk Command Center",
    durationMs: 320 * 1000,
    payout: 5600,
    xp: 700,
    levelRequired: 22
  },
  {
    id: "quant_pipeline",
    name: "Quant Pipeline Build",
    durationMs: 410 * 1000,
    payout: 8200,
    xp: 960,
    levelRequired: 27
  },
  {
    id: "sovereign_audit",
    name: "Sovereign Audit Contract",
    durationMs: 520 * 1000,
    payout: 12000,
    xp: 1300,
    levelRequired: 32
  },
  {
    id: "interbank_merger",
    name: "Interbank Merger Deal",
    durationMs: 660 * 1000,
    payout: 17500,
    xp: 1750,
    levelRequired: 38
  },
  {
    id: "global_reserve",
    name: "Global Reserve Strategy",
    durationMs: 840 * 1000,
    payout: 25000,
    xp: 2350,
    levelRequired: 45
  },
  {
    id: "liquidity_backstop",
    name: "Liquidity Backstop Plan",
    durationMs: 1020 * 1000,
    payout: 34000,
    xp: 3000,
    levelRequired: 52
  },
  {
    id: "macro_futures_grid",
    name: "Macro Futures Grid",
    durationMs: 1240 * 1000,
    payout: 46000,
    xp: 3850,
    levelRequired: 60
  },
  {
    id: "continental_clearing",
    name: "Continental Clearing Ops",
    durationMs: 1500 * 1000,
    payout: 62000,
    xp: 4850,
    levelRequired: 68
  },
  {
    id: "orbital_rebalance",
    name: "Orbital Reserve Rebalance",
    durationMs: 1800 * 1000,
    payout: 82000,
    xp: 6100,
    levelRequired: 76
  },
  {
    id: "mythic_treasury",
    name: "Mythic Treasury Directive",
    durationMs: 2160 * 1000,
    payout: 108000,
    xp: 7600,
    levelRequired: 85
  },
  {
    id: "hs_fintech_capstone",
    name: "HS FinTech Capstone Desk",
    durationMs: 2520 * 1000,
    payout: 185000,
    xp: 8600,
    levelRequired: 95,
    educationRequired: "hs"
  },
  {
    id: "alumni_private_ledger",
    name: "Alumni Private Ledger Ops",
    durationMs: 3000 * 1000,
    payout: 295000,
    xp: 10400,
    levelRequired: 108,
    educationRequired: "hs"
  },
  {
    id: "academy_global_settlement",
    name: "Academy Global Settlement",
    durationMs: 3540 * 1000,
    payout: 460000,
    xp: 12500,
    levelRequired: 122,
    educationRequired: "hs"
  },
  {
    id: "college_quant_arbitrage",
    name: "College Quant Arbitrage",
    durationMs: 4200 * 1000,
    payout: 760000,
    xp: 15200,
    levelRequired: 150,
    educationRequired: "college"
  },
  {
    id: "doctoral_sovereign_engine",
    name: "Doctoral Sovereign Yield Engine",
    durationMs: 4920 * 1000,
    payout: 1180000,
    xp: 18600,
    levelRequired: 170,
    educationRequired: "college"
  },
  {
    id: "ivy_fusion_derivatives",
    name: "Ivy Fusion Derivatives Desk",
    durationMs: 5760 * 1000,
    payout: 1820000,
    xp: 22600,
    levelRequired: 192,
    educationRequired: "college"
  },
  {
    id: "interstellar_endowment",
    name: "Interstellar Endowment Command",
    durationMs: 6720 * 1000,
    payout: 2740000,
    xp: 27200,
    levelRequired: 220,
    educationRequired: "college"
  }
];

export function refreshTimedState(state, now = Date.now()) {
  const storeUpdates = processStoreTimers(state, now);
  if (state.streak.windowEndsAt && now > state.streak.windowEndsAt) {
    state.streak.count = 0;
    state.streak.windowEndsAt = 0;
  }
  return {
    deliveredCount: Number(storeUpdates?.deliveredItems?.length || 0)
  };
}

export function canStartJob(state, jobId, now = Date.now()) {
  const job = JOBS.find((entry) => entry.id === jobId);
  if (!job) {
    return {
      ok: false,
      message: "Job not found."
    };
  }

  const effects = getPlayerEffects(state, now);
  if (state.level < job.levelRequired) {
    return {
      ok: false,
      message: `Unlocks at level ${job.levelRequired}.`
    };
  }
  if (job.educationRequired && !isEducationCompleted(state, job.educationRequired)) {
    return {
      ok: false,
      message: `Requires completed ${getEducationRequirementLabel(job.educationRequired)}.`
    };
  }
  if (state.activeJobs.length >= effects.maxActiveJobs) {
    return {
      ok: false,
      message: `All ${effects.maxActiveJobs} job slots are full.`
    };
  }

  return {
    ok: true,
    job,
    effects
  };
}

function getEducationRequirementLabel(programId) {
  return getEducationProgram(programId)?.name || "education program";
}

export function startJob(state, jobId, now = Date.now()) {
  const result = canStartJob(state, jobId, now);
  if (!result.ok) {
    return result;
  }

  const { job, effects } = result;
  const streakBonus = Math.min(state.streak.count * 0.05, 0.35);
  const crateBoosts = getCrateBoostMultipliers(state, now);
  const powerMultipliers = getPowerItemMultipliers(state, now);
  const durationMs = Math.max(
    5 * 1000,
    Math.round(job.durationMs * effects.durationMultiplier * Math.max(0, Number(powerMultipliers.jobTimeMult || 1)))
  );
  const payout = Math.round(
    job.payout
    * effects.payoutMultiplier
    * (1 + streakBonus)
    * Math.max(0, Number(crateBoosts.jobPayoutMultiplier || 1))
  );
  const xp = Math.round(job.xp * effects.xpMultiplier);

  state.activeJobs.push({
    id: `${job.id}_${now}_${Math.random().toString(36).slice(2, 7)}`,
    jobId: job.id,
    name: job.name,
    startedAt: now,
    endsAt: now + durationMs,
    payout,
    xp
  });

  pushLog(state, `Started ${job.name}.`, now);
  return {
    ok: true,
    job
  };
}

export function startJobToFillSlots(state, jobId, now = Date.now()) {
  const effects = getPlayerEffects(state, now);
  const openSlots = Math.max(0, effects.maxActiveJobs - state.activeJobs.length);
  if (openSlots < 1) {
    return {
      ok: false,
      message: `All ${effects.maxActiveJobs} job slots are full.`
    };
  }

  let started = 0;
  let firstJob = null;
  for (let i = 0; i < openSlots; i += 1) {
    const result = startJob(state, jobId, now + i);
    if (!result.ok) {
      if (started < 1) {
        return result;
      }
      break;
    }
    if (!firstJob) {
      firstJob = result.job;
    }
    started += 1;
  }

  return {
    ok: true,
    job: firstJob,
    startedCount: started
  };
}

export function claimReadyJobs(state, now = Date.now()) {
  const readyJobs = state.activeJobs.filter((job) => job.endsAt <= now);
  if (readyJobs.length < 1) {
    return {
      ok: false,
      message: "No jobs are ready yet."
    };
  }

  const effects = getPlayerEffects(state, now);
  const residenceModifiers = getResidenceModifiers(state);
  const educationMultipliers = getEducationMultipliers(state);
  const powerMultipliers = getPowerItemMultipliers(state, now);
  const crateDrops = {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0
  };
  let totalCash = 0;
  let totalXp = 0;

  for (const job of readyJobs) {
    const luckyDouble = effects.luckyDoubleChance > 0 && Math.random() < effects.luckyDoubleChance;
    const baseCash = luckyDouble ? job.payout * 2 : job.payout;
    totalCash += Math.round(
      baseCash
      * Math.max(0, Number(residenceModifiers.jobPayoutMult || 1))
      // Education is applied at payout finalization only.
      * Math.max(0, Number(educationMultipliers.jobMultiplier || 1))
      * Math.max(0, Number(powerMultipliers.jobPayoutMult || 1))
    );

    const baseXp = Math.max(1, Math.round(job.xp * JOB_XP_CLAIM_MULTIPLIER));
    totalXp += Math.max(1, Math.round(baseXp * Math.max(0, Number(residenceModifiers.jobXpMult || 1))));
    const drop = maybeAwardCrate(state, "jobComplete", now);
    if (drop?.rarity && Object.prototype.hasOwnProperty.call(crateDrops, drop.rarity)) {
      crateDrops[drop.rarity] += 1;
    }
  }

  state.activeJobs = state.activeJobs.filter((job) => job.endsAt > now);
  state.money += totalCash;
  state.stats.jobsCompleted += readyJobs.length;
  state.stats.totalEarned += totalCash;

  if (state.streak.windowEndsAt && now <= state.streak.windowEndsAt) {
    state.streak.count += readyJobs.length;
  } else {
    state.streak.count = readyJobs.length;
  }
  state.streak.best = Math.max(state.streak.best, state.streak.count);
  state.streak.lastClaimAt = now;
  state.streak.windowEndsAt = now + effects.streakWindowMs;

  const levelsGained = awardXp(state, totalXp, now);
  trackQuestEvent(state, "JOB_COMPLETE", { count: readyJobs.length, amount: totalCash });
  pushLog(state, `Claimed ${readyJobs.length} job(s): +$${totalCash} and +${totalXp} XP.`, now);
  const totalDrops = crateDrops.common + crateDrops.rare + crateDrops.epic + crateDrops.legendary;
  if (totalDrops > 0) {
    pushLog(
      state,
      `Crate drops: ${crateDrops.common} Common, ${crateDrops.rare} Rare, ${crateDrops.epic} Epic, ${crateDrops.legendary} Legendary.`,
      now
    );
  }

  return {
    ok: true,
    count: readyJobs.length,
    totalCash,
    totalXp,
    levelsGained,
    crateDrops
  };
}

export function useInstantJobToken(state, activeJobId, now = Date.now()) {
  if (!state.rebirthShop || typeof state.rebirthShop !== "object") {
    state.rebirthShop = { instantJobTokens: 0 };
  }
  const totalTokens = getInstantJobTokenCount(state);
  if (totalTokens < 1) {
    return {
      ok: false,
      message: "No instant job tokens available."
    };
  }

  const jobs = Array.isArray(state.activeJobs) ? state.activeJobs : [];
  const targetIndex = jobs.findIndex((job) => job.id === activeJobId);
  if (targetIndex < 0) {
    return {
      ok: false,
      message: "Job not found."
    };
  }

  const [job] = jobs.splice(targetIndex, 1);
  state.activeJobs = jobs;
  const crateTokens = Math.max(0, Math.floor(Number(state?.instantTokens || 0)));
  if (crateTokens > 0) {
    state.instantTokens = crateTokens - 1;
  } else {
    const rebirthTokens = Math.max(0, Math.floor(Number(state?.rebirthShop?.instantJobTokens || 0)));
    state.rebirthShop.instantJobTokens = Math.max(0, rebirthTokens - 1);
  }

  const effects = getPlayerEffects(state, now);
  const residenceModifiers = getResidenceModifiers(state);
  const educationMultipliers = getEducationMultipliers(state);
  const powerMultipliers = getPowerItemMultipliers(state, now);
  const luckyDouble = effects.luckyDoubleChance > 0 && Math.random() < effects.luckyDoubleChance;
  const baseCash = luckyDouble ? job.payout * 2 : job.payout;
  const totalCash = Math.round(
    baseCash
    * Math.max(0, Number(residenceModifiers.jobPayoutMult || 1))
    * Math.max(0, Number(educationMultipliers.jobMultiplier || 1))
    * Math.max(0, Number(powerMultipliers.jobPayoutMult || 1))
  );
  const baseXp = Math.max(1, Math.round(job.xp * JOB_XP_CLAIM_MULTIPLIER));
  const totalXp = Math.max(1, Math.round(baseXp * Math.max(0, Number(residenceModifiers.jobXpMult || 1))));

  state.money += totalCash;
  state.stats.jobsCompleted += 1;
  state.stats.totalEarned += totalCash;
  if (state.streak.windowEndsAt && now <= state.streak.windowEndsAt) {
    state.streak.count += 1;
  } else {
    state.streak.count = 1;
  }
  state.streak.best = Math.max(state.streak.best, state.streak.count);
  state.streak.lastClaimAt = now;
  state.streak.windowEndsAt = now + effects.streakWindowMs;

  const levelsGained = awardXp(state, totalXp, now);
  const drop = maybeAwardCrate(state, "jobComplete", now);
  trackQuestEvent(state, "JOB_COMPLETE", { count: 1, amount: totalCash });
  pushLog(state, `Used token on ${job.name}: +$${totalCash}, +${totalXp} XP.`, now);
  if (drop?.rarity) {
    pushLog(state, `Token completion crate drop: ${drop.rarity}.`, now);
  }

  return {
    ok: true,
    job,
    totalCash,
    totalXp,
    levelsGained,
    tokensLeft: getInstantJobTokenCount(state)
  };
}
