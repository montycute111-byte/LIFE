import { createGuestSession, getStoredSession, login, logout, signUp } from "./auth.js";
import {
  applyPassiveIncomeTick,
  buyBusinessUnits,
  grantOfflineEarnings,
  payBusinessUpkeep,
  setBusinessBuyMultiplier,
  upgradeBusiness
} from "./businesses.js";
import { openCrate, pruneExpiredBoosts } from "./crates.js";
import { checkEducationCompletion, enrollEducationProgram } from "./education.js";
import { claimDailyReward, updateLastLogin } from "./gameState.js";
import { claimReadyJobs, refreshTimedState, startJobToFillSlots, useInstantJobToken } from "./jobs.js";
import {
  getSerializedStateSize,
  getStateRevision,
  subscribeToStateChanges
} from "./persistence.js";
import {
  activatePowerItem,
  buyPowerItem,
  ensurePowerItemsState,
  getPowerItemMultipliers,
  syncPowerItems
} from "./powerItems.js";
import {
  buyRebirthShopUpgrade,
  ensureRebirthState,
  performRebirth
} from "./rebirth.js";
import { claimQuest, ensureDailyQuests, trackQuestEvent } from "./quests/questEngine.js";
import { loadUserState, saveUserState } from "./storage.js";
import { activateInventoryItem, buyStoreItem } from "./store.js";
import { renderApp } from "./ui.js";

const AUTOSAVE_INTERVAL_MS = 30 * 1000;
const QUEST_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const SAVE_DEBOUNCE_MS = 200;
const MAX_BULK_CRATE_OPENS = 500;
const SAVE_DEBUG_FLAG_KEY = "fakebank_debug_save_panel";

const root = document.getElementById("app");
const SHOW_SAVE_DEBUG_PANEL = isSaveDebugEnabled();
let pendingSaveTimer = null;
let stateStorageUnsubscribe = null;

const viewModel = {
  session: null,
  state: null,
  authError: "",
  notice: "",
  saveStatus: "Idle",
  isOpeningCrate: false,
  crateOpeningStage: "",
  crateOpeningRarity: "",
  lastCrateResult: null,
  crateOpenTimers: [],
  isEnrollingEducation: false,
  saveDebug: {
    enabled: SHOW_SAVE_DEBUG_PANEL,
    revision: 0,
    sizeBytes: 0,
    lastSaved: 0,
    lastError: ""
  }
};

boot();

function boot() {
  hydrateStoredSession();
  render();

  window.setInterval(() => {
    if (!viewModel.state) {
      return;
    }
    const beforeSignature = snapshotSignature(viewModel.state);
    applyTimedUpdates();
    const afterSignature = snapshotSignature(viewModel.state);
    if (beforeSignature !== afterSignature) {
      schedulePersist("Autosaved locally");
    }
    render();
  }, 1000);

  window.setInterval(() => {
    persist("Autosaved locally");
  }, AUTOSAVE_INTERVAL_MS);
  window.setInterval(() => {
    refreshDailyQuestsIfNeeded();
  }, QUEST_REFRESH_INTERVAL_MS);

  window.addEventListener("beforeunload", () => {
    flushPendingSave();
    persist("Saved before close");
  });
  window.addEventListener("pagehide", () => {
    flushPendingSave();
    persist("Saved before close");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushPendingSave();
      persist("Saved in background");
    }
  });
  window.addEventListener("focus", () => {
    refreshDailyQuestsIfNeeded();
  });
}

function hydrateStoredSession() {
  const stored = getStoredSession();
  if (!stored.session?.username) {
    if (stored.backupKey) {
      viewModel.notice = `A damaged session record was backed up to ${stored.backupKey}.`;
    }
    return;
  }
  loadGame(stored.session, {
    initialNotice: stored.backupKey ? `A damaged session record was backed up to ${stored.backupKey}.` : ""
  });
}

