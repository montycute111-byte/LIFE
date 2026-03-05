import {
  BUSINESS_DEFS,
  getBusinessIncomePerSec,
  getPassiveCycleProgress,
  getBusinessPurchasePreview,
  getPassiveIntervalSeconds,
  getTotalPassivePayoutPerCycle,
  getBusinessState,
  getUpgradeCost
} from "./businesses.js";
import { getInstantJobTokenCount, nowMs } from "./crates.js";
import { getEducationProgram, isEducationCompleted } from "./education.js";
import { xpRequiredForLevel } from "./gameState.js";
import { JOBS } from "./jobs.js";
import {
  getActivePowerItem,
  getPowerItemPrice,
  POWER_ITEMS,
  POWER_ITEMS_UNLOCK_LEVEL
} from "./powerItems.js";
import {
  RESIDENCE_DEFS,
  formatResidencePerk,
  getResidenceDef,
  getResidencePerkValue,
  getResidenceState,
  getResidenceUpgradeCost
} from "./realEstate.js";
import {
  REBIRTH_UNLOCK_LEVEL,
  REBIRTH_UNLOCK_MONEY,
  getProjectedRebirthAward,
  getRebirthRuntimeModifiers,
  getRebirthShopDefs,
  getRebirthUpgradeCost,
  isRebirthUnlocked
} from "./rebirth.js";
import {
  ABILITY_DURATION_MS,
  STORE_ITEMS,
  getActiveAbilities,
  getOrderStatus,
  getPlayerEffects,
  getStoreItemPrice,
  getMaxActiveAbilitySlots
} from "./store.js";
import { QUESTS_BY_ID } from "./quests/questDefinitions.js";

export function renderApp(root, viewModel, handlers) {
  if (!root) {
    return;
  }

  root.innerHTML = viewModel.session
    ? renderGame(viewModel)
    : renderAuth(viewModel);

  bindEvents(root, viewModel, handlers);
}

function renderAuth(viewModel) {
  return `
    <section class="card auth-card">
      <h1>Fake Bank Account Simulator</h1>
      <p class="sub">Local-only accounts. No Firebase. No cloud saves.</p>
      <form id="authForm" class="auth-form">
        <label for="usernameInput">Username</label>
        <input id="usernameInput" type="text" placeholder="username" autocomplete="username" />
        <label for="passwordInput">Password</label>
        <input id="passwordInput" type="password" placeholder="password" autocomplete="current-password" />
        <p class="hint">${escapeHtml(viewModel.notice || "Accounts and saves stay in this browser only.")}</p>
        <p class="hint error">${escapeHtml(viewModel.authError || "")}</p>
        <div class="top-actions">
          <button id="loginBtn" class="btn" type="submit">Log In</button>
          <button id="signupBtn" class="btn secondary" type="button">Sign Up</button>
          <button id="guestBtn" class="btn tertiary" type="button">Guest</button>
        </div>
      </form>
    </section>
  `;
}

function renderGame(viewModel) {
  const { session, state, saveStatus, notice } = viewModel;
  const now = Date.now();
  const effects = getPlayerEffects(state, now);
  const activeTab = state?.settings?.activeTab || "dashboard";

  return `
    <section class="section-stack">
      <header class="topbar card app-topbar">
        <div>
          <h1>Fake Bank Account Simulator</h1>
          <p class="sub">Current user: ${escapeHtml(session.username)}${session.isGuest ? " (guest)" : ""}</p>
          <p class="hint">Save status: ${escapeHtml(saveStatus || "Idle")}</p>
          <p class="hint">${escapeHtml(notice || "Every action saves locally, plus autosave every 30 seconds.")}</p>
        </div>
        <div class="top-actions">
          <button id="dailyBtn" class="btn">Claim Daily</button>
          <button id="saveNowBtn" class="btn secondary">Save</button>
          <button id="logoutBtn" class="btn danger">Logout</button>
        </div>
      </header>

      <section class="card app-nav-card">
        <div class="top-actions tab-strip">
          <button class="tab-btn ${activeTab === "dashboard" ? "active" : ""}" data-action="tab" data-tab="dashboard">Dashboard</button>
          <button class="tab-btn ${activeTab === "jobs" ? "active" : ""}" data-action="tab" data-tab="jobs">All Jobs</button>
          <button class="tab-btn ${activeTab === "businesses" ? "active" : ""}" data-action="tab" data-tab="businesses">Businesses</button>
          <button class="tab-btn ${activeTab === "crates" ? "active" : ""}" data-action="tab" data-tab="crates">Crates</button>
          <button class="tab-btn ${activeTab === "education" ? "active" : ""}" data-action="tab" data-tab="education">Education</button>
          <button class="tab-btn ${activeTab === "quests" ? "active" : ""}" data-action="tab" data-tab="quests">Quests</button>
          <button class="tab-btn ${activeTab === "rebirth" ? "active" : ""}" data-action="tab" data-tab="rebirth">Rebirth</button>
          <button class="tab-btn ${activeTab === "realestate" ? "active" : ""}" data-action="tab" data-tab="realestate">Real Estate</button>
          <button class="tab-btn ${activeTab === "store" || activeTab === "poweritems" ? "active" : ""}" data-action="tab" data-tab="store">Store</button>
          <button class="tab-btn ${activeTab === "orders" ? "active" : ""}" data-action="tab" data-tab="orders">Track Orders</button>
          <button class="tab-btn ${activeTab === "inventory" ? "active" : ""}" data-action="tab" data-tab="inventory">Inventory</button>
        </div>
      </section>

      ${renderActiveTab(state, effects, now, viewModel)}
    </section>
  `;
}

function renderActiveTab(state, effects, now, viewModel) {
  const activeTab = state?.settings?.activeTab || "dashboard";
  if (activeTab === "store") {
    return renderStoreTab(state, now);
  }
  // Backward compatibility for saves that previously used a top-level power items tab.
  if (activeTab === "poweritems") {
    return renderStoreTab(state, now, "power");
  }
  if (activeTab === "orders") {
    return renderOrdersTab(state, now);
  }
  if (activeTab === "inventory") {
    return renderInventoryTab(state, now);
  }
  if (activeTab === "jobs") {
    return renderAllJobsTab(state, effects);
  }
  if (activeTab === "businesses") {
    return renderBusinessesTab(state, now);
  }
  if (activeTab === "crates") {
    return renderCratesTab(state, viewModel);
  }
  if (activeTab === "education") {
    return renderEducationTab(state, viewModel, now);
  }
  if (activeTab === "quests") {
    return renderQuestsTab(state);
  }
  if (activeTab === "rebirth") {
    return renderRebirthTab(state);
  }
  if (activeTab === "realestate") {
    return renderRealEstateTab(state);
  }
  return renderDashboardTab(state, effects, now);
}

