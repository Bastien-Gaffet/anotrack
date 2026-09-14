import { TRPCError } from "@trpc/server";

// Verrou anti-brute-force en mémoire, par clé logique (ex. "secret:42",
// "admin"). Indépendant de l'IP : bloque une cible précise même si
// l'attaquant change d'adresse ou répartit ses tentatives.

interface Bucket {
  failures: number;
  windowStart: number;
  lockedUntil?: number;
}

const WINDOW_MS = 10 * 60 * 1000; // fenêtre de comptage des échecs
const LOCK_MS = 15 * 60 * 1000; // durée du verrou une fois le seuil atteint
const MAX_FAILURES = 6;

const buckets = new Map<string, Bucket>();

// Purge périodique pour ne pas accumuler indéfiniment des entrées mortes.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, b] of buckets) {
      const stale = (!b.lockedUntil || b.lockedUntil < now) && now - b.windowStart > WINDOW_MS;
      if (stale) buckets.delete(key);
    }
  },
  10 * 60 * 1000,
).unref();

export function assertNotLocked(key: string) {
  const b = buckets.get(key);
  if (!b?.lockedUntil) return;
  const now = Date.now();
  if (b.lockedUntil > now) {
    const minutes = Math.ceil((b.lockedUntil - now) / 60000);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Trop de tentatives. Réessaie dans ${minutes} min.`,
    });
  }
}

export function recordFailure(key: string) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.windowStart > WINDOW_MS) {
    b = { failures: 0, windowStart: now };
  }
  b.failures++;
  if (b.failures >= MAX_FAILURES) {
    b.lockedUntil = now + LOCK_MS;
  }
  buckets.set(key, b);
}

export function recordSuccess(key: string) {
  buckets.delete(key);
}
