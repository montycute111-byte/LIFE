export const LOCAL_ACCOUNTS_KEY = "sq_local_accounts_v1";
export const ACTIVE_USER_KEY = "sq_active_user_v1";
export const STATE_KEY_PREFIX = "sq_state_v1_";

export function safeParseJSON(raw, fallback) {
  if (typeof raw !== "string") {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return fallback;
  }
}

export function loadAccounts() {
  const parsed = safeParseJSON(localStorage.getItem(LOCAL_ACCOUNTS_KEY), {});
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  return parsed;
}

export function saveAccounts(accounts) {
  localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts || {}));
}

export function setActiveUser(username) {
  if (!username) {
    localStorage.removeItem(ACTIVE_USER_KEY);
    return;
  }
  localStorage.setItem(ACTIVE_USER_KEY, username);
}

export function getActiveUser() {
  return localStorage.getItem(ACTIVE_USER_KEY);
}

export function loadUserState(username) {
  if (!username) {
    return null;
  }
  return safeParseJSON(localStorage.getItem(`${STATE_KEY_PREFIX}${username}`), null);
}

export function saveUserState(username, state) {
  if (!username || !state) {
    return;
  }
  localStorage.setItem(`${STATE_KEY_PREFIX}${username}`, JSON.stringify(state));
}

export function clearAllScheduleQuestData() {
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (key === LOCAL_ACCOUNTS_KEY || key === ACTIVE_USER_KEY || key.startsWith(STATE_KEY_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
}
