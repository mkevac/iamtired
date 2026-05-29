// Plain type definitions shared by the client. The app is now a static,
// browser-only PWA (IndexedDB persistence in client/src/lib/db.ts), so there
// is no database/ORM layer here anymore.

// A work session. start/end are unix epoch milliseconds.
// `tag` reserved for future project/tag tracking (nullable, unused in UI for now).
export interface Session {
  id: number;
  start: number;
  end: number | null; // null while a session is running
  pomodoros: number; // completed focus cycles during this session
  tag: string | null;
}

// Fields accepted when creating/updating a session (id is assigned by the store).
export interface InsertSession {
  start: number;
  end?: number | null;
  pomodoros?: number;
  tag?: string | null;
}

// mode: "enforced" shows a break banner; "nudge" only notifies and keeps the clock running.
export type PomodoroMode = "nudge" | "enforced";

export interface Settings {
  id: number;
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
  mode: PomodoroMode;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  notificationsEnabled: boolean;
}

export type UpdateSettings = Partial<Omit<Settings, "id">>;
