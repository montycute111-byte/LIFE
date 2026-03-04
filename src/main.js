import { createGuestSession, getStoredSession, login, logout, signUp } from "./auth.js";
import {
  applyPassiveIncomeTick,
  buyBusinessUnits,
  grantOfflineEarnings,
  setBusinessBuyMultiplier,
  upgradeBusiness
} from "./businesses.js";
import { claimDailyReward, createDefaultState, migrateState, updateLastLogin } from "./gameState.js";
import { claimReadyJobs, refreshTimedState, startJobToFillSlots } from "./jobs.js";
import { buyResidence, moveInResidence, moveOutResidence, upgradeActiveResidence } from "./realEstate.js";
import { loadUserState, saveUserState } from "./storage.js";
import { activateInventoryItem, buyStoreItem } from "./store.js";
import { renderApp } from "./ui.js";

const AUTOSAVE_INTERVAL_MS = 30 * 1000;

const root = document.getElementById("app");
const viewModel = {
  session: null,
  state: null,
  authError: "",
  notice: "",
  saveStatus: "Idle"
};

boot();

function boot() {
  hydrateStoredSession();
  render();

  window.setInterval(() => {
    if (!viewModel.state) {
      return;
    }
    applyTimedUpdates();
    render();
  }, 1000);

  window.setInterval(() => {
    persist("Autosaved locally");
  }, AUTOSAVE_INTERVAL_MS);

  window.addEventListener("beforeunload", () => {
    persist("Saved before close");
  });
  window.addEventListener("pagehide", () => {
    persist("Saved before close");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      persist("Saved in background");
    }
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
  const loaded = loadUserState(session.username);
  const baseState = loaded.value
    ? migrateState(loaded.value, session.username)
    : createDefaultState(session.username, { isGuest: session.isGuest });

  updateLastLogin(baseState);
  const offline = grantOfflineEarnings(baseState);
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
  viewModel.notice = notices.join(" ");

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
    onLogout: handleLogout,
    onStartJob: (jobId) => runGameAction((state) => startJobToFillSlots(state, jobId)),
    onBuyStoreItem: (itemId) => runGameAction((state) => buyStoreItem(state, itemId)),
    onActivateInventoryItem: (itemId) => runGameAction((state) => activateInventoryItem(state, itemId)),
    onSetBusinessBuyMode: (mode) => runGameAction((state) => setBusinessBuyMultiplier(state, mode), { preserveNotice: true, preserveScroll: true }),
    onBuyBusiness: (businessId) => runGameAction((state) => buyBusinessUnits(state, businessId), { preserveScroll: true }),
    onUpgradeBusiness: (businessId) => runGameAction((state) => upgradeBusiness(state, businessId), { preserveScroll: true }),
    onBuyResidence: (residenceId) => runGameAction((state) => buyResidence(state, residenceId), { preserveScroll: true }),
    onMoveInResidence: (residenceId) => runGameAction((state) => moveInResidence(state, residenceId), { preserveScroll: true }),
    onMoveOutResidence: () => runGameAction((state) => moveOutResidence(state), { preserveScroll: true }),
    onUpgradeResidence: () => runGameAction((state) => upgradeActiveResidence(state), { preserveScroll: true }),
    onSetTab: (tabId) => runGameAction((state) => setActiveTab(state, tabId), { preserveNotice: true })
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
  persist("Saved before logout");
  logout();
  viewModel.session = null;
  viewModel.state = null;
  viewModel.authError = "";
  viewModel.notice = "Logged out. Pick an account to continue.";
  viewModel.saveStatus = "Idle";
  render();
}

function runGameAction(action, options = {}) {
  if (!viewModel.state) {
    return;
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
    return;
  }

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
}

function persist(label) {
  if (!viewModel.session || !viewModel.state) {
    return false;
  }

  viewModel.state.lastSavedAt = Date.now();
  const saved = saveUserState(viewModel.session.username, viewModel.state);
  viewModel.saveStatus = saved.ok ? `${label} at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : "Save failed";
  return saved.ok;
}

function describeActionResult(result) {
  if (!result || typeof result !== "object") {
    return "";
  }
  if (typeof result.reward === "number") {
    return `Daily reward claimed: +$${result.reward}.`;
  }
  if (typeof result.totalCash === "number") {
    return `Claimed ${result.count} job(s) for $${result.totalCash}.`;
  }
  if (result.order?.itemName) {
    return "Ordered!";
  }
  if (result.item?.name) {
    return `${result.item.name} activated.`;
  }
  if (result.businessName && Number(result.purchasedQty || 0) > 0) {
    return `Bought ${result.purchasedQty}x ${result.businessName}.`;
  }
  if (result.businessName && Number(result.newLevel || 0) > 1) {
    return `${result.businessName} upgraded to level ${result.newLevel}.`;
  }
  if (result.residenceName && Number(result.newLevel || 0) > 0) {
    return `${result.residenceName} upgraded to level ${result.newLevel}.`;
  }
  if (result.residenceName && result.movedIn) {
    return `Moved into ${result.residenceName}.`;
  }
  if (result.residenceName) {
    return `${result.residenceName} purchased.`;
  }
  if (result.movedOut) {
    return "Moved out. No active residence.";
  }
  if (result.job?.name) {
    if (Number(result.startedCount || 0) > 1) {
      return `${result.job.name} started in ${result.startedCount} slots.`;
    }
    return `${result.job.name} started.`;
  }
  return "Saved locally.";
}

function applyTimedUpdates() {
  if (!viewModel.state) {
    return;
  }
  const updates = refreshTimedState(viewModel.state);
  applyPassiveIncomeTick(viewModel.state);
  if (Number(updates?.deliveredCount || 0) > 0) {
    viewModel.notice = "Delivered!";
  }
}

function setActiveTab(state, tabId) {
  const safeTab = String(tabId || "").trim();
  const allowedTabs = new Set(["dashboard", "store", "orders", "inventory", "jobs", "businesses", "realestate"]);
  state.settings.activeTab = allowedTabs.has(safeTab) ? safeTab : "dashboard";
  return { ok: true };
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