function loadGame(session, options = {}) {
  const loaded = loadUserState(session.username, { isGuest: session.isGuest });
  const baseState = loaded.value;

  updateLastLogin(baseState);
  ensureRebirthState(baseState);
  ensurePowerItemsState(baseState);
  const educationLoadUpdates = checkEducationCompletion(baseState);
  const powerSync = syncPowerItems(baseState);
  const offline = grantOfflineEarnings(baseState);
  const questRoll = ensureDailyQuests(baseState);
  viewModel.session = session;
  viewModel.state = baseState;
  viewModel.authError = "";
  const notices = [];
  if (loaded.backupKey) {
    notices.push(`Recovered from a damaged save. Backup kept at ${loaded.backupKey}.`);
  } else if (options.initialNotice) {
    notices.push(options.initialNotice);
  }
  if (offline.earned > 0) {
    notices.push(formatOfflineEarningsNotice(offline.earned, offline.elapsedSeconds));
  }
  if (educationLoadUpdates.completedCount > 0) {
    notices.push("Education completed while offline.");
  }
  if (powerSync.changed && powerSync.expiredItemName) {
    notices.push(`${powerSync.expiredItemName} expired while offline.`);
  }
  if (questRoll.rolled) {
    notices.push("New daily quests are ready.");
  }
  viewModel.notice = notices.join(" ");
  attachStorageSync(session.username);
  updateSaveDebug("");

  persist("Loaded local save");
}

function render() {
  renderApp(root, viewModel, {
    onLogin: handleLogin,
    onSignUp: handleSignUp,
    onGuest: handleGuest,
    onClaimDaily: () => runGameAction((state) => claimDailyReward(state)),
    onClaimJobs: () => runGameAction((state) => claimReadyJobs(state)),
    onSaveNow: () => {
      persist("Saved locally");
      render();
    },
    onForceSave: () => {
      flushPendingSave();
      persist("Force-saved locally");
      render();
    },
    onExportSave: () => {
      exportSaveJson();
    },
    onLogout: handleLogout,
    onStartJob: (jobId) => runGameAction((state) => startJobToFillSlots(state, jobId)),
    onUseInstantToken: (jobId) => runGameAction((state) => useInstantJobToken(state, jobId), { preserveScroll: true }),
    onBuyStoreItem: (itemId) => runGameAction((state) => buyStoreItem(state, itemId)),
    onActivateInventoryItem: (itemId) => runGameAction((state) => activateInventoryItem(state, itemId)),
    onBuyPowerItem: (itemId) => runGameAction((state) => buyPowerItem(state, itemId), { preserveScroll: true }),
    onActivatePowerItem: (itemId) => runGameAction((state) => activatePowerItem(state, itemId), { preserveScroll: true }),
    onOpenCrate: (rarity) => handleOpenCrate(rarity),
    onOpenAllCrates: (rarity) => handleOpenAllCrates(rarity),
    onEnrollEducation: (programId) => handleEnrollEducation(programId),
    onBuyRebirthUpgrade: (upgradeId) => runGameAction((state) => buyRebirthShopUpgrade(state, upgradeId), { preserveScroll: true }),
    onConfirmRebirth: () => handleRebirthConfirm(),
    onSetJobsSubTab: (tabId) => runGameAction((state) => setJobsSubTab(state, tabId), { preserveNotice: true, preserveScroll: true }),
    onSetBusinessBuyMode: (mode) => runGameAction((state) => setBusinessBuyMultiplier(state, mode), { preserveNotice: true, preserveScroll: true }),
    onSetBusinessesSubTab: (tabId) => runGameAction((state) => setBusinessesSubTab(state, tabId), { preserveNotice: true, preserveScroll: true }),
    onBuyBusiness: (businessId) => runGameAction((state) => buyBusinessUnits(state, businessId), { preserveScroll: true }),
    onUpgradeBusiness: (businessId) => runGameAction((state) => upgradeBusiness(state, businessId), { preserveScroll: true }),
    onPayBusinessUpkeep: (businessId) => runGameAction((state) => payBusinessUpkeep(state, businessId), { preserveScroll: true }),
    onClaimQuest: (questId) => runGameAction((state) => claimQuest(state, questId), { preserveScroll: true }),
    onSetTab: (tabId) => runGameAction((state) => setActiveTab(state, tabId), { preserveNotice: true }),
    onSetStoreTab: (tabId) => runGameAction((state) => setStoreSubTab(state, tabId), { preserveNotice: true, preserveScroll: true })
  });
}

async function handleLogin(credentials) {
  try {
    const session = await login(credentials.username, credentials.password);
    loadGame(session);
  } catch (error) {
    viewModel.authError = error.message || "Login failed.";
  }
  render();
}

