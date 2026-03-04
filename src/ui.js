import {
  BUSINESS_DEFS,
  getBusinessIncomePerSec,
  getPassiveCycleProgress,
  getBusinessPurchasePreview,
  getPassiveIntervalSeconds,
  getBusinessState,
  getTotalPassivePerSec,
  getUpgradeCost
} from "./businesses.js";
import { xpRequiredForLevel } from "./gameState.js";
import { JOBS } from "./jobs.js";
import {
  RESIDENCE_DEFS,
  formatResidencePerk,
  getResidenceDef,
  getResidencePerkValue,
  getResidenceState,
  getResidenceUpgradeCost
} from "./realEstate.js";
import { ABILITY_DURATION_MS, STORE_ITEMS, getActiveAbility, getOrderStatus, getPlayerEffects } from "./store.js";

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
  const readyJobs = state.activeJobs.filter((job) => job.endsAt <= now);

  return `
    <section class="section-stack">
      <header class="topbar card">
        <div>
          <h1>Fake Bank Account Simulator</h1>
          <p class="sub">Current user: ${escapeHtml(session.username)}${session.isGuest ? " (guest)" : ""}</p>
          <p class="hint">Save status: ${escapeHtml(saveStatus || "Idle")}</p>
          <p class="hint">${escapeHtml(notice || "Every action saves locally, plus autosave every 30 seconds.")}</p>
        </div>
        <div class="top-actions">
          <button id="dailyBtn" class="btn">Claim Daily</button>
          <button id="claimJobsBtn" class="btn secondary" ${readyJobs.length < 1 ? "disabled" : ""}>Claim Ready</button>
          <button id="saveNowBtn" class="btn secondary">Save</button>
          <button id="logoutBtn" class="btn danger">Logout</button>
        </div>
      </header>

      <section class="card">
        <div class="top-actions tab-strip">
          <button class="tab-btn ${activeTab === "dashboard" ? "active" : ""}" data-action="tab" data-tab="dashboard">Dashboard</button>
          <button class="tab-btn ${activeTab === "jobs" ? "active" : ""}" data-action="tab" data-tab="jobs">All Jobs</button>
          <button class="tab-btn ${activeTab === "businesses" ? "active" : ""}" data-action="tab" data-tab="businesses">Businesses</button>
          <button class="tab-btn ${activeTab === "realestate" ? "active" : ""}" data-action="tab" data-tab="realestate">Real Estate</button>
          <button class="tab-btn ${activeTab === "store" ? "active" : ""}" data-action="tab" data-tab="store">Store</button>
          <button class="tab-btn ${activeTab === "orders" ? "active" : ""}" data-action="tab" data-tab="orders">Track Orders</button>
          <button class="tab-btn ${activeTab === "inventory" ? "active" : ""}" data-action="tab" data-tab="inventory">Inventory</button>
        </div>
      </section>

      ${renderActiveTab(state, effects, now)}
    </section>
  `;
}

