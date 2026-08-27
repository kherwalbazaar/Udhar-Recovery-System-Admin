import { get, onValue, ref as dbRef, type DatabaseReference, type DataSnapshot } from "firebase/database";
import { db } from "./firebase";

// Versioned cache prefix - bump to invalidate old caches
const PREFIX = "udhar_cache_v1_";
const TS_SUFFIX = "_ts";

export const CACHE_KEYS = {
  PRODUCTS: "products",
  SALES: "sales",
  CUSTOMERS: "customers",
  CASHBOOK: "cashbook",
  SUPPLIERS: "suppliers",
  REMINDERS: "reminders",
  // composite keys
  METRICS_SALES: "sales",
  METRICS_CUSTOMERS: "customers",
  METRICS_PRODUCTS: "products",
} as const;

function cacheKey(path: string) {
  return `${PREFIX}${path}`;
}
function tsKey(path: string) {
  return `${PREFIX}${path}${TS_SUFFIX}`;
}

export function readCache<T>(path: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(path));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // support both {data,ts} wrapper and raw value for backwards compat
    if (parsed && typeof parsed === "object" && "data" in parsed) {
      return parsed.data as T;
    }
    return parsed as T;
  } catch {
    return null;
  }
}

export function writeCache<T>(path: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(cacheKey(path), JSON.stringify({ data, ts: Date.now() }));
    // also dispatch event for listeners that show background update
    window.dispatchEvent(new CustomEvent("udhar:cache-update", { detail: { key: path } }));
  } catch {
    // quota exceeded - clear oldest
  }
}

export function clearCache(path?: string) {
  if (typeof window === "undefined") return;
  if (path) {
    localStorage.removeItem(cacheKey(path));
    localStorage.removeItem(tsKey(path));
  } else {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith(PREFIX)) localStorage.removeItem(k);
    });
  }
}

/**
 * Cached get: returns cached value instantly if present, fetches fresh in background
 * and updates cache. If no cache, does normal get and caches result.
 */
export async function getWithCache(
  dbRefPath: DatabaseReference,
  pathKey: string
): Promise<DataSnapshot> {
  if (typeof window !== "undefined") {
    const cached = readCache<any>(pathKey);
    if (cached !== null) {
      // background refresh - update cache when fresh arrives, don't block
      get(dbRefPath)
        .then((snap) => {
          writeCache(pathKey, snap.val());
        })
        .catch(() => {});
      // return fake snapshot with cached data for instant UI
      return {
        val: () => cached,
        exists: () => cached !== null,
      } as unknown as DataSnapshot;
    }
  }
  const snap = await get(dbRefPath);
  writeCache(pathKey, snap.val());
  return snap;
}

/**
 * Cached onValue: hydrates from localStorage instantly (stale-while-revalidate),
 * then subscribes to live Firebase updates and keeps cache fresh in background.
 * On refresh (Header icon / auto 10s), data is shown from cache instantly while
 * fresh data arrives via the live subscription.
 */
export function onValueWithCache(
  dbRefPath: DatabaseReference,
  pathKey: string,
  onData: (snap: DataSnapshot) => void,
  onError?: (error: Error) => void
): () => void {
  let hasEmittedCached = false;
  if (typeof window !== "undefined") {
    const cached = readCache<any>(pathKey);
    if (cached !== null) {
      // hydrate instantly from cache for fast render
      const fakeSnap = {
        val: () => cached,
        exists: () => cached !== null && cached !== undefined,
      } as unknown as DataSnapshot;
      // async to mimic onValue timing and avoid setState during render
      setTimeout(() => onData(fakeSnap), 0);
      hasEmittedCached = true;
    }
  }

  const unsub = onValue(
    dbRefPath,
    (snap) => {
      const val = snap.val();
      writeCache(pathKey, val);
      onData(snap);
    },
    onError
  );

  // If we emitted cached, we will get fresh via onValue shortly - background update
  // Listen to manual refresh events to force revalidation without hard reload
  if (typeof window !== "undefined") {
    const handler = () => {
      // trigger background get to refresh cache even if onValue hasn't fired
      get(dbRefPath)
        .then((snap) => {
          writeCache(pathKey, snap.val());
          onData(snap);
        })
        .catch(() => {});
    };
    window.addEventListener("udhar:refresh", handler);
    const origUnsub = unsub;
    return () => {
      window.removeEventListener("udhar:refresh", handler);
      origUnsub();
    };
  }

  return unsub;
}

/**
 * Trigger background refresh for all cached paths.
 * Called by Header refresh icon (manual + auto 10s).
 * Emits event that cached listeners use to fetch latest in background while
 * UI continues showing stale cache instantly.
 */
export function triggerBackgroundRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("udhar:refresh"));
}
