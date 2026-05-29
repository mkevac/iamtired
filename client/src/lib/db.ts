import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Session, Settings, InsertSession, UpdateSettings } from "@shared/schema";

// IndexedDB-backed store. Replaces the old SQLite/Express backend so the app
// runs as a pure static site with per-device, offline-capable persistence.

interface IamTiredDB extends DBSchema {
  sessions: {
    key: number;
    value: Session;
    indexes: { "by-start": number };
  };
  settings: {
    key: number;
    value: Settings;
  };
}

const DB_NAME = "iamtired";
const DB_VERSION = 1;

export const DEFAULT_SETTINGS: Omit<Settings, "id"> = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  mode: "nudge",
  soundEnabled: true,
  vibrationEnabled: true,
  notificationsEnabled: true,
};

let dbPromise: Promise<IDBPDatabase<IamTiredDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<IamTiredDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("sessions")) {
          const store = db.createObjectStore("sessions", {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("by-start", "start");
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

// --- Sessions ---

// Newest first, matching the previous API ordering.
export async function getSessions(): Promise<Session[]> {
  const db = await getDB();
  const all = await db.getAll("sessions");
  return all.sort((a, b) => b.start - a.start);
}

export async function getRunningSession(): Promise<Session | null> {
  const db = await getDB();
  const all = await db.getAll("sessions");
  const running = all.filter((s) => s.end == null).sort((a, b) => b.start - a.start);
  return running[0] ?? null;
}

export async function createSession(data: InsertSession): Promise<Session> {
  validateSession(data.start, data.end ?? null);
  const db = await getDB();
  const record = {
    start: data.start,
    end: data.end ?? null,
    pomodoros: data.pomodoros ?? 0,
    tag: data.tag ?? null,
  } as Omit<Session, "id">;
  const id = await db.add("sessions", record as Session);
  return { ...(record as Session), id: id as number };
}

export async function startSession(): Promise<Session> {
  const existing = await getRunningSession();
  if (existing) return existing; // already running; idempotent like before
  return createSession({ start: Date.now(), end: null, pomodoros: 0, tag: null });
}

export async function stopSession(pomodoros: number): Promise<Session | null> {
  const running = await getRunningSession();
  if (!running) return null;
  return updateSession(running.id, { end: Date.now(), pomodoros });
}

export async function updateSession(
  id: number,
  data: Partial<InsertSession>,
): Promise<Session> {
  const db = await getDB();
  const existing = await db.get("sessions", id);
  if (!existing) throw new Error(`Session ${id} not found`);
  const merged: Session = {
    ...existing,
    ...("start" in data && data.start != null ? { start: data.start } : {}),
    ...("end" in data ? { end: data.end ?? null } : {}),
    ...("pomodoros" in data && data.pomodoros != null ? { pomodoros: data.pomodoros } : {}),
    ...("tag" in data ? { tag: data.tag ?? null } : {}),
  };
  validateSession(merged.start, merged.end);
  await db.put("sessions", merged);
  return merged;
}

export async function deleteSession(id: number): Promise<{ ok: true }> {
  const db = await getDB();
  await db.delete("sessions", id);
  return { ok: true };
}

function validateSession(start: number, end: number | null) {
  if (end != null && end <= start) {
    throw new Error("End time must be after start time");
  }
}

// --- Settings (single row, id = 1) ---

export async function getSettings(): Promise<Settings> {
  const db = await getDB();
  const existing = await db.get("settings", 1);
  if (existing) return existing;
  const seeded: Settings = { id: 1, ...DEFAULT_SETTINGS };
  await db.put("settings", seeded);
  return seeded;
}

export async function updateSettings(data: UpdateSettings): Promise<Settings> {
  const db = await getDB();
  const current = await getSettings();
  const merged: Settings = { ...current, ...data, id: 1 };
  await db.put("settings", merged);
  return merged;
}

// --- Backup / restore (JSON export & import) ---

export interface BackupBundle {
  app: "iamtired";
  version: number;
  exportedAt: number;
  sessions: Session[];
  settings: Omit<Settings, "id">;
}

export async function exportData(): Promise<BackupBundle> {
  const [sessions, settings] = await Promise.all([getSessions(), getSettings()]);
  const { id: _omit, ...settingsNoId } = settings;
  return {
    app: "iamtired",
    version: DB_VERSION,
    exportedAt: Date.now(),
    sessions,
    settings: settingsNoId,
  };
}

export interface ImportResult {
  sessionsImported: number;
}

// Replaces all local data with the contents of the bundle.
export async function importData(bundle: BackupBundle): Promise<ImportResult> {
  if (!bundle || bundle.app !== "iamtired" || !Array.isArray(bundle.sessions)) {
    throw new Error("This file is not an iamtired backup.");
  }
  const db = await getDB();
  const tx = db.transaction(["sessions", "settings"], "readwrite");
  await tx.objectStore("sessions").clear();
  for (const s of bundle.sessions) {
    if (typeof s.start !== "number") continue;
    const record = {
      start: s.start,
      end: s.end ?? null,
      pomodoros: s.pomodoros ?? 0,
      tag: s.tag ?? null,
    };
    // Preserve original id when present and valid, else let it autoincrement.
    if (typeof s.id === "number" && Number.isFinite(s.id)) {
      await tx.objectStore("sessions").put({ ...record, id: s.id } as Session);
    } else {
      await tx.objectStore("sessions").add(record as Session);
    }
  }
  if (bundle.settings && typeof bundle.settings === "object") {
    await tx
      .objectStore("settings")
      .put({ ...DEFAULT_SETTINGS, ...bundle.settings, id: 1 } as Settings);
  }
  await tx.done;
  return { sessionsImported: bundle.sessions.length };
}
