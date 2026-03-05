import { SCHEMA_VERSION as GAME_SCHEMA_VERSION } from "./gameState.js";
import {
  STORAGE_KEY,
  loadState,
  readKeyWithRecovery,
  saveState,
  writeKeyAtomically
} from "./persistence.js";

export const ACCOUNTS_KEY = "fakebank_local_accounts_v1";
export const CURRENT_USER_KEY = "fakebank_current_user_v1";
export const SAVE_PREFIX = `${STORAGE_KEY}:`;

export function getUserStateKey(username) {
  return `${SAVE_PREFIX}${String(username || "").trim().toLowerCase()}`;
}

export function loadAccounts() {
  const parsed = readKeyWithRecovery(ACCOUNTS_KEY);
  if (!parsed.value || typeof parsed.value !== "object") {
    return {
      accounts: {},
      backupKey: parsed.backupKey || null,
      recoveredFrom: parsed.recoveredFrom || null
    };
  }

  const users = parsed.value.users && typeof parsed.value.users === "object" ? parsed.value.users : {};
  return {
    accounts: users,
    backupKey: parsed.backupKey || null,
    recoveredFrom: parsed.recoveredFrom || null
  };
}

export function saveAccounts(accounts) {
  const payload = {
    schemaVersion: GAME_SCHEMA_VERSION,
    users: accounts
  };
  return writeKeyAtomically(ACCOUNTS_KEY, payload);
}

export function loadCurrentSession() {
  const parsed = readKeyWithRecovery(CURRENT_USER_KEY);
  if (!parsed.value || typeof parsed.value !== "object") {
    return {
      session: null,
      backupKey: parsed.backupKey || null,
      recoveredFrom: parsed.recoveredFrom || null
    };
  }

  return {
    session: {
      username: String(parsed.value.username || "").trim(),
      isGuest: Boolean(parsed.value.isGuest)
    },
    backupKey: parsed.backupKey || null,
    recoveredFrom: parsed.recoveredFrom || null
  };
}

export function saveCurrentSession(session) {
  return writeKeyAtomically(CURRENT_USER_KEY, {
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

export function loadUserState(username, options = {}) {
  return loadState(username, options);
}

export function saveUserState(username, state, options = {}) {
  return saveState(username, state, options);
}

export function deleteUserState(username) {
  const baseKey = getUserStateKey(username);
  try {
    localStorage.removeItem(baseKey);
    localStorage.removeItem(`${baseKey}_tmp`);
    localStorage.removeItem(`${baseKey}_bak`);
    return true;
  } catch (_error) {
    return false;
  }
}