async function handleSignUp(credentials) {
  try {
    const session = await signUp(credentials.username, credentials.password);
    loadGame(session);
  } catch (error) {
    viewModel.authError = error.message || "Sign-up failed.";
  }
  render();
}

function handleGuest() {
  const session = createGuestSession();
  loadGame(session);
  render();
}

function handleLogout() {
  clearCrateOpenTimers();
  flushPendingSave();
  persist("Saved before logout");
  detachStorageSync();
  logout();
  viewModel.session = null;
  viewModel.state = null;
  viewModel.authError = "";
  viewModel.notice = "Logged out. Pick an account to continue.";
  viewModel.saveStatus = "Idle";
  viewModel.isOpeningCrate = false;
  viewModel.crateOpeningStage = "";
  viewModel.crateOpeningRarity = "";
  viewModel.lastCrateResult = null;
  viewModel.isEnrollingEducation = false;
  updateSaveDebug(null);
  render();
}

function runGameAction(action, options = {}) {
  if (!viewModel.state) {
    return null;
  }

  const scrollY = options.preserveScroll ? window.scrollY : null;
  applyTimedUpdates();
  const result = action(viewModel.state);
  if (result?.ok === false) {
    viewModel.notice = result.message || "Action could not be completed.";
    render();
    if (scrollY !== null) {
      window.scrollTo(0, scrollY);
    }
    return result || null;
  }

  if (typeof result?.reward === "number" && Number(result?.xpGain || 0) > 0) {
    trackQuestEvent(viewModel.state, "XP_GAIN", { amount: Number(result.xpGain || 0) });
    if (Number(result?.levelsGained || 0) > 0) {
      trackQuestEvent(viewModel.state, "LEVEL_UP", { count: Number(result.levelsGained || 0), amount: Number(result.levelsGained || 0) });
    }
  }
  trackQuestEvent(viewModel.state, "CASH_BALANCE", { amount: Number(viewModel.state.money || 0) });

  persist("Saved locally");
  if (result?.ok !== false) {
    if (!options.preserveNotice) {
      viewModel.notice = typeof options.successMessage === "string"
        ? options.successMessage
        : describeActionResult(result);
    }
  }
  render();
  if (scrollY !== null) {
    window.scrollTo(0, scrollY);
  }
  return result || null;
}

function persist(label) {
  if (!viewModel.session || !viewModel.state) {
    return false;
  }
  if (pendingSaveTimer) {
    window.clearTimeout(pendingSaveTimer);
    pendingSaveTimer = null;
  }

  const saved = saveUserState(viewModel.session.username, viewModel.state);
  if (!saved.ok) {
    if (saved.conflict && saved.latestState) {
      // Protect against stale-tab overwrites by taking the newer state.
      const latest = loadUserState(viewModel.session.username, { isGuest: viewModel.session.isGuest });
      if (latest.value) {
        viewModel.state = latest.value;
      }
      viewModel.notice = "Newer save detected in another tab. Loaded latest progress.";
      viewModel.saveStatus = "Synced newer save";
      updateSaveDebug("Save conflict resolved by syncing newer revision.");
      return false;
    }
    const errorMessage = saved.error?.message || "Save failed.";
    viewModel.saveStatus = "Save failed";
    updateSaveDebug(errorMessage);
    return false;
  }

  const now = Number(viewModel.state?._meta?.lastSaved || Date.now());
  viewModel.saveStatus = `${label} at ${new Date(now).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}`;
  updateSaveDebug("");
  return true;
}

