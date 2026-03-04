import { SCHEMA_VERSION } from "./gameState.js";

export const ACCOUNTS_KEY = "fakebank_local_accounts_v1";
export const CURRENT_USER_KEY = "fakebank_current_user_v1";
export const SAVE_PREFIX = "fakebank_state_v1:";

export function getUserStateKey(username) {
  return `${SAVE_PREFIX}${String(username || "").trim().toLowerCase()}`;
}

export function loadAccounts() {
  const parsed = readJsonWithBackup(ACCOUNTS_KEY);
  if (!parsed.value || typeof parsed.value !== "object") {
    return {
      accounts: {},
      backupKey: parsed.backupKey || null
    };
  }

  const users = parsed.value.users && typeof parsed.value.users === "object" ? parsed.value.users : {};
  return {
    accounts: users,
    backupKey: parsed.backupKey || null
  };
}

export function saveAccounts(accounts) {
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    users: accounts
  };
  return writeJson(ACCOUNTS_KEY, payload);
}

export function loadCurrentSession() {
  const parsed = readJsonWithBackup(CURRENT_USER_KEY);
  if (!parsed.value || typeof parsed.value !== "object") {
    return {
      session: null,
      backupKey: parsed.backupKey || null
    };
  }

  return {
    session: {
      username: String(parsed.value.username || "").trim(),
      isGuest: Boolean(parsed.value.isGuest)
    },
    backupKey: parsed.backupKey || null
  };
}

export function saveCurrentSession(session) {
  return writeJson(CURRENT_USER_KEY, {
    username: session.username,
    isGuest: Boolean(session.isGuest)
  });
}

export function clearCurrentSession() {
  try {
    localStorage.removeItem(CURRENT_USER_KEY);
    return true;
  } catch (_error) {
    return false;
  }
}

export function loadUserState(username) {
  return readJsonWithBackup(getUserStateKey(username));
}

export function saveUserState(username, state) {
  return writeJson(getUserStateKey(username), state);
}

export function deleteUserState(username) {
  try {
    localStorage.removeItem(getUserStateKey(username));
    return true;
  } catch (_error) {
    return false;
  }
}

function readJsonWithBackup(key) {
  let raw = "";

  try {
    raw = localStorage.getItem(key) || "";
  } catch (_error) {
    return {
      value: null,
      backupKey: null
    };
  }

  if (!raw) {
    return {
      value: null,
      backupKey: null
    };
  }

  try {
    return {
      value: JSON.parse(raw),
      backupKey: null
    };
  } catch (_error) {
    const backupKey = createBackupKey(key);
    try {
      localStorage.setItem(backupKey, raw);
    } catch (_backupError) {
      // Best effort only. If backup write fails, recovery still falls back to a fresh state.
    }
    return {
      value: null,
      backupKey
    };
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return {
      ok: true
    };
  } catch (error) {
    return {
      ok: false,
      error
    };
  }
}

function createBackupKey(key) {
  return `${key}:backup:${Date.now()}`;
}