function renderDashboardTab(state, effects, now) {
  const xpNeeded = xpRequiredForLevel(state.level);
  const xpPercent = Math.min(100, (state.xp / xpNeeded) * 100);
  const nextDaily = Number(state.daily.nextClaimAt || 0);
  const readyJobsCount = state.activeJobs.filter((job) => job.endsAt <= now).length;
  const activeAbilities = getActiveAbilities(state, now);
  const maxAbilitySlots = getMaxActiveAbilitySlots(state);
  const instantTokens = getInstantJobTokenCount(state);

  return `
    <section class="grid two">
      <article class="card">
        <h2>Dashboard</h2>
        <div class="balance">$${formatNumber(state.money)}</div>
        <div class="stats-line">
          <span>Level ${state.level}</span>
          <span>XP ${state.xp} / ${xpNeeded}</span>
          <span>Jobs ${state.stats.jobsCompleted}</span>
        </div>
        <div class="xp-wrap"><div class="xp-bar" style="width: ${xpPercent}%"></div></div>
        <div class="list compact-list">
          <div class="job-row">
            <div class="row-head">
              <strong>Streak</strong>
              <span class="rarity-pill epic">${state.streak.count} live</span>
            </div>
            <div class="row-meta">Best: ${state.streak.best} | Window: ${state.streak.windowEndsAt ? formatCountdown(state.streak.windowEndsAt - now) : "expired"}</div>
          </div>
          <div class="job-row">
            <div class="row-head">
              <strong>Perks</strong>
              <span class="rarity-pill rare">${effects.maxActiveJobs} slots</span>
            </div>
            <div class="row-meta">Payout x${effects.payoutMultiplier.toFixed(2)} | XP x${effects.xpMultiplier.toFixed(2)}</div>
          </div>
          <div class="job-row">
            <div class="row-head">
              <strong>Active Store Ability</strong>
              <span class="rarity-pill legendary">${activeAbilities.length}/${maxAbilitySlots} active</span>
            </div>
            ${activeAbilities.length
              ? activeAbilities
                .map((ability) => {
                  const abilityRemaining = Math.max(0, Number(ability.expiresAt || 0) - now);
                  return `<div class="row-meta">${escapeHtml(ability.itemName)}: ${escapeHtml(ability.effect)} (${formatCountdown(abilityRemaining)} left)</div>`;
                })
                .join("")
              : '<div class="row-meta">No active store ability.</div>'}
          </div>
        </div>
        <p class="hint">${nextDaily > now ? `Daily reward ready in ${formatCountdown(nextDaily - now)}.` : "Daily reward is ready now."}</p>
      </article>

      <article class="card">
        <div class="row-head">
          <h2>Active Jobs</h2>
          <button id="claimJobsBtn" class="btn secondary" ${readyJobsCount < 1 ? "disabled" : ""}>Claim Ready</button>
        </div>
        <p class="hint">${state.activeJobs.length} active / ${effects.maxActiveJobs} slots${state.activeJobs.length > 5 ? " • scroll for more" : ""}</p>
        <div class="list active-jobs-list">
          ${state.activeJobs.length
            ? state.activeJobs
                .map((job) => {
                  const remaining = Math.max(0, job.endsAt - now);
                  const ready = remaining === 0;
                  return `
                    <div class="job-row">
                      <div class="row-head">
                        <strong>${escapeHtml(job.name)}</strong>
                        <span class="badge ${ready ? "delivered" : "processing"}">${ready ? "ready" : "working"}</span>
                      </div>
                      <div class="row-meta">Reward: $${formatNumber(job.payout)} | XP: ${job.xp} | ${ready ? "Ready to claim" : `Remaining: ${formatCountdown(remaining)}`}</div>
                      ${instantTokens > 0
                        ? `<button class="btn tertiary" data-action="use-instant-token" data-id="${job.id}" ${ready ? "disabled" : ""}>Use Token (${formatNumber(instantTokens)})</button>`
                        : ""}
                    </div>
                  `;
                })
                .join("")
            : '<p class="hint empty-state">No jobs running.</p>'}
        </div>
      </article>
    </section>

    <section class="card">
      <h2>Recent Activity</h2>
      <ul class="tx-list">
        ${(Array.isArray(state.log) ? state.log : []).map((entry) => `<li>${escapeHtml(formatLogLine(entry))}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderRebirthTab(state) {
  const unlocked = isRebirthUnlocked(state);
  const projectedAward = getProjectedRebirthAward(state);
  const rebirths = Math.max(0, Number(state.rebirths || 0));
  const rebirthPoints = Math.max(0, Number(state.rebirthPoints || 0));
  const totalPoints = Math.max(0, Number(state.rebirthTotalPointsEarned || 0));
  const spentPoints = Math.max(0, Number(state.rebirthPointsSpent || 0));
  const modifiers = getRebirthRuntimeModifiers(state);
  const shopDefs = getRebirthShopDefs();

  return `
    <section class="grid two">
      <article class="card">
        <h2>Rebirth</h2>
        <div class="list compact-list">
          <div class="job-row">
            <div class="row-head">
              <strong>Status</strong>
              <span class="badge ${unlocked ? "delivered" : "processing"}">${unlocked ? "Unlocked" : "Locked"}</span>
            </div>
            <div class="row-meta">Requirement: Level ${REBIRTH_UNLOCK_LEVEL}+ and $${formatNumber(REBIRTH_UNLOCK_MONEY)}+</div>
            <div class="row-meta">Current: Level ${formatNumber(state.level)} | $${formatNumber(state.money)}</div>
          </div>
          <div class="job-row">
            <div class="row-head">
              <strong>Projected Award</strong>
              <span class="rarity-pill legendary">+${formatNumber(projectedAward)} pts</span>
            </div>
            <div class="row-meta">Formula: floor(level/50) + floor(log10(money))</div>
          </div>
          <div class="job-row">
            <div class="row-head">
              <strong>Rebirth Stats</strong>
              <span class="rarity-pill epic">${formatNumber(rebirths)} rebirths</span>
            </div>
            <div class="row-meta">Points: ${formatNumber(rebirthPoints)} unspent | ${formatNumber(spentPoints)} spent</div>
            <div class="row-meta">Total earned points: ${formatNumber(totalPoints)}</div>
          </div>
          <div class="job-row">
            <div class="row-head">
              <strong>Permanent Multipliers</strong>
              <span class="rarity-pill rare">Always on</span>
            </div>
            <div class="row-meta">Job income: x${modifiers.jobIncomeMult.toFixed(2)}</div>
            <div class="row-meta">Business income: x${modifiers.businessIncomeMult.toFixed(2)}</div>
            <div class="row-meta">Job duration: x${modifiers.jobTimeMult.toFixed(2)} (lower is faster)</div>
          </div>
        </div>
        <div class="top-actions">
          <button class="btn danger" data-action="confirm-rebirth" ${unlocked ? "" : "disabled"}>REBIRTH</button>
        </div>
      </article>

      <article class="card">
        <h2>Rebirth Shop</h2>
        <p class="hint">Spend rebirth points on permanent upgrades.</p>
        <div class="list">
          ${shopDefs.map((def) => {
            const cost = getRebirthUpgradeCost(def.id);
            const owned = Number(state?.rebirthShop?.[def.id] || 0);
            return `
              <div class="item-row">
                <div class="row-head">
                  <strong>${escapeHtml(def.name)}</strong>
                  <span class="rarity-pill rare">${formatNumber(cost)} pts</span>
                </div>
                <div class="row-meta">${escapeHtml(def.description)}</div>
                <div class="row-meta">Owned: ${formatNumber(owned)}</div>
                <button
                  class="btn secondary"
                  data-action="buy-rebirth-upgrade"
                  data-id="${def.id}"
                  ${rebirthPoints >= cost ? "" : "disabled"}
                >
                  Buy
                </button>
              </div>
            `;
          }).join("")}
        </div>
      </article>
    </section>
  `;
}

function renderCratesTab(state, viewModel) {
  const inventory = state?.cratesInventory && typeof state.cratesInventory === "object"
    ? state.cratesInventory
    : { common: 0, rare: 0, epic: 0, legendary: 0 };
  const history = Array.isArray(state?.crateHistory) ? state.crateHistory : [];
  const activeBoosts = Array.isArray(state?.activeBoosts) ? state.activeBoosts : [];
  const isOpening = Boolean(viewModel?.isOpeningCrate);
  const stage = String(viewModel?.crateOpeningStage || "");
  const openingRarity = String(viewModel?.crateOpeningRarity || "");
  const result = viewModel?.lastCrateResult;
  const now = nowMs();

  return `
    <section class="grid two">
      <article class="card">
        <h2>Mystery Crates</h2>
        <div class="list">
          ${["common", "rare", "epic", "legendary"].map((rarity) => `
            <div class="item-row">
              <div class="row-head">
                <strong>${rarity[0].toUpperCase()}${rarity.slice(1)} Crate</strong>
                <span class="rarity-pill ${rarityForCrate(rarity)}">x${formatNumber(inventory[rarity] || 0)}</span>
              </div>
              <button
                class="btn secondary"
                data-action="open-crate"
                data-rarity="${rarity}"
                ${(isOpening || Number(inventory[rarity] || 0) < 1) ? "disabled" : ""}
              >
                Open
              </button>
            </div>
          `).join("")}
        </div>

        <div class="list compact-list">
          <div class="job-row">
            <div class="row-head">
              <strong>Opening Status</strong>
              <span class="badge ${isOpening ? "processing" : "delivered"}">${isOpening ? "Busy" : "Idle"}</span>
            </div>
            <div class="row-meta">${isOpening ? `${escapeHtml(stage)} ${escapeHtml(openingRarity ? `${openingRarity} crate` : "")}` : "Ready to open crates."}</div>
          </div>
          ${result
            ? `
              <div class="job-row">
                <div class="row-head">
                  <strong>Last Reward</strong>
                  <span class="rarity-pill legendary">${escapeHtml(result.rarity || "").toUpperCase()}</span>
                </div>
                <div class="row-meta">${escapeHtml(result.description || "")}</div>
              </div>
            `
            : ""}
        </div>
      </article>

      <article class="card">
        <h2>Crate History</h2>
        <div class="list active-jobs-list">
          ${history.length
            ? history.map((entry) => `
              <div class="job-row">
                <div class="row-head">
                  <strong>${escapeHtml((entry.rarity || "").toUpperCase())}</strong>
                  <span class="badge delivered">${escapeHtml(entry.rewardType || "")}</span>
                </div>
                <div class="row-meta">${escapeHtml(entry.description || "")}</div>
                <div class="row-meta">${new Date(Number(entry.timestamp || now)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
              </div>
            `).join("")
            : '<p class="hint empty-state">No crates opened yet.</p>'}
        </div>
        <h2>Active Crate Boosts</h2>
        <div class="list">
          ${activeBoosts.length
            ? activeBoosts.map((boost) => {
              const remaining = Math.max(0, Number(boost.endsAt || 0) - now);
              return `
                <div class="job-row">
                  <div class="row-head">
                    <strong>${escapeHtml(boost.type || "BOOST")}</strong>
                    <span class="rarity-pill epic">x${Number(boost.multiplier || 1).toFixed(2)}</span>
                  </div>
                  <div class="row-meta">Remaining: ${formatCountdown(remaining)}</div>
                </div>
              `;
            }).join("")
            : '<p class="hint empty-state">No active crate boosts.</p>'}
        </div>
      </article>
    </section>
  `;
}

function renderEducationTab(state, viewModel, now) {
  const education = state?.education && typeof state.education === "object"
    ? state.education
    : {
        hs: { status: "not_started", startedAt: null, endsAt: null },
        college: { status: "not_started", startedAt: null, endsAt: null },
        activeProgram: null
      };
  const perks = state?.educationPerks && typeof state.educationPerks === "object"
    ? state.educationPerks
    : { jobMultiplier: 1, businessMultiplier: 1 };
  const isEnrolling = Boolean(viewModel?.isEnrollingEducation);

  return `
    <section class="grid two">
      ${renderEducationProgramCard(state, education, "hs", now, isEnrolling)}
      ${renderEducationProgramCard(state, education, "college", now, isEnrolling)}
      <article class="card">
        <h2>Education Perks</h2>
        <div class="list compact-list">
          <div class="job-row">
            <div class="row-head">
              <strong>Job Payout Multiplier</strong>
              <span class="rarity-pill rare">x${Number(perks.jobMultiplier || 1).toFixed(2)}</span>
            </div>
            <div class="row-meta">High School completion grants at least x1.10.</div>
          </div>
          <div class="job-row">
            <div class="row-head">
              <strong>Business Payout Multiplier</strong>
              <span class="rarity-pill epic">x${Number(perks.businessMultiplier || 1).toFixed(2)}</span>
            </div>
            <div class="row-meta">College completion grants at least x1.15.</div>
          </div>
        </div>
      </article>
    </section>
  `;
}

function renderEducationProgramCard(state, education, programId, now, isEnrolling) {
  const program = getEducationProgram(programId);
  const slot = education?.[programId] && typeof education[programId] === "object"
    ? education[programId]
    : { status: "not_started", startedAt: null, endsAt: null };
  const activeProgram = education?.activeProgram || null;
  const isCompleted = slot.status === "completed";
  const isCurrent = activeProgram === programId;
  const inProgress = slot.status === "in_progress" && isCurrent;
  const blockedByOther = activeProgram && activeProgram !== programId;
  const remainingMs = inProgress ? Math.max(0, Number(slot.endsAt || 0) - now) : 0;
  const totalMs = Number(program?.durationMs || 1);
  const elapsedMs = inProgress ? Math.max(0, totalMs - remainingMs) : 0;
  const progress = inProgress ? Math.min(100, (elapsedMs / Math.max(1, totalMs)) * 100) : (isCompleted ? 100 : 0);
  const meetsLevel = Number(state.level || 0) >= Number(program?.levelReq || 0);
  const hasMoney = Number(state.money || 0) >= Number(program?.cost || 0);
  const disabled = isEnrolling || isCompleted || inProgress || blockedByOther || !meetsLevel || !hasMoney;
  const label = isCompleted ? "Completed" : (inProgress ? "In Class..." : "Enroll");
  const statusLabel = isCompleted ? "Completed" : (inProgress ? "In progress" : "Not started");

  return `
    <article class="card">
      <h2>${escapeHtml(program?.name || "Program")}</h2>
      <div class="list compact-list">
        <div class="job-row">
          <div class="row-head">
            <strong>Status</strong>
            <span class="badge ${isCompleted ? "delivered" : "processing"}">${statusLabel}</span>
          </div>
          <div class="row-meta">Requirement: Level ${formatNumber(program?.levelReq || 0)} | Cost: $${formatNumber(program?.cost || 0)}</div>
          <div class="row-meta">Duration: ${formatCountdown(program?.durationMs || 0)}</div>
          ${inProgress ? `<div class="row-meta">Time remaining: ${formatCountdown(remainingMs)}</div>` : ""}
          <div class="progress-wrap"><div class="progress-bar" style="width: ${progress}%"></div></div>
          ${blockedByOther ? '<div class="row-meta">Another program is currently active.</div>' : ""}
          ${!meetsLevel ? `<div class="row-meta">Need level ${formatNumber(program?.levelReq || 0)}.</div>` : ""}
          ${meetsLevel && !hasMoney && !isCompleted ? `<div class="row-meta">Need $${formatNumber(program?.cost || 0)} to enroll.</div>` : ""}
        </div>
      </div>
      <button
        class="btn secondary"
        data-action="enroll-education"
        data-id="${programId}"
        ${disabled ? "disabled" : ""}
      >
        ${label}
      </button>
    </article>
  `;
}

function renderQuestsTab(state) {
  const questsState = state?.quests && typeof state.quests === "object"
    ? state.quests
    : { daily_ids: [], progress: {}, completed: {}, claimed: {}, last_roll_date: "" };
  const dailyIds = Array.isArray(questsState.daily_ids) ? questsState.daily_ids : [];

  return `
    <section class="card">
      <h2>Daily Quests</h2>
      <p class="hint">Date: ${escapeHtml(questsState.last_roll_date || "today")} | Complete and claim each quest once.</p>
      <div class="list">
        ${dailyIds.length
          ? dailyIds.map((questId) => {
            const quest = QUESTS_BY_ID[questId];
            if (!quest) {
              return "";
            }
            const current = Math.max(0, Number(questsState.progress?.[questId] || 0));
            const target = Math.max(1, Number(quest.requirement?.target || 1));
            const claimed = Boolean(questsState.claimed?.[questId]);
            const completed = Boolean(questsState.completed?.[questId]);
            const shown = Math.min(current, target);
            const progressPercent = Math.max(0, Math.min(100, (shown / target) * 100));
            const status = claimed ? "Claimed" : (completed ? "Completed" : "In progress");
            const statusClass = claimed ? "delivered" : (completed ? "out_for_delivery" : "processing");
            const rewardCash = Math.max(0, Number(quest.reward?.cash || 0));
            const rewardXp = Math.max(0, Number(quest.reward?.xp || 0));

            return `
              <div class="item-row">
                <div class="row-head">
                  <strong>${escapeHtml(quest.title)}</strong>
                  <span class="badge ${statusClass}">${status}</span>
                </div>
                <div class="row-meta">${escapeHtml(quest.desc)}</div>
                <div class="row-meta">Progress: ${formatNumber(shown)} / ${formatNumber(target)}</div>
                <div class="progress-wrap"><div class="progress-bar" style="width: ${progressPercent}%"></div></div>
                <div class="row-meta">Reward: $${formatNumber(rewardCash)}${rewardXp > 0 ? ` + ${formatNumber(rewardXp)} XP` : ""}</div>
                <button
                  class="btn secondary"
                  data-action="claim-quest"
                  data-id="${quest.id}"
                  ${(completed && !claimed) ? "" : "disabled"}
                >
                  Claim
                </button>
              </div>
            `;
          }).join("")
          : '<p class="hint empty-state">No quests rolled yet.</p>'}
      </div>
    </section>
  `;
}

function renderStoreTab(state, now, forcedStoreTab = null) {
  const currentStoreTab = forcedStoreTab || getStoreSubTab(state);
  return `
    <section class="section-stack">
      <article class="card">
        <div class="row-head">
          <h2>Store</h2>
        </div>
        <div class="top-actions tab-strip">
          <button class="tab-btn ${currentStoreTab === "items" ? "active" : ""}" data-action="store-tab" data-tab="items">Items</button>
          <button class="tab-btn ${currentStoreTab === "power" ? "active" : ""}" data-action="store-tab" data-tab="power">Power Items</button>
        </div>
      </article>
      ${currentStoreTab === "power" ? renderPowerItemsTab(state, now) : renderStoreItemsTabContent(state)}
    </section>
  `;
}

function renderStoreItemsTabContent(state) {
  return `
    <section class="grid two">
      <article class="card">
        <h2>Store</h2>
        <p class="hint">Buy items to place delivery orders. Abilities do not activate on purchase.</p>
        <div class="list">
          ${STORE_ITEMS.map((item) => {
            const livePrice = getStoreItemPrice(state, item.id);
            const isPermanent = String(item.abilityDuration || "").toLowerCase() === "permanent";
            return `
              <div class="item-row">
                <div class="row-head">
                  <strong>${escapeHtml(item.name)}</strong>
                  <span class="rarity-pill rare">$${formatNumber(livePrice)}</span>
                </div>
                <div class="row-meta">${escapeHtml(item.description)}</div>
                <div class="row-meta">Effect: ${escapeHtml(item.ability)}</div>
                <div class="row-meta">${isPermanent ? "Duration: Permanent (applies instantly)." : `Duration: ${escapeHtml(item.abilityDuration || "21 hours")} (activate from Inventory after delivery).`}</div>
                <button class="btn secondary" data-action="buy-store-item" data-id="${item.id}" ${state.money < livePrice ? "disabled" : ""}>Buy Item</button>
              </div>
            `;
          }).join("")}
        </div>
      </article>

      <article class="card">
        <h2>Store Notes</h2>
        <div class="list">
          <div class="job-row">
            <div class="row-head">
              <strong>Delivery Timing</strong>
              <span class="badge shipped">30s - 3m</span>
            </div>
            <div class="row-meta">Ability items ship to Inventory. Permanent permits apply instantly.</div>
          </div>
          <div class="job-row">
            <div class="row-head">
              <strong>Activation Rule</strong>
              <span class="badge processing">slot-based</span>
            </div>
            <div class="row-meta">You can run multiple abilities based on your Item Slot Permit count.</div>
          </div>
        </div>
      </article>
    </section>
  `;
}

function renderPowerItemsTab(state, now) {
  const unlocked = Number(state?.level || 0) >= POWER_ITEMS_UNLOCK_LEVEL;
  const active = getActivePowerItem(state, now);
  const remainingMs = Math.max(0, Number(active?.remainingMs || 0));
  const activeDuration = Math.max(1, Number(active?.item?.durationMs || 0));
  const activeProgress = active ? Math.max(0, Math.min(100, ((activeDuration - remainingMs) / activeDuration) * 100)) : 0;
  const owned = state?.powerItems?.owned && typeof state.powerItems.owned === "object" ? state.powerItems.owned : {};

  return `
    <section class="grid two">
      <article class="card">
        <h2>Power Store</h2>
        <div class="list">
          ${POWER_ITEMS.map((item) => {
            const price = getPowerItemPrice(state, item.id, now);
            const qty = Math.max(0, Number(owned[item.id] || 0));
            const canBuy = unlocked && Number(state.money || 0) >= price;
            const canActivate = unlocked && qty > 0;
            return `
              <div class="item-row ${unlocked ? "" : "business-tile locked"}">
                <div class="row-head">
                  <strong>${escapeHtml(item.name)}</strong>
                  <span class="rarity-pill legendary">$${formatNumber(price)}</span>
                </div>
                <div class="row-meta">${escapeHtml(item.description)}</div>
                <div class="row-meta">Duration: 15 hours</div>
                <div class="row-meta">Owned: ${formatNumber(qty)}</div>
                ${!unlocked ? `<div class="row-meta">Unlocks at level ${POWER_ITEMS_UNLOCK_LEVEL}</div>` : ""}
                <div class="top-actions">
                  <button class="btn secondary" data-action="buy-power-item" data-id="${item.id}" ${canBuy ? "" : "disabled"}>Buy</button>
                  <button class="btn" data-action="activate-power-item" data-id="${item.id}" ${canActivate ? "" : "disabled"}>Activate</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </article>

      <article class="card">
        <h2>Power Items</h2>
        <p class="hint">${unlocked ? "Unlocked. Only one Power Item can be active at a time." : `Reach level ${POWER_ITEMS_UNLOCK_LEVEL} to unlock Power Items.`}</p>
        <div class="list compact-list">
          <div class="job-row">
            <div class="row-head">
              <strong>Status</strong>
              <span class="badge ${unlocked ? "delivered" : "processing"}">${unlocked ? "Unlocked" : "Locked"}</span>
            </div>
            <div class="row-meta">Level: ${formatNumber(state.level)} / ${POWER_ITEMS_UNLOCK_LEVEL}</div>
          </div>
          <div class="job-row">
            <div class="row-head">
              <strong>Active Power Item</strong>
              <span class="rarity-pill ${active ? "legendary" : "common"}">${active ? escapeHtml(active.item.name) : "None"}</span>
            </div>
            <div class="row-meta">${active ? escapeHtml(active.item.description) : "No active power boost."}</div>
            ${active
              ? `
                <div class="progress-wrap"><div class="progress-bar" style="width: ${activeProgress}%"></div></div>
                <div class="row-meta">Time remaining: ${formatCountdown(remainingMs)}</div>
              `
              : ""}
          </div>
        </div>
      </article>
    </section>
  `;
}

function renderAllJobsTab(state, effects) {
  const jobsSubTab = getJobsSubTab(state);
  const visibleJobs = JOBS.filter((job) => {
    if (jobsSubTab === "hs") {
      return job.educationRequired === "hs";
    }
    if (jobsSubTab === "college") {
      return job.educationRequired === "college";
    }
    return !job.educationRequired;
  });

  return `
    <section class="card">
      <h2>All Jobs</h2>
      <div class="top-actions tab-strip">
        <button class="tab-btn ${jobsSubTab === "core" ? "active" : ""}" data-action="jobs-subtab" data-tab="core">Core</button>
        <button class="tab-btn ${jobsSubTab === "hs" ? "active" : ""}" data-action="jobs-subtab" data-tab="hs">High School</button>
        <button class="tab-btn ${jobsSubTab === "college" ? "active" : ""}" data-action="jobs-subtab" data-tab="college">College</button>
      </div>
      <p class="hint">Full catalog of every unlocked and locked job tier.</p>
      <div class="list">
        ${visibleJobs.length
          ? visibleJobs.map((job) => {
          const levelLocked = state.level < job.levelRequired;
          const educationLocked = Boolean(job.educationRequired) && !isEducationCompleted(state, job.educationRequired);
          const locked = levelLocked || educationLocked;
          const slotsFull = state.activeJobs.length >= effects.maxActiveJobs;
          const buttonDisabled = locked || slotsFull;
          const buttonLabel = educationLocked
            ? `Requires ${getEducationShortLabel(job.educationRequired)}`
            : (levelLocked
              ? `Unlock at ${job.levelRequired}`
              : (slotsFull ? "Slots Full" : "Fill Slots"));
          const educationLabel = job.educationRequired
            ? `Education: ${escapeHtml(getEducationRequirementName(job.educationRequired))}`
            : "";
          return `
            <div class="item-row">
              <div class="row-head">
                <strong>${escapeHtml(job.name)}</strong>
                <span class="rarity-pill ${rarityForLevel(job.levelRequired)}">Lvl ${job.levelRequired}</span>
              </div>
              <div class="row-meta">Payout: $${formatNumber(job.payout)} | XP: ${job.xp}</div>
              <div class="row-meta">Duration: ${formatCountdown(job.durationMs)}</div>
              ${educationLabel ? `<div class="row-meta">${educationLabel}</div>` : ""}
              <button class="btn" data-action="start-job" data-id="${job.id}" ${buttonDisabled ? "disabled" : ""}>${buttonLabel}</button>
            </div>
          `;
        }).join("")
          : '<p class="hint empty-state">No jobs in this category.</p>'}
      </div>
    </section>
  `;
}

function renderBusinessesTab(state, now) {
  const businessesSubTab = getBusinessesSubTab(state);
  const buyMode = state?.businesses?.buyMultiplier === 10 || state?.businesses?.buyMultiplier === "max"
    ? state.businesses.buyMultiplier
    : 1;
  const totalPayoutPerCycle = getTotalPassivePayoutPerCycle(state);
  const payoutIntervalSeconds = getPassiveIntervalSeconds(state);
  const cycle = getPassiveCycleProgress(state, now);
  const visibleBusinesses = BUSINESS_DEFS.filter((definition) => {
    if (businessesSubTab === "hs") {
      return definition.educationRequired === "hs";
    }
    if (businessesSubTab === "college") {
      return definition.educationRequired === "college";
    }
    return !definition.educationRequired;
  });

  return `
    <section class="section-stack">
      <article class="card business-controls-card">
        <h2>Businesses</h2>
        <div class="business-controls-grid">
          <div class="business-controls-block">
            <p class="hint business-controls-label">Category</p>
            <div class="business-filter-tabs">
              <button class="tab-btn ${businessesSubTab === "core" ? "active" : ""}" data-action="business-subtab" data-tab="core">Core</button>
              <button class="tab-btn ${businessesSubTab === "hs" ? "active" : ""}" data-action="business-subtab" data-tab="hs">High School</button>
              <button class="tab-btn ${businessesSubTab === "college" ? "active" : ""}" data-action="business-subtab" data-tab="college">College</button>
            </div>
          </div>
          <div class="business-controls-block">
            <p class="hint business-controls-label">Buy mode</p>
            <div class="business-buy-tabs">
              <button class="btn secondary ${buyMode === 1 ? "active-mode" : ""}" data-action="business-buy-mode" data-mode="1">Buy x1</button>
              <button class="btn secondary ${buyMode === 10 ? "active-mode" : ""}" data-action="business-buy-mode" data-mode="10">Buy x10</button>
              <button class="btn secondary ${buyMode === "max" ? "active-mode" : ""}" data-action="business-buy-mode" data-mode="max">Buy Max</button>
            </div>
          </div>
        </div>
        <div class="business-stats-grid">
          <div class="business-stat-chip">
            <span>Total passive income</span>
            <strong>$${formatNumber(totalPayoutPerCycle)} per payout</strong>
          </div>
          <div class="business-stat-chip">
            <span>Payout interval</span>
            <strong>${formatCountdown(payoutIntervalSeconds * 1000)}</strong>
          </div>
        </div>
      </article>

      <article class="card">
        <div class="list business-list">
          ${visibleBusinesses.length
            ? visibleBusinesses.map((definition) => {
            const levelLocked = state.level < definition.unlockLevel;
            const educationLocked = Boolean(definition.educationRequired)
              && !isEducationCompleted(state, definition.educationRequired);
            const locked = levelLocked || educationLocked;
            const businessState = getBusinessState(state, definition.id);
            const hasUnits = businessState.qty > 0;
            const incomePerSec = getBusinessIncomePerSec(definition, businessState);
            const payoutPerCycle = Math.max(0, Math.round(incomePerSec * payoutIntervalSeconds));
            const preview = getBusinessPurchasePreview(state, definition.id);
            const plannedCost = preview.qty > 0 ? preview.cost : preview.nextUnitCost;
            const plannedQty = preview.qty > 0 ? preview.qty : (buyMode === 10 ? 10 : 1);
            const upgradeCost = getUpgradeCost(definition, businessState.level, state);
            const canUpgrade = !locked && businessState.qty > 0 && Number(state.money || 0) >= upgradeCost;
            const buyButtonLabel = buyMode === "max"
              ? `Buy Max (${preview.qty})`
              : `Buy x${plannedQty}`;
            const lockNotes = [];
            if (levelLocked) {
              lockNotes.push(`Unlocks at Level ${definition.unlockLevel}`);
            }
            if (educationLocked) {
              lockNotes.push(`Requires ${getEducationRequirementName(definition.educationRequired)}`);
            }

            return `
              <div class="item-row business-card ${locked ? "business-tile locked" : "business-tile"}">
                <div class="row-head">
                  <strong>${escapeHtml(definition.name)}</strong>
                  <span class="rarity-pill ${locked ? "common" : "uncommon"}">${locked ? `Lvl ${definition.unlockLevel}` : "Unlocked"}</span>
                </div>
                <div class="row-meta">${escapeHtml(definition.description || "")}</div>
                ${locked
                  ? `
                    <div class="row-meta">${escapeHtml(lockNotes.join(" • ") || "Locked")}</div>
                    <div class="progress-wrap"><div class="progress-bar" style="width: 0%"></div></div>
                  `
                  : `
                    <div class="row-meta">Qty ${formatNumber(businessState.qty)} • Lvl ${formatNumber(businessState.level)} • Payout $${formatNumber(payoutPerCycle)}/cycle</div>
                    <div class="progress-wrap"><div class="progress-bar" style="width: ${(hasUnits ? cycle.progress : 0) * 100}%"></div></div>
                    <div class="row-meta">${hasUnits ? `Next payout ${formatCountdown(cycle.remainingMs)}` : "No units owned yet."}</div>
                    <div class="row-meta">Next cost $${formatNumber(plannedCost)}</div>
                    <div class="top-actions">
                      <button class="btn" data-action="buy-business" data-id="${definition.id}" ${preview.qty < 1 ? "disabled" : ""}>${buyButtonLabel}</button>
                      <button class="btn secondary" data-action="upgrade-business" data-id="${definition.id}" ${canUpgrade ? "" : "disabled"}>Upgrade ($${formatNumber(upgradeCost)})</button>
                    </div>
                  `}
              </div>
            `;
          }).join("")
            : '<p class="hint empty-state">No businesses in this category.</p>'}
        </div>
      </article>
    </section>
  `;
}

function renderRealEstateTab(state) {
  const activeResidenceId = state?.realEstate?.activeResidenceId || null;
  const activeDef = activeResidenceId ? getResidenceDef(activeResidenceId) : null;
  const activeState = activeDef ? getResidenceState(state, activeDef.id) : { owned: false, upgradeLevel: 0 };
  const activePerkValue = activeDef ? getResidencePerkValue(activeDef, activeState.upgradeLevel) : 0;
  const activePerkLabel = activeDef ? formatResidencePerk(activeDef, activePerkValue) : "No active residence.";
  const nextUpgradeCost = activeDef ? getResidenceUpgradeCost(activeDef, activeState.upgradeLevel) : 0;
  const canUpgradeActive = Boolean(
    activeDef
    && activeState.upgradeLevel < activeDef.maxUpgrade
    && Number(state.money || 0) >= nextUpgradeCost
  );

  return `
    <section class="section-stack">
      <article class="card">
        <h2>Real Estate</h2>
        <div class="list compact-list">
          <div class="job-row">
            <div class="row-head">
              <strong>Current Residence</strong>
              <span class="rarity-pill ${activeDef ? "legendary" : "common"}">${activeDef ? activeDef.name : "None"}</span>
            </div>
            <div class="row-meta">${activePerkLabel}</div>
            ${activeDef
              ? `
                <div class="row-meta">Upgrade Level: ${activeState.upgradeLevel} / ${activeDef.maxUpgrade}</div>
                <div class="row-meta">${activeState.upgradeLevel >= activeDef.maxUpgrade ? "Max upgrade reached." : `Next upgrade: $${formatNumber(nextUpgradeCost)}`}</div>
                <div class="top-actions">
                  <button class="btn secondary" data-action="upgrade-residence" ${canUpgradeActive ? "" : "disabled"}>Upgrade</button>
                  <button class="btn tertiary" data-action="moveout-residence">Move Out</button>
                </div>
              `
              : `
                <div class="row-meta">Move into an owned residence to activate a perk.</div>
                <div class="top-actions">
                  <button class="btn tertiary" data-action="moveout-residence" disabled>Move Out</button>
                </div>
              `}
          </div>
        </div>
      </article>

      <article class="card">
        <div class="list">
          ${RESIDENCE_DEFS.map((definition) => {
            const residenceState = getResidenceState(state, definition.id);
            const locked = state.level < definition.unlockLevel;
            const isOwned = residenceState.owned;
            const isActive = activeResidenceId === definition.id;
            const perkValue = getResidencePerkValue(definition, residenceState.upgradeLevel);
            const perkLabel = formatResidencePerk(definition, perkValue);

            return `
              <div class="item-row ${locked ? "business-tile locked" : ""}">
                <div class="row-head">
                  <strong>${escapeHtml(definition.name)}</strong>
                  ${isActive
                    ? '<span class="badge delivered">active</span>'
                    : (isOwned
                        ? '<span class="rarity-pill uncommon">Owned</span>'
                        : `<span class="rarity-pill ${locked ? "common" : "rare"}">$${formatNumber(definition.basePrice)}</span>`)}
                </div>
                <div class="row-meta">${escapeHtml(definition.description || "")}</div>
                <div class="row-meta">Perk: ${escapeHtml(perkLabel)}</div>
                ${locked
                  ? `<div class="row-meta">Unlocks at Level ${definition.unlockLevel}</div>`
                  : `
                    <div class="row-meta">Upgrade Level: ${residenceState.upgradeLevel} / ${definition.maxUpgrade}</div>
                    <div class="top-actions">
                      ${!isOwned ? `<button class="btn" data-action="buy-residence" data-id="${definition.id}" ${Number(state.money || 0) >= definition.basePrice ? "" : "disabled"}>Buy</button>` : ""}
                      ${isOwned && !isActive ? `<button class="btn secondary" data-action="movein-residence" data-id="${definition.id}">Move In</button>` : ""}
                    </div>
                  `}
              </div>
            `;
          }).join("")}
        </div>
      </article>
    </section>
  `;
}

function renderOrdersTab(state, now) {
  const orders = Array.isArray(state.orders) ? state.orders : [];
  return `
    <section class="card">
      <h2>Track Orders</h2>
      <div class="list">
        ${orders.length
          ? orders.map((order) => renderOrderCard(order, now)).join("")
          : '<p class="hint empty-state">No active orders.</p>'}
      </div>
    </section>
  `;
}

function renderOrderCard(order, now) {
  const total = Math.max(1, Number(order.deliveryTime || 0) - Number(order.orderedAt || 0));
  const elapsed = Math.max(0, now - Number(order.orderedAt || 0));
  const progress = Math.min(100, (elapsed / total) * 100);
  const status = getOrderStatus(order, now);
  const remaining = Math.max(0, Number(order.deliveryTime || 0) - now);
  return `
    <div class="item-row">
      <div class="row-head">
        <strong>${escapeHtml(order.itemName)}</strong>
        <span class="badge ${statusToBadge(status)}">${escapeHtml(status)}</span>
      </div>
      <div class="row-meta">Ordered for $${formatNumber(order.price)}</div>
      <div class="progress-wrap"><div class="progress-bar" style="width: ${progress}%"></div></div>
      <div class="row-meta">Arrives in: ${formatCountdown(remaining)}</div>
    </div>
  `;
}

function renderInventoryTab(state, now) {
  const inventory = Array.isArray(state.inventory) ? state.inventory : [];
  const activeAbilities = getActiveAbilities(state, now);
  const maxAbilitySlots = getMaxActiveAbilitySlots(state);
  const slotsUsed = activeAbilities.length;

  return `
    <section class="grid two">
      <article class="card">
        <h2>Inventory</h2>
        <p class="hint">Ability slots: ${slotsUsed} / ${maxAbilitySlots}</p>
        <div class="list">
          ${inventory.length
            ? inventory.map((entry) => `
              <div class="item-row">
                <div class="row-head">
                  <strong>${escapeHtml(entry.itemName)}</strong>
                  <span class="rarity-pill uncommon">x${formatNumber(entry.qty || 0)}</span>
                </div>
                <div class="row-meta">Ability: ${escapeHtml(entry.ability)}</div>
                <div class="row-meta">Duration: ${escapeHtml(entry.abilityDuration || "21 hours")}</div>
                <button
                  class="btn secondary"
                  data-action="activate-item"
                  data-id="${entry.itemId}"
                  ${(slotsUsed >= maxAbilitySlots || Number(entry.qty || 0) < 1 || activeAbilities.some((ability) => ability.itemId === entry.itemId)) ? "disabled" : ""}
                >
                  Activate
                </button>
              </div>
            `).join("")
            : '<p class="hint empty-state">Inventory is empty.</p>'}
        </div>
      </article>

      <article class="card">
        <h2>Active Abilities</h2>
        ${activeAbilities.length
          ? `
            <div class="list compact-list">
              ${activeAbilities.map((ability) => {
                const remainingMs = Math.max(0, Number(ability.expiresAt || 0) - now);
                return `
                  <div class="job-row">
                    <div class="row-head">
                      <strong>${escapeHtml(ability.itemName)}</strong>
                      <span class="badge delivered">active</span>
                    </div>
                    <div class="row-meta">${escapeHtml(ability.effect)}</div>
                    <div class="row-meta">Time remaining: ${formatCountdown(remainingMs)}</div>
                  </div>
                `;
              }).join("")}
            </div>
          `
          : '<p class="hint empty-state">No ability is active.</p>'}
        <p class="hint">Ability duration is fixed at ${formatCountdown(ABILITY_DURATION_MS)}.</p>
      </article>
    </section>
  `;
}

function bindEvents(root, viewModel, handlers) {
  if (!viewModel.session) {
    const authForm = root.querySelector("#authForm");
    const signupBtn = root.querySelector("#signupBtn");
    const guestBtn = root.querySelector("#guestBtn");

    authForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      handlers.onLogin(readAuthValues(root));
    });
    signupBtn?.addEventListener("click", () => handlers.onSignUp(readAuthValues(root)));
    guestBtn?.addEventListener("click", () => handlers.onGuest());
    return;
  }

  root.querySelector("#dailyBtn")?.addEventListener("click", () => handlers.onClaimDaily());
  root.querySelector("#claimJobsBtn")?.addEventListener("click", () => handlers.onClaimJobs());
  root.querySelector("#saveNowBtn")?.addEventListener("click", () => handlers.onSaveNow());
  root.querySelector("#logoutBtn")?.addEventListener("click", () => handlers.onLogout());

  root.querySelectorAll("[data-action='tab']").forEach((button) => {
    button.addEventListener("click", () => handlers.onSetTab(button.dataset.tab));
  });
  root.querySelectorAll("[data-action='store-tab']").forEach((button) => {
    button.addEventListener("click", () => handlers.onSetStoreTab(button.dataset.tab));
  });
  root.querySelectorAll("[data-action='business-buy-mode']").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.mode === "max" ? "max" : Number(button.dataset.mode);
      handlers.onSetBusinessBuyMode(mode);
    });
  });
  root.querySelectorAll("[data-action='business-subtab']").forEach((button) => {
    button.addEventListener("click", () => handlers.onSetBusinessesSubTab(button.dataset.tab));
  });
  root.querySelectorAll("[data-action='jobs-subtab']").forEach((button) => {
    button.addEventListener("click", () => handlers.onSetJobsSubTab(button.dataset.tab));
  });
  root.querySelectorAll("[data-action='start-job']").forEach((button) => {
    button.addEventListener("click", () => handlers.onStartJob(button.dataset.id));
  });
  root.querySelectorAll("[data-action='use-instant-token']").forEach((button) => {
    button.addEventListener("click", () => handlers.onUseInstantToken(button.dataset.id));
  });
  root.querySelectorAll("[data-action='buy-business']").forEach((button) => {
    button.addEventListener("click", () => handlers.onBuyBusiness(button.dataset.id));
  });
  root.querySelectorAll("[data-action='upgrade-business']").forEach((button) => {
    button.addEventListener("click", () => handlers.onUpgradeBusiness(button.dataset.id));
  });
  root.querySelectorAll("[data-action='buy-residence']").forEach((button) => {
    button.addEventListener("click", () => handlers.onBuyResidence(button.dataset.id));
  });
  root.querySelectorAll("[data-action='movein-residence']").forEach((button) => {
    button.addEventListener("click", () => handlers.onMoveInResidence(button.dataset.id));
  });
  root.querySelectorAll("[data-action='moveout-residence']").forEach((button) => {
    button.addEventListener("click", () => handlers.onMoveOutResidence());
  });
  root.querySelectorAll("[data-action='upgrade-residence']").forEach((button) => {
    button.addEventListener("click", () => handlers.onUpgradeResidence());
  });
  root.querySelectorAll("[data-action='buy-store-item']").forEach((button) => {
    button.addEventListener("click", () => handlers.onBuyStoreItem(button.dataset.id));
  });
  root.querySelectorAll("[data-action='activate-item']").forEach((button) => {
    button.addEventListener("click", () => handlers.onActivateInventoryItem(button.dataset.id));
  });
  root.querySelectorAll("[data-action='buy-power-item']").forEach((button) => {
    button.addEventListener("click", () => handlers.onBuyPowerItem(button.dataset.id));
  });
  root.querySelectorAll("[data-action='activate-power-item']").forEach((button) => {
    button.addEventListener("click", () => handlers.onActivatePowerItem(button.dataset.id));
  });
  root.querySelectorAll("[data-action='open-crate']").forEach((button) => {
    button.addEventListener("click", () => handlers.onOpenCrate(button.dataset.rarity));
  });
  root.querySelectorAll("[data-action='enroll-education']").forEach((button) => {
    button.addEventListener("click", () => handlers.onEnrollEducation(button.dataset.id));
  });
  root.querySelectorAll("[data-action='buy-rebirth-upgrade']").forEach((button) => {
    button.addEventListener("click", () => handlers.onBuyRebirthUpgrade(button.dataset.id));
  });
  root.querySelectorAll("[data-action='confirm-rebirth']").forEach((button) => {
    button.addEventListener("click", () => handlers.onConfirmRebirth());
  });
  root.querySelectorAll("[data-action='claim-quest']").forEach((button) => {
    button.addEventListener("click", () => handlers.onClaimQuest(button.dataset.id));
  });
}

function readAuthValues(root) {
  return {
    username: root.querySelector("#usernameInput")?.value || "",
    password: root.querySelector("#passwordInput")?.value || ""
  };
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatNumber(value) {
  return Math.round(value).toLocaleString();
}

function formatLogLine(entry) {
  if (!entry || typeof entry !== "object") {
    return "";
  }
  const time = new Date(Number(entry.at || Date.now())).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
  return `${time}: ${entry.message || ""}`;
}

function rarityForLevel(level) {
  if (level >= 9) return "mythic";
  if (level >= 6) return "legendary";
  if (level >= 4) return "epic";
  if (level >= 3) return "rare";
  if (level >= 2) return "uncommon";
  return "common";
}

function rarityForCrate(rarity) {
  if (rarity === "legendary") return "legendary";
  if (rarity === "epic") return "epic";
  if (rarity === "rare") return "rare";
  return "common";
}

function getEducationRequirementName(programId) {
  return getEducationProgram(programId)?.name || "Education requirement";
}

function getEducationShortLabel(programId) {
  if (programId === "college") {
    return "College";
  }
  if (programId === "hs") {
    return "HS Diploma";
  }
  return "Education";
}

function getStoreSubTab(state) {
  const tab = String(state?.settings?.storeSubTab || "items").toLowerCase();
  return tab === "power" ? "power" : "items";
}

function getBusinessesSubTab(state) {
  const tab = String(state?.settings?.businessesSubTab || "core").toLowerCase();
  if (tab === "hs" || tab === "college") {
    return tab;
  }
  return "core";
}

function getJobsSubTab(state) {
  const tab = String(state?.settings?.jobsSubTab || "core").toLowerCase();
  if (tab === "hs" || tab === "college") {
    return tab;
  }
  return "core";
}

function statusToBadge(status) {
  if (status === "Out for delivery") return "out_for_delivery";
  if (status === "Delivered") return "delivered";
  if (status === "Shipping") return "shipped";
  return "processing";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
