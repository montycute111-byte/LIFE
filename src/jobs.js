import { pushLog } from "./gameState.js";
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

export function startJob(state, jobId, now = Date.now()) {
  const result = canStartJob(state, jobId, now);
  if (!result.ok) {
    return result;
  }

  const { job, effects } = result;
  const streakBonus = Math.min(state.streak.count * 0.05, 0.35);
  const durationMs = Math.max(5 * 1000, Math.round(job.durationMs * effects.durationMultiplier));
  const payout = Math.round(job.payout * effects.payoutMultiplier * (1 + streakBonus));
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
  let totalCash = 0;
  let totalXp = 0;

  for (const job of readyJobs) {
    const luckyDouble = effects.luckyDoubleChance > 0 && Math.random() < effects.luckyDoubleChance;
    const baseCash = luckyDouble ? job.payout * 2 : job.payout;
    totalCash += Math.round(baseCash * Math.max(0, Number(residenceModifiers.jobPayoutMult || 1)));

    const baseXp = Math.max(1, Math.round(job.xp * JOB_XP_CLAIM_MULTIPLIER));
    totalXp += Math.max(1, Math.round(baseXp * Math.max(0, Number(residenceModifiers.jobXpMult || 1))));
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
  pushLog(state, `Claimed ${readyJobs.length} job(s): +$${totalCash} and +${totalXp} XP.`, now);

  return {
    ok: true,
    count: readyJobs.length,
    totalCash,
    totalXp,
    levelsGained
  };
}