function describeActionResult(result) {
  if (!result || typeof result !== "object") {
    return "";
  }
  if (typeof result.reward === "number") {
    return `Daily reward claimed: +$${result.reward}.`;
  }
  if (typeof result.totalCash === "number" && typeof result.count === "number") {
    const totalDrops = Number(result?.crateDrops?.common || 0)
      + Number(result?.crateDrops?.rare || 0)
      + Number(result?.crateDrops?.epic || 0)
      + Number(result?.crateDrops?.legendary || 0);
    if (totalDrops > 0) {
      return `Claimed ${result.count} job(s) for $${result.totalCash}. Crates dropped: ${totalDrops}.`;
    }
    return `Claimed ${result.count} job(s) for $${result.totalCash}.`;
  }
  if (result.rarity && result.rewardType) {
    return `${result.rarity[0].toUpperCase()}${result.rarity.slice(1)} Crate: ${result.description}`;
  }
  if (result.programName) {
    return `Enrolled in ${result.programName}.`;
  }
  if (result.order?.itemName) {
    return "Ordered!";
  }
  if (result.purchasedItemName) {
    return `${result.purchasedItemName} purchased.`;
  }
  if (result.activatedItemName) {
    if (result.replacedItemName) {
      return `${result.activatedItemName} activated. Replaced ${result.replacedItemName}.`;
    }
    return `${result.activatedItemName} activated.`;
  }
  if (result.item?.name) {
    return `${result.item.name} activated.`;
  }
  if (result.questTitle) {
    return `Quest claimed: ${result.questTitle}.`;
  }
  if (result.businessName && Number(result.purchasedQty || 0) > 0) {
    return `Bought ${result.purchasedQty}x ${result.businessName}.`;
  }
  if (result.businessName && Number(result.newLevel || 0) > 1) {
    return `${result.businessName} upgraded to level ${result.newLevel}.`;
  }
  if (result.businessName && Number(result.upkeepPaid || 0) > 0) {
    return `${result.businessName} resumed (paid $${result.upkeepPaid.toLocaleString()} upkeep).`;
  }
  if (result.job?.name) {
    if (typeof result.tokensLeft === "number") {
      return `${result.job.name} finished with token. Tokens left: ${result.tokensLeft}.`;
    }
    if (Number(result.startedCount || 0) > 1) {
      return `${result.job.name} started in ${result.startedCount} slots.`;
    }
    return `${result.job.name} started.`;
  }
  if (result.upgradeName) {
    return `${result.upgradeName} purchased for ${result.cost} rebirth points.`;
  }
  if (typeof result.award === "number" && typeof result.rebirths === "number") {
    return `Rebirth complete! +${result.award} points. Total rebirths: ${result.rebirths}.`;
  }
  return "Saved locally.";
}

function applyTimedUpdates() {
  if (!viewModel.state) {
    return;
  }
  const powerSync = syncPowerItems(viewModel.state);
  if (powerSync.changed && powerSync.expiredItemName) {
    viewModel.notice = `${powerSync.expiredItemName} expired.`;
  }
  const updates = refreshTimedState(viewModel.state);
  const educationUpdates = checkEducationCompletion(viewModel.state);
  if (educationUpdates.completedCount > 0) {
    viewModel.notice = "Education program completed!";
  }
  pruneExpiredBoosts(viewModel.state);
  const passive = applyPassiveIncomeTick(viewModel.state);
  if (Number(passive?.earned || 0) > 0) {
    const cycles = Math.max(1, Number(passive.cycles || 1));
    trackQuestEvent(viewModel.state, "BIZ_COLLECT", { amount: Number(passive.earned || 0), count: cycles });
    trackQuestEvent(viewModel.state, "CASH_BALANCE", { amount: Number(viewModel.state.money || 0) });
    viewModel.notice = `Passive income: +$${Math.round(passive.earned).toLocaleString()}.`;
  }
  const activePower = getPowerItemMultipliers(viewModel.state);
  if (activePower.autoCollectJobs) {
    const autoClaim = claimReadyJobs(viewModel.state);
    if (autoClaim?.ok) {
      viewModel.notice = `Auto Collector claimed ${autoClaim.count} job(s) for $${autoClaim.totalCash}.`;
    }
  }
  if (Number(updates?.deliveredCount || 0) > 0) {
    viewModel.notice = "Delivered!";
  }
}

function setActiveTab(state, tabId) {
  const safeTab = String(tabId || "").trim();
  if (safeTab === "poweritems") {
    state.settings.activeTab = "store";
    state.settings.storeSubTab = "power";
    return { ok: true };
  }
  const allowedTabs = new Set(["dashboard", "store", "orders", "inventory", "jobs", "businesses", "crates", "education", "quests", "rebirth"]);
  state.settings.activeTab = allowedTabs.has(safeTab) ? safeTab : "dashboard";
  return { ok: true };
}

