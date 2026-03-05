import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { sha256 } from "../lib/crypto";
import {
  ACTIVE_USER_KEY,
  clearAllScheduleQuestData,
  getActiveUser,
  loadAccounts,
  loadUserState,
  saveAccounts,
  saveUserState,
  setActiveUser
} from "../lib/storage";
import { applyDailyRollover, createDefaultState, hydrateUserState } from "../lib/game";

const AppStoreContext = createContext(null);

function sanitizeUsername(input) {
  return String(input || "").trim().toLowerCase();
}

function randomGuestName(existingAccounts) {
  let tries = 0;
  while (tries < 1000) {
    const candidate = `guest_${Math.floor(1000 + Math.random() * 9000)}`;
    if (!existingAccounts[candidate]) {
      return candidate;
    }
    tries += 1;
  }
  return `guest_${Date.now()}`;
}

export function AppStoreProvider({ children }) {
  const [accounts, setAccounts] = useState({});
  const [activeUser, setActiveUserState] = useState(null);
  const [userState, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const saveTimerRef = useRef(null);

  useEffect(() => {
    const loadedAccounts = loadAccounts();
    setAccounts(loadedAccounts);

    const storedActive = getActiveUser();
    if (storedActive && loadedAccounts[storedActive]) {
      const raw = loadUserState(storedActive);
      const hydrated = hydrateUserState(raw, storedActive, loadedAccounts[storedActive].createdAt);
      setActiveUserState(storedActive);
      setUserState(hydrated);
    } else {
      localStorage.removeItem(ACTIVE_USER_KEY);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!activeUser || !userState) {
      return undefined;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveUserState(activeUser, userState);
    }, 300);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [activeUser, userState]);

  useEffect(() => {
    if (!activeUser) {
      return undefined;
    }

    const interval = setInterval(() => {
      setUserState((prev) => (prev ? applyDailyRollover(prev) : prev));
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [activeUser]);

  async function signUp(usernameInput, secretInput) {
    const username = sanitizeUsername(usernameInput);
    const secret = String(secretInput || "");

    if (!username || username.length < 3) {
      setError("Username must be at least 3 characters.");
      return false;
    }
    if (accounts[username]) {
      setError("Username already exists on this device.");
      return false;
    }
    if (secret && /^\d+$/.test(secret) && (secret.length < 4 || secret.length > 8)) {
      setError("PIN must be 4-8 digits.");
      return false;
    }

    const passHash = await sha256(secret);
    const createdAt = Date.now();

    const nextAccounts = {
      ...accounts,
      [username]: {
        username,
        passHash,
        createdAt
      }
    };

    saveAccounts(nextAccounts);
    setAccounts(nextAccounts);

    const initial = createDefaultState(username, createdAt);
    saveUserState(username, initial);
    setActiveUser(username);
    setActiveUserState(username);
    setUserState(initial);
    setError("");
    setNotice(`Welcome, ${username}.`);
    return true;
  }

  async function login(usernameInput, secretInput) {
    const username = sanitizeUsername(usernameInput);
    const account = accounts[username];
    if (!account) {
      setError("Account not found.");
      return false;
    }

    const passHash = await sha256(String(secretInput || ""));
    if (account.passHash !== passHash) {
      setError("Invalid password or PIN.");
      return false;
    }

    const raw = loadUserState(username);
    const hydrated = hydrateUserState(raw, username, account.createdAt);
    setActiveUser(username);
    setActiveUserState(username);
    setUserState(hydrated);
    setError("");
    setNotice(`Welcome back, ${username}.`);
    return true;
  }

  async function continueAsGuest() {
    const guestName = randomGuestName(accounts);
    const createdAt = Date.now();
    const passHash = await sha256("");
    const nextAccounts = {
      ...accounts,
      [guestName]: {
        username: guestName,
        passHash,
        createdAt
      }
    };
    saveAccounts(nextAccounts);
    setAccounts(nextAccounts);

    const initial = createDefaultState(guestName, createdAt);
    saveUserState(guestName, initial);
    setActiveUser(guestName);
    setActiveUserState(guestName);
    setUserState(initial);
    setError("");
    setNotice(`Guest session started: ${guestName}`);
    return guestName;
  }

  function logout() {
    setActiveUser(null);
    setActiveUserState(null);
    setUserState(null);
    setNotice("Logged out.");
    setError("");
  }

  function switchUser(username) {
    const normalized = sanitizeUsername(username);
    const account = accounts[normalized];
    if (!account) {
      setError("Account not found for switch.");
      return false;
    }
    const raw = loadUserState(normalized);
    const hydrated = hydrateUserState(raw, normalized, account.createdAt);
    setActiveUser(normalized);
    setActiveUserState(normalized);
    setUserState(hydrated);
    setError("");
    setNotice(`Switched to ${normalized}.`);
    return true;
  }

  function updateState(mutator, successNotice = "") {
    setUserState((prev) => {
      if (!prev) {
        return prev;
      }
      const next = typeof mutator === "function" ? mutator(prev) : mutator;
      return applyDailyRollover(next);
    });
    if (successNotice) {
      setNotice(successNotice);
    }
    setError("");
  }

  function setAppError(message) {
    setError(message || "");
  }

  function clearMessages() {
    setError("");
    setNotice("");
  }

  function resetAllLocalData() {
    clearAllScheduleQuestData();
    setAccounts({});
    setActiveUserState(null);
    setUserState(null);
    setNotice("All local ScheduleQuest data was cleared.");
    setError("");
  }

  const value = useMemo(() => ({
    loading,
    accounts,
    activeUser,
    userState,
    error,
    notice,
    signUp,
    login,
    continueAsGuest,
    logout,
    switchUser,
    updateState,
    setAppError,
    clearMessages,
    resetAllLocalData
  }), [loading, accounts, activeUser, userState, error, notice]);

  return (
    <AppStoreContext.Provider value={value}>
      {children}
    </AppStoreContext.Provider>
  );
}

export function useAppStore() {
  const value = useContext(AppStoreContext);
  if (!value) {
    throw new Error("useAppStore must be used inside AppStoreProvider");
  }
  return value;
}
