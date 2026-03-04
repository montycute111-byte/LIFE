import {
  clearCurrentSession,
  loadAccounts,
  loadCurrentSession,
  saveAccounts,
  saveCurrentSession
} from "./storage.js";

export function getStoredSession() {
  return loadCurrentSession();
}

export async function signUp(username, password) {
  const normalizedUsername = normalizeUsername(username);
  const normalizedPassword = String(password || "");

  if (normalizedUsername.length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }
  if (normalizedPassword.length < 4) {
    throw new Error("Password must be at least 4 characters.");
  }

  const { accounts } = loadAccounts();
  if (accounts[normalizedUsername]) {
    throw new Error("That username already exists.");
  }

  accounts[normalizedUsername] = {
    username: normalizedUsername,
    passwordHash: await hashPassword(normalizedPassword),
    createdAt: Date.now()
  };

  const saved = saveAccounts(accounts);
  if (!saved.ok) {
    throw new Error("Could not save the local account.");
  }

  const session = {
    username: normalizedUsername,
    isGuest: false
  };
  saveCurrentSession(session);
  return session;
}

export async function login(username, password) {
  const normalizedUsername = normalizeUsername(username);
  const normalizedPassword = String(password || "");
  const { accounts } = loadAccounts();
  const account = accounts[normalizedUsername];

  if (!account) {
    throw new Error("Account not found.");
  }

  const expectedHash = String(account.passwordHash || "");
  const passwordHash = await hashPassword(normalizedPassword);
  if (expectedHash !== passwordHash) {
    throw new Error("Incorrect password.");
  }

  const session = {
    username: normalizedUsername,
    isGuest: false
  };
  saveCurrentSession(session);
  return session;
}

export function createGuestSession() {
  const randomChunk = generateGuestSuffix();
  const session = {
    username: `guest_${Date.now().toString(36)}_${randomChunk}`,
    isGuest: true
  };
  saveCurrentSession(session);
  return session;
}

export function logout() {
  clearCurrentSession();
}

export async function hashPassword(password) {
  if (window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(String(password));
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  // Fallback is intentionally minimal. This is not secure, it only avoids complexity where Web Crypto is unavailable.
  return `plain:${String(password)}`;
}

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 18);
}

function generateGuestSuffix() {
  if (window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(3);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(36).slice(2, 8);
}