function renderActiveTab(state, effects, now) {
  const activeTab = state?.settings?.activeTab || "dashboard";
  if (activeTab === "store") {
    return renderStoreTab(state);
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
  if (activeTab === "realestate") {
    return renderRealEstateTab(state);
  }
  return renderDashboardTab(state, effects, now);
}

function renderDashboardTab(state, effects, now) {
  const xpNeeded = xpRequiredForLevel(state.level);
  const xpPercent = Math.min(100, (state.xp / xpNeeded) * 100);
  const nextDaily = Number(state.daily.nextClaimAt || 0);
  const activeAbility = getActiveAbility(state, now);
  const abilityRemaining = activeAbility ? Math.max(0, Number(activeAbility.expiresAt || 0) - now) : 0;

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
              <span class="rarity-pill legendary">${activeAbility ? "active" : "none"}</span>
            </div>
            ${activeAbility
              ? `<div class="row-meta">${escapeHtml(activeAbility.itemName)}: ${escapeHtml(activeAbility.effect)}</div>
                 <div class="row-meta">Time remaining: ${formatCountdown(abilityRemaining)}</div>`
              : '<div class="row-meta">No active store ability.</div>'}
          </div>
        </div>
        <p class="hint">${nextDaily > now ? `Daily reward ready in ${formatCountdown(nextDaily - now)}.` : "Daily reward is ready now."}</p>
      </article>

      <article class="card">
        <h2>Active Jobs</h2>
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

function renderStoreTab(state) {
  return `
    <section class="grid two">
      <article class="card">
        <h2>Store</h2>
        <p class="hint">Buy items to place delivery orders. Abilities do not activate on purchase.</p>
        <div class="list">
          ${STORE_ITEMS.map((item) => `
            <div class="item-row">
              <div class="row-head">
                <strong>${escapeHtml(item.name)}</strong>
                <span class="rarity-pill rare">$${formatNumber(item.price)}</span>
              </div>
              <div class="row-meta">${escapeHtml(item.description)}</div>
              <div class="row-meta">Ability: ${escapeHtml(item.ability)} for ${escapeHtml(item.abilityDuration)}</div>
              <button class="btn secondary" data-action="buy-store-item" data-id="${item.id}" ${state.money < item.price ? "disabled" : ""}>Buy Item</button>
            </div>
          `).join("")}
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
            <div class="row-meta">Orders arrive automatically and move to inventory.</div>
          </div>
          <div class="job-row">
            <div class="row-head">
              <strong>Activation Rule</strong>
              <span class="badge processing">one at a time</span>
            </div>
            <div class="row-meta">Only one store ability can be active at once.</div>
          </div>
        </div>
      </article>
    </section>
  `;
}

function renderAllJobsTab(state, effects) {
  return `
    <section class="card">
      <h2>All Jobs</h2>
      <p class="hint">Full catalog of every unlocked and locked job tier.</p>
      <div class="list">
        ${JOBS.map((job) => {
          const locked = state.level < job.levelRequired;
          const slotsFull = state.activeJobs.length >= effects.maxActiveJobs;
          const buttonDisabled = locked || slotsFull;
          const buttonLabel = locked
            ? `Unlock at ${job.levelRequired}`
            : (slotsFull ? "Slots Full" : "Fill Slots");
          return `
            <div class="item-row">
              <div class="row-head">
                <strong>${escapeHtml(job.name)}</strong>
                <span class="rarity-pill ${rarityForLevel(job.levelRequired)}">Lvl ${job.levelRequired}</span>
              </div>
              <div class="row-meta">Payout: $${formatNumber(job.payout)} | XP: ${job.xp}</div>
              <div class="row-meta">Duration: ${formatCountdown(job.durationMs)}</div>
              <button class="btn" data-action="start-job" data-id="${job.id}" ${buttonDisabled ? "disabled" : ""}>${buttonLabel}</button>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderBusinessesTab(state, now) {
  const buyMode = state?.businesses?.buyMultiplier === 10 || state?.businesses?.buyMultiplier === "max"
    ? state.businesses.buyMultiplier
    : 1;
  const totalPassivePerSec = getTotalPassivePerSec(state);
  const payoutIntervalSeconds = getPassiveIntervalSeconds(state);
  const cycle = getPassiveCycleProgress(state, now);

  return `
    <section class="section-stack">
      <article class="card">
        <h2>Businesses</h2>
        <div class="stats-line">
          <span>Total passive income: <strong>$${formatNumber(totalPassivePerSec * payoutIntervalSeconds)} per payout</strong></span>
          <span>Payout interval: <strong>${formatCountdown(payoutIntervalSeconds * 1000)}</strong></span>
        </div>
        <div class="top-actions">
          <button class="btn secondary ${buyMode === 1 ? "active-mode" : ""}" data-action="business-buy-mode" data-mode="1">Buy x1</button>
          <button class="btn secondary ${buyMode === 10 ? "active-mode" : ""}" data-action="business-buy-mode" data-mode="10">Buy x10</button>
          <button class="btn secondary ${buyMode === "max" ? "active-mode" : ""}" data-action="business-buy-mode" data-mode="max">Buy Max</button>
        </div>
      </article>

      <article class="card">
        <div class="list">
          ${BUSINESS_DEFS.map((definition) => {
            const locked = state.level < definition.unlockLevel;
            const businessState = getBusinessState(state, definition.id);
            const incomePerSec = getBusinessIncomePerSec(definition, businessState);
            const preview = getBusinessPurchasePreview(state, definition.id);
            const plannedCost = preview.qty > 0 ? preview.cost : preview.nextUnitCost;
            const plannedQty = preview.qty > 0 ? preview.qty : (buyMode === 10 ? 10 : 1);
            const upgradeCost = getUpgradeCost(definition, businessState.level);
            const canUpgrade = !locked && businessState.qty > 0 && Number(state.money || 0) >= upgradeCost;
            const buyButtonLabel = buyMode === "max"
              ? `Buy Max (${preview.qty})`
              : `Buy x${plannedQty}`;

            return `
              <div class="item-row ${locked ? "business-tile locked" : "business-tile"}">
                <div class="row-head">
                  <strong>${escapeHtml(definition.name)}</strong>
                  <span class="rarity-pill ${locked ? "common" : "uncommon"}">${locked ? `Lvl ${definition.unlockLevel}` : "Unlocked"}</span>
                </div>
                <div class="row-meta">${escapeHtml(definition.description || "")}</div>
                ${locked
                  ? `
                    <div class="row-meta">Unlocks at Level ${definition.unlockLevel}</div>
                    <div class="progress-wrap"><div class="progress-bar" style="width: 0%"></div></div>
                    <div class="row-meta">Next payout in: --:--</div>
                  `
                  : `
                    <div class="row-meta">Qty: ${formatNumber(businessState.qty)} | Level: ${formatNumber(businessState.level)}</div>
                    <div class="row-meta">Payout/cycle: $${formatNumber(incomePerSec * payoutIntervalSeconds)} every ${formatCountdown(payoutIntervalSeconds * 1000)}</div>
                    <div class="progress-wrap"><div class="progress-bar" style="width: ${(cycle.progress * 100).toFixed(1)}%"></div></div>
                    <div class="row-meta">Next payout in: ${formatCountdown(cycle.remainingMs)}</div>
                    <div class="row-meta">Next cost: $${formatNumber(plannedCost)}</div>
                    <div class="top-actions">
                      <button class="btn" data-action="buy-business" data-id="${definition.id}" ${preview.qty < 1 ? "disabled" : ""}>${buyButtonLabel}</button>
                      <button class="btn secondary" data-action="upgrade-business" data-id="${definition.id}" ${canUpgrade ? "" : "disabled"}>Upgrade ($${formatNumber(upgradeCost)})</button>
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
  const activeAbility = getActiveAbility(state, now);
  const remainingMs = activeAbility ? Math.max(0, Number(activeAbility.expiresAt || 0) - now) : 0;

  return `
    <section class="grid two">
      <article class="card">
        <h2>Inventory</h2>
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
                  ${(activeAbility || Number(entry.qty || 0) < 1) ? "disabled" : ""}
                >
                  Activate
                </button>
              </div>
            `).join("")
            : '<p class="hint empty-state">Inventory is empty.</p>'}
        </div>
      </article>

      <article class="card">
        <h2>Active Ability</h2>
        ${activeAbility
          ? `
            <div class="job-row">
              <div class="row-head">
                <strong>${escapeHtml(activeAbility.itemName)}</strong>
                <span class="badge delivered">active</span>
              </div>
              <div class="row-meta">${escapeHtml(activeAbility.effect)}</div>
              <div class="row-meta">Time remaining: ${formatCountdown(remainingMs)}</div>
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
  root.querySelectorAll("[data-action='business-buy-mode']").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.mode === "max" ? "max" : Number(button.dataset.mode);
      handlers.onSetBusinessBuyMode(mode);
    });
  });
  root.querySelectorAll("[data-action='start-job']").forEach((button) => {
    button.addEventListener("click", () => handlers.onStartJob(button.dataset.id));
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
