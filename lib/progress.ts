/**
 * lib/progress.ts
 *
 * Local-only progress engine (Milestone 3). All state lives in the browser's
 * localStorage on the student's device — no login, no server. Ported from the
 * prototype's progress system (streaks, weekly goals, per-unit mastery).
 *
 * Pure helpers + load/save here; session tracking + React wiring live in
 * app/page.tsx. Safe to import in client code only (touches localStorage).
 */

const PROGRESS_KEY = "socratic_progress_v1";

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

export function loadProgress(): Progress {
  if (typeof window === "undefined") return defaultProgress();
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      // Merge over defaults so older/partial saves don't crash newer fields.
      const parsed = JSON.parse(raw) as Partial<Progress>;
      return { ...defaultProgress(), ...parsed };
    }
  } catch {
    /* corrupt or unavailable storage — fall back to a fresh slate */
  }
  return defaultProgress();
}

export function saveProgress(p: Progress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* storage full or blocked — progress just won't persist this session */
  }
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

/** Mastery heuristic (0-100): rewards attempts + solves, lightly penalizes hint reliance. */
export function computeMastery(stats: UnitStats): number {
  let score = 0;
  score += Math.min(stats.problemsAttempted * 8, 60);
  score += Math.min(stats.problemsSolved * 6, 30);
  score -= Math.min(stats.hintsUsed * 1, 15);
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Human-friendly "last visited" label. */
export function relativeTime(ts: number): string {
  const days = daysBetween(ts, Date.now());
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
