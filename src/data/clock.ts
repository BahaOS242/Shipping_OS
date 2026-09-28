/**
 * Clock. Services never call Date.now() directly, so the seed script can
 * replay realistic history (backdated) through the real business logic.
 */
let override: number | null = null;

export const now = () => override ?? Date.now();
export const nowIso = () => new Date(now()).toISOString();

export function atTime<T>(ts: number, fn: () => T): T {
  const prev = override;
  override = ts;
  try {
    return fn();
  } finally {
    override = prev;
  }
}

export const DAY = 86_400_000;
export const HOUR = 3_600_000;
