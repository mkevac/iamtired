import type { Session } from "@shared/schema";

// Duration of a session in ms; uses `now` for a running (open) session.
export function sessionDuration(s: Session, now: number = Date.now()): number {
  return (s.end ?? now) - s.start;
}

// "1h 23m 45s" style. For the big live clock.
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

// Compact human duration: "2h 15m", "45m", "30s"
export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

// "Mon, May 26" / "Today" / "Yesterday"
export function formatDayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yest)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

// Convert epoch ms to a value usable by <input type="datetime-local"> (local tz).
export function toLocalInputValue(ts: number): string {
  const d = new Date(ts);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(ts - off).toISOString().slice(0, 16);
}

// Parse a datetime-local string back to epoch ms.
export function fromLocalInputValue(v: string): number {
  return new Date(v).getTime();
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek(ts: number): number {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface DayBucket {
  key: number; // start-of-day epoch
  label: string;
  shortLabel: string;
  total: number; // ms worked
  pomodoros: number;
}

// Total worked ms across all completed sessions.
export function totalWorked(sessions: Session[]): number {
  return sessions.reduce((acc, s) => acc + (s.end ? sessionDuration(s) : 0), 0);
}

// Worked ms within a [from, to) window, clipping sessions that straddle the boundary.
export function workedInRange(sessions: Session[], from: number, to: number): number {
  return sessions.reduce((acc, s) => {
    const end = s.end ?? Date.now();
    const lo = Math.max(s.start, from);
    const hi = Math.min(end, to);
    return acc + Math.max(0, hi - lo);
  }, 0);
}

// Build the last `days` daily buckets (oldest first).
export function dailyBuckets(sessions: Session[], days: number): DayBucket[] {
  const today0 = startOfDay(Date.now());
  const out: DayBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = today0 - i * 86400000;
    const next = key + 86400000;
    const d = new Date(key);
    out.push({
      key,
      label: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
      shortLabel: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2),
      total: workedInRange(sessions, key, next),
      pomodoros: sessions.filter((s) => s.start >= key && s.start < next).reduce((a, s) => a + s.pomodoros, 0),
    });
  }
  return out;
}

// Build the last `weeks` weekly buckets (oldest first), Monday-based.
export function weeklyBuckets(sessions: Session[], weeks: number): DayBucket[] {
  const thisWeek0 = startOfWeek(Date.now());
  const out: DayBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const key = thisWeek0 - i * 7 * 86400000;
    const next = key + 7 * 86400000;
    const d = new Date(key);
    out.push({
      key,
      label: `Week of ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
      shortLabel: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      total: workedInRange(sessions, key, next),
      pomodoros: sessions.filter((s) => s.start >= key && s.start < next).reduce((a, s) => a + s.pomodoros, 0),
    });
  }
  return out;
}

export const todayStart = () => startOfDay(Date.now());
export const weekStart = () => startOfWeek(Date.now());
export function monthStart(): number {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