function setStoreSubTab(state, tabId) {
  const safeTab = String(tabId || "").trim().toLowerCase();
  state.settings.storeSubTab = safeTab === "power" ? "power" : "items";
  state.settings.activeTab = "store";
  return { ok: true };
}

function setJobsSubTab(state, tabId) {
  const safeTab = String(tabId || "").trim().toLowerCase();
  state.settings.jobsSubTab = (safeTab === "hs" || safeTab === "college") ? safeTab : "core";
  state.settings.activeTab = "jobs";
  return { ok: true };
}

function setBusinessesSubTab(state, tabId) {
  const safeTab = String(tabId || "").trim().toLowerCase();
  state.settings.businessesSubTab = (safeTab === "hs" || safeTab === "college") ? safeTab : "core";
  state.settings.activeTab = "businesses";
  return { ok: true };
}

function handleRebirthConfirm() {
  if (!viewModel.state) {
    return;
  }
  const proceed = window.confirm("Rebirth will reset most progress. Continue?");
  if (!proceed) {
    return;
  }
  runGameAction((state) => performRebirth(state));
}

function handleOpenCrate(rarity) {
  if (!viewModel.state || viewModel.isOpeningCrate) {
    return;
  }
  const normalized = String(rarity || "").toLowerCase();
  const available = Math.max(0, Number(viewModel.state?.cratesInventory?.[normalized] || 0));
  if (available < 1) {
    viewModel.notice = "No crates of that rarity available.";
    render();
    return;
  }

  clearCrateOpenTimers();
  viewModel.isOpeningCrate = true;
  viewModel.crateOpeningRarity = normalized;
  viewModel.crateOpeningStage = "Opening...";
  viewModel.lastCrateResult = null;
  render();

  const openingTimer = window.setTimeout(() => {
    viewModel.crateOpeningStage = "Rolling...";
    render();
  }, 350);

  const resolveTimer = window.setTimeout(() => {
    const result = runGameAction((state) => openCrate(state, normalized), { preserveNotice: true, preserveScroll: true });
    if (result?.ok) {
      viewModel.lastCrateResult = result;
      viewModel.notice = `${normalized[0].toUpperCase()}${normalized.slice(1)} Crate: ${result.description}`;
    }
    viewModel.isOpeningCrate = false;
    viewModel.crateOpeningStage = "";
    viewModel.crateOpeningRarity = "";
    clearCrateOpenTimers();
    render();
  }, 950);

  viewModel.crateOpenTimers = [openingTimer, resolveTimer];
}

function handleOpenAllCrates(rarity) {
  if (!viewModel.state || viewModel.isOpeningCrate) {
    return;
  }
  const normalized = String(rarity || "").toLowerCase();
  const available = Math.max(0, Number(viewModel.state?.cratesInventory?.[normalized] || 0));
  if (available < 1) {
    viewModel.notice = "No crates of that rarity available.";
    render();
    return;
  }

  clearCrateOpenTimers();
  viewModel.isOpeningCrate = true;
  viewModel.crateOpeningRarity = normalized;
  viewModel.crateOpeningStage = `Opening all (${Math.min(available, MAX_BULK_CRATE_OPENS)})...`;
  viewModel.lastCrateResult = null;
  render();

  const openingTimer = window.setTimeout(() => {
    viewModel.crateOpeningStage = "Rolling...";
    render();
  }, 220);

  const resolveTimer = window.setTimeout(() => {
    const toOpen = Math.min(available, MAX_BULK_CRATE_OPENS);
    let opened = 0;
    let lastResult = null;

    for (let i = 0; i < toOpen; i += 1) {
      const result = openCrate(viewModel.state, normalized, Date.now() + i);
      if (!result?.ok) {
        break;
      }
      opened += 1;
      lastResult = result;
    }

    if (opened > 0) {
      persist("Saved locally");
      viewModel.lastCrateResult = lastResult;
      const cappedNote = available > toOpen ? ` (first ${toOpen} only)` : "";
      viewModel.notice = `Opened ${opened} ${normalized} crate${opened === 1 ? "" : "s"}${cappedNote}.`;
    } else {
      viewModel.notice = "No crates were opened.";
    }

    viewModel.isOpeningCrate = false;
    viewModel.crateOpeningStage = "";
    viewModel.crateOpeningRarity = "";
    clearCrateOpenTimers();
    render();
  }, 700);

  viewModel.crateOpenTimers = [openingTimer, resolveTimer];
}

