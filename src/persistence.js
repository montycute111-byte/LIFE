import {
  SCHEMA_VERSION as GAME_SCHEMA_VERSION,
  createDefaultState,
  migrateState
} from "./gameState.js";

export const STORAGE_KEY = "fakebank_state_v1";
export const SCHEMA_VERSION = GAME_SCHEMA_VERSION;

const TMP_SUFFIX = "_tmp";
const BACKUP_SUFFIX = "_bak";
const CORRUPT_PREFIX = ":corrupt:";

export function getStateStorageKey(username) {
  return `${STORAGE_KEY}:${normalizeUsernameKey(username)}`;
}

export function getStateRevision(state) {
  return Math.max(0, Math.floor(Number(state?._meta?.revision || 0)));
}

export function getSerializedStateSize(state) {
  try {
    return new TextEncoder().encode(JSON.stringify(state)).length;
  } catch (_error) {
    return 0;
  }
}

export function loadState(username, options = {}) {
  const key = getStateStorageKey(username);
  const read = readKeyWithRecovery(key);
  const normalizedUsername = normalizeUsernameKey(username);
  const nextState = read.value && typeof read.value === "object"
    ? migrateState(read.value, normalizedUsername)
    : createDefaultState(normalizedUsername, { isGuest: Boolean(options?.isGuest) });

  ensureStateMeta(nextState, { setLoadedAt: true });
  return {
    value: nextState,
    backupKey: read.backupKey || null,
    recoveredFrom: read.recoveredFrom || null
  };
}

export function saveState(username, state, options = {}) {
  if (!state || typeof state !== "object") {
    return {
      ok: false,
      error: new Error("Invalid state object.")
    };
  }

  const key = getStateStorageKey(username);
  const currentRead = readKeyWithRecovery(key);
  const currentRevision = getStateRevision(currentRead.value);
  const localRevision = getStateRevision(state);
  const allowStaleWrite = Boolean(options?.allowStaleWrite);

  if (!allowStaleWrite && currentRevision > localRevision) {
    return {
      ok: false,
      conflict: true,
      remoteRevision: currentRevision,
      localRevision,
      latestState: currentRead.value && typeof currentRead.value === "object" ? currentRead.value : null
    };
  }

  ensureStateMeta(state, { setLoadedAt: false });
  const now = Date.now();
  const nextRevision = Math.max(localRevision + 1, currentRevision + 1);
  state.schemaVersion = SCHEMA_VERSION;
  state._meta.schemaVersion = SCHEMA_VERSION;
  state._meta.revision = nextRevision;
  state._meta.lastSaved = now;
  state.lastSavedAt = now;

  let serialized = "";
  try {
    serialized = JSON.stringify(state);
  } catch (error) {
    return {
      ok: false,
      error
    };
  }

  const written = writeKeyAtomically(key, serialized);
  if (!written.ok) {
    return written;
  }

  return {
    ok: true,
    revision: nextRevision,
    sizeBytes: written.sizeBytes
  };
}

export function subscribeToStateChanges(username, callback) {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return () => {};
  }
  const key = getStateStorageKey(username);
  const onStorage = (event) => {
    if (!event || event.storageArea !== localStorage || event.key !== key || !event.newValue) {
      return;
    }
    const parsed = parseJson(event.newValue);
    if (!parsed.ok || !parsed.value || typeof parsed.value !== "object") {
      return;
    }
    const incoming = migrateState(parsed.value, normalizeUsernameKey(username));
    ensureStateMeta(incoming, { setLoadedAt: true });
    callback(incoming, {
      revision: getStateRevision(incoming)
    });
  };

  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
  };
}

export function readKeyWithRecovery(key) {
  const mainRaw = safeGetItem(key);
  const backupRaw = safeGetItem(getBackupKey(key));
  const tempRaw = safeGetItem(getTempKey(key));

  let backupKey = null;
  const parsedMain = parseJson(mainRaw);
  if (parsedMain.ok) {
    return {
      value: parsedMain.value,
      backupKey: null,
      recoveredFrom: "main"
    };
  }

  if (typeof mainRaw === "string" && mainRaw.length > 0) {
    backupKey = `${key}${CORRUPT_PREFIX}${Date.now()}`;
    safeSetItem(backupKey, mainRaw);
  }

  const parsedBackup = parseJson(backupRaw);
  if (parsedBackup.ok) {
    return {
      value: parsedBackup.value,
      backupKey,
      recoveredFrom: "backup"
    };
  }

  const parsedTemp = parseJson(tempRaw);
  if (parsedTemp.ok) {
    return {
      value: parsedTemp.value,
      backupKey,
      recoveredFrom: "temp"
    };
  }

  return {
    value: null,
    backupKey,
    recoveredFrom: null
  };
}

export function writeKeyAtomically(key, serializedValue) {
  try {
    const serialized = typeof serializedValue === "string"
      ? serializedValue
      : JSON.stringify(serializedValue);
    const tempKey = getTempKey(key);
    const backupKey = getBackupKey(key);
    const currentRaw = localStorage.getItem(key);

    if (typeof currentRaw === "string" && currentRaw.length > 0) {
      localStorage.setItem(backupKey, currentRaw);
    }

    localStorage.setItem(tempKey, serialized);
    localStorage.setItem(key, serialized);

    if (!currentRaw) {
      localStorage.setItem(backupKey, serialized);
    }
    localStorage.removeItem(tempKey);

    return {
      ok: true,
      sizeBytes: new TextEncoder().encode(serialized).length
    };
  } catch (error) {
    return {
      ok: false,
      error
    };
  }
}

function ensureStateMeta(state, options = {}) {
  const now = Date.now();
  const currentMeta = state?._meta && typeof state._meta === "object" ? state._meta : {};
  const revision = Math.max(0, Math.floor(Number(currentMeta.revision || 0)));
  state._meta = {
    schemaVersion: SCHEMA_VERSION,
    revision,
    lastSaved: Number.isFinite(currentMeta.lastSaved) ? currentMeta.lastSaved : 0,
    lastLoaded: Number.isFinite(currentMeta.lastLoaded) ? currentMeta.lastLoaded : now
  };
  if (options.setLoadedAt) {
    state._meta.lastLoaded = now;
  }
}

function getTempKey(key) {
  return `${key}${TMP_SUFFIX}`;
}

function getBackupKey(key) {
  return `${key}${BACKUP_SUFFIX}`;
}

function normalizeUsernameKey(username) {
  return String(username || "")
    .trim()
    .toLowerCase();
}

function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (_error) {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (_error) {
    return false;
  }
}

function parseJson(raw) {
  if (typeof raw !== "string" || raw.length < 1) {
    return {
      ok: false,
      value: null
    };
  }
  try {
    return {
      ok: true,
      value: JSON.parse(raw)
    };
  } catch (_error) {
    return {
      ok: false,
      value: null
    };
  }
}
