/**
 * Device-side admin session for the shop dashboard.
 *
 * The shop runs on a single admin account, so the credentials live in the app
 * and the session is kept on the device: a device that has never signed in is
 * sent to /login, and every later visit signs itself back in from storage.
 *
 * The session record only holds a fingerprint of the credentials (never the
 * password itself), so changing the credentials invalidates old sessions.
 */

const SESSION_KEY = "udhar_admin_session_v1";
const REMEMBER_KEY = "udhar_admin_remember_v1";
const SESSION_DAYS = 30;

export const ADMIN_EMAIL = (
  process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "admin@kherwalbazaar.com"
)
  .trim()
  .toLowerCase();

export const ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "54557735";

export type AdminSession = {
  email: string;
  token: string;
  loginAt: number;
  expiresAt: number | null;
  remember: boolean;
};

export type RememberedCredentials = {
  identifier: string;
  password: string;
};

export type SignInResult = { ok: true } | { ok: false; error: string };

function hash(value: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 16777619) >>> 0;
    h2 = Math.imul(h2 + code, 2654435761) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}`;
}

function sessionToken(): string {
  return hash(`udhar-admin::${ADMIN_EMAIL}::${ADMIN_PASSWORD}::v1`);
}

function localStore(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function sessionStore(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readKey(store: Storage | null, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeKey(store: Storage | null, key: string, value: string) {
  try {
    store?.setItem(key, value);
  } catch {
    /* storage full or blocked: the session simply won't persist */
  }
}

function removeKey(store: Storage | null, key: string) {
  try {
    store?.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Removes the session from both storages, keeping remembered credentials. */
export function clearSession() {
  removeKey(localStore(), SESSION_KEY);
  removeKey(sessionStore(), SESSION_KEY);
}

function parseSession(raw: string | null): AdminSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AdminSession;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.token !== sessionToken()) return null;
    if (parsed.expiresAt !== null && parsed.expiresAt <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Returns the signed-in admin, or null when this device has no valid session. */
export function readSession(): AdminSession | null {
  const remembered = parseSession(readKey(localStore(), SESSION_KEY));
  if (remembered) return remembered;

  const current = parseSession(readKey(sessionStore(), SESSION_KEY));
  if (current) return current;

  // Nothing valid is left, so drop whatever stale record is still stored.
  clearSession();
  return null;
}

export function isSignedIn(): boolean {
  return readSession() !== null;
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function identifierMatches(value: string): boolean {
  const identifier = normalizeIdentifier(value);
  if (!identifier) return false;

  const email = normalizeIdentifier(ADMIN_EMAIL);
  const localPart = email.split("@")[0];

  return identifier === email || identifier === localPart;
}

export function signIn(
  identifier: string,
  password: string,
  remember: boolean
): SignInResult {
  const validPassword = password.trim() === ADMIN_PASSWORD;

  if (!identifierMatches(identifier) || !validPassword) {
    return {
      ok: false,
      error: "Wrong username or password. Please check and try again.",
    };
  }

  const loginAt = Date.now();
  const session: AdminSession = {
    email: ADMIN_EMAIL,
    token: sessionToken(),
    loginAt,
    expiresAt: remember ? loginAt + SESSION_DAYS * 24 * 60 * 60 * 1000 : null,
    remember,
  };

  clearSession();
  writeKey(
    remember ? localStore() : sessionStore(),
    SESSION_KEY,
    JSON.stringify(session)
  );

  if (remember) {
    const credentials: RememberedCredentials = {
      identifier: identifier.trim(),
      password: password.trim(),
    };
    writeKey(localStore(), REMEMBER_KEY, JSON.stringify(credentials));
  } else {
    removeKey(localStore(), REMEMBER_KEY);
  }

  return { ok: true };
}

/** Signs out on this device. Remembered credentials stay so login is one tap. */
export function signOut() {
  clearSession();
}

export function readRememberedCredentials(): RememberedCredentials | null {
  const raw = readKey(localStore(), REMEMBER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RememberedCredentials;
    if (!parsed?.identifier || !parsed?.password) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function forgetRememberedCredentials() {
  removeKey(localStore(), REMEMBER_KEY);
}

/** Only allow same-origin paths as a post-login destination. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/login")) return "/";
  return value;
}
