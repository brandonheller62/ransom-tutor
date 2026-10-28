/**
 * lib/progress.ts
 *
 * Progress engine (Milestone 3): streaks, weekly goals, per-unit mastery,
 * ported from the prototype. The student's account is the source of truth
 * (the `progress` table, synced by app/page.tsx via lib/cloud.ts); localStorage
 * keeps a per-account copy so the screen fills instantly and nothing is lost
 * if a sync doesn't finish before the tab closes. `updatedAt` decides which
 * copy is newer.
 *
 * Pure helpers + load/save here; session tracking + React wiring live in
 * app/page.tsx. Safe to import in client code only (touches localStorage).
 */

// Before accounts, progress lived under this one key per browser. The first
// account to sign in on a device inherits it (takeLegacyProgress).
const LEGACY_KEY = "socratic_progress_v1";
const progressKey = (userId: string) => `${LEGACY_KEY}:${userId}`;

export interface UnitStats {
  problemsAttempted: number;
  problemsSolved: number;
  hintsUsed: number;
  lastVisited: number | null; // epoch ms
  masteryScore: number; // 0-100
}

export interface Progress {
  streak: {
    lastStudyDate: string | null; // todayKey() string
    currentStreak: number;
    longestStreak: number;
  };
  weeklyGoal: {
    target: number;
    weekStart: number; // epoch ms of Monday 00:00
    sessionsThisWeek: number;
  };
  units: Record<string, UnitStats>; // key = `${courseKey}_${unitId}`
  totalProblems: number;
  updatedAt?: number; // epoch ms of the last change; absent on pre-account saves
}

export function defaultProgress(): Progress {
  return {
    streak: { lastStudyDate: null, currentStreak: 0, longestStreak: 0 },
    weeklyGoal: { target: 3, weekStart: getWeekStart(), sessionsThisWeek: 0 },
    units: {},
    totalProblems: 0,
  };
}

export function defaultUnitStats(): UnitStats {
  return {
    problemsAttempted: 0,
    problemsSolved: 0,
    hintsUsed: 0,
    lastVisited: null,
    masteryScore: 0,
  };
}

/** Merge over defaults so older/partial saves don't crash newer fields. */
export function normalizeProgress(raw: unknown): Progress {
  return { ...defaultProgress(), ...(raw as Partial<Progress>) };
}

function readKey(key: string): Progress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return normalizeProgress(JSON.parse(raw));
  } catch {
    /* corrupt or unavailable storage: treat as missing */
  }
  return null;
}

/** This account's copy on this device, or null if there isn't one. */
export function loadProgress(userId: string): Progress | null {
  return readKey(progressKey(userId));
}

export function saveProgress(p: Progress, userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(progressKey(userId), JSON.stringify(p));
  } catch {
    /* storage full or blocked: the account copy still syncs */
  }
}

/** Forget this account's copy on this device (after the account is deleted). */
export function clearProgress(userId: string): void {
  try {
    window.localStorage.removeItem(progressKey(userId));
  } catch {
    /* ignore */
  }
}

/** Pre-account progress on this device, removed once read so only one account inherits it. */
export function takeLegacyProgress(): Progress | null {
  const p = readKey(LEGACY_KEY);
  if (p) {
    try {
      window.localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* ignore */
    }
  }
  return p;
}

/** Epoch ms of the most recent Monday at 00:00 (local time). */
export function getWeekStart(): number {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // make Monday the week start
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Zero out the weekly session count if we've rolled into a new week. Mutates in place. */
export function rollWeekIfNeeded(p: Progress): void {
  const ws = getWeekStart();
  if (p.weeklyGoal.weekStart !== ws) {
    p.weeklyGoal.weekStart = ws;
    p.weeklyGoal.sessionsThisWeek = 0;
  }
}

/** Current epoch ms. Wrapped so progress code can read the clock from event
 *  handlers without tripping the react-hooks "no impure calls in render" rule. */
export function nowMs(): number {
  return Date.now();
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Parse a value to local midnight. Handles both epoch-ms numbers and our
 *  todayKey() strings ("2026-6-1"). The string branch splits manually and uses
 *  the numeric Date constructor: parsing unpadded "Y-M-D" via `new Date(string)`
 *  is engine-specific and returns Invalid Date in Safari, which would break the
 *  streak gap. The numeric constructor is reliable everywhere. */
function toLocalMidnight(v: number | string): Date {
  let d: Date;
  if (typeof v === "string") {
    const [y, m, day] = v.split("-").map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(v);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysBetween(a: number | string, b: number | string): number {
  const ms = 1000 * 60 * 60 * 24;
  return Math.round(
    (toLocalMidnight(b).getTime() - toLocalMidnight(a).getTime()) / ms,
  );
}

export function unitKey(courseKey: string, unitId: string): string {
  return `${courseKey}_${unitId}`;
}

export function getUnitStats(p: Progress, courseKey: string, unitId: string): UnitStats {
  return p.units[unitKey(courseKey, unitId)] ?? defaultUnitStats();
}

/**
 * Mastery heuristic (0-100): rewards problems worked through, and solving them
 * counts most. Hints never cost anything: asking for one is the behavior the
 * tutor exists to teach. A revealed answer is recorded as attempted but not
 * solved, so it earns the attempt credit only. Never decreases.
 */
export function computeMastery(stats: UnitStats): number {
  let score = 0;
  score += Math.min(stats.problemsAttempted * 8, 60);
  score += Math.min(stats.problemsSolved * 6, 40);
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** One-line explanation of mastery, shown wherever the number is. */
export const MASTERY_EXPLAINER =
  "Mastery grows with every problem you work through in a unit, and most when you solve it yourself. Hints never lower it.";

/** Human-friendly "last visited" label. */
export function relativeTime(ts: number): string {
  const days = daysBetween(ts, Date.now());
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