function handleEnrollEducation(programId) {
  if (!viewModel.state || viewModel.isEnrollingEducation) {
    return;
  }
  viewModel.isEnrollingEducation = true;
  render();
  runGameAction((state) => enrollEducationProgram(state, programId), { preserveScroll: true });
  viewModel.isEnrollingEducation = false;
  render();
}

function clearCrateOpenTimers() {
  for (const timerId of viewModel.crateOpenTimers) {
    window.clearTimeout(timerId);
  }
  viewModel.crateOpenTimers = [];
}

function formatOfflineEarningsNotice(amount, elapsedSeconds) {
  return `Offline earnings: +$${Math.round(amount).toLocaleString()} (${formatOfflineDuration(elapsedSeconds)})`;
}

function formatOfflineDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function refreshDailyQuestsIfNeeded() {
  if (!viewModel.state) {
    return;
  }
  const result = ensureDailyQuests(viewModel.state);
  if (!result.rolled) {
    return;
  }
  viewModel.notice = "New daily quests are available.";
  persist("Saved daily quests");
  render();
}

function schedulePersist(label) {
  if (!viewModel.session || !viewModel.state) {
    return;
  }
  if (pendingSaveTimer) {
    window.clearTimeout(pendingSaveTimer);
  }
  pendingSaveTimer = window.setTimeout(() => {
    pendingSaveTimer = null;
    persist(label || "Autosaved locally");
    render();
  }, SAVE_DEBOUNCE_MS);
}

function flushPendingSave() {
  if (!pendingSaveTimer) {
    return;
  }
  window.clearTimeout(pendingSaveTimer);
  pendingSaveTimer = null;
}

function attachStorageSync(username) {
  detachStorageSync();
  stateStorageUnsubscribe = subscribeToStateChanges(username, (incomingState, meta) => {
    if (!viewModel.state || !viewModel.session) {
      return;
    }
    const incomingRevision = Math.max(0, Number(meta?.revision || getStateRevision(incomingState)));
    const localRevision = getStateRevision(viewModel.state);
    if (incomingRevision <= localRevision) {
      return;
    }
    viewModel.state = incomingState;
    viewModel.notice = "Newer save detected from another tab. Synced.";
    viewModel.saveStatus = `Synced rev ${incomingRevision}`;
    updateSaveDebug("");
    render();
  });
}

function detachStorageSync() {
  if (typeof stateStorageUnsubscribe === "function") {
    stateStorageUnsubscribe();
  }
  stateStorageUnsubscribe = null;
}

function updateSaveDebug(lastErrorMessage) {
  if (!viewModel.saveDebug?.enabled) {
    return;
  }
  const currentState = viewModel.state;
  viewModel.saveDebug = {
    enabled: true,
    revision: currentState ? getStateRevision(currentState) : 0,
    sizeBytes: currentState ? getSerializedStateSize(currentState) : 0,
    lastSaved: Number(currentState?._meta?.lastSaved || 0),
    lastError: String(lastErrorMessage || "")
  };
}

function exportSaveJson() {
  if (!viewModel.session || !viewModel.state) {
    return;
  }
  try {
    const serialized = JSON.stringify(viewModel.state, null, 2);
    const blob = new Blob([serialized], { type: "application/json" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const username = String(viewModel.session.username || "player");
    link.href = downloadUrl;
    link.download = `fakebank-save-${username}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
    viewModel.notice = "Save exported to JSON.";
    updateSaveDebug("");
    render();
  } catch (error) {
    viewModel.notice = "Could not export save JSON.";
    updateSaveDebug(error?.message || "Export failed");
    render();
  }
}

function snapshotSignature(state) {
  if (!state || typeof state !== "object") {
    return "";
  }
  try {
    return JSON.stringify(state);
  } catch (_error) {
    return "";
  }
}

function isSaveDebugEnabled() {
  try {
    if (new URLSearchParams(window.location.search).get("debugSave") === "1") {
      return true;
    }
    return localStorage.getItem(SAVE_DEBUG_FLAG_KEY) === "1";
  } catch (_error) {
    return false;
  }
}
