import { useEffect, useRef, useState, useCallback } from "react";
import type { Settings } from "@shared/schema";
import { showNotification, vibrate, playChime } from "@/lib/nudge";

export type Phase = "focus" | "break" | "longBreak";

export interface PomodoroState {
  phase: Phase;
  phaseRemainingMs: number; // time left in current phase
  phaseDurationMs: number;
  completedPomodoros: number; // focus cycles completed this session
  cycleInPhase: number; // 1-based index of current focus block in the long-break group
}

interface Args {
  // ms the work clock has been running (live, increases each tick). null when stopped.
  elapsedMs: number | null;
  settings: Settings | undefined;
  baselinePomodoros: number; // pomodoros already attributed to the session at mount
}

/**
 * Derives the Pomodoro phase from total elapsed focus+break time.
 * Pattern: focus → break → focus → break → ... → (every Nth) longBreak.
 * Nudges fire at each phase boundary. In "nudge" mode the work clock keeps
 * running through breaks; in "enforced" mode the UI surfaces a break screen,
 * but the underlying schedule is identical.
 */
export function usePomodoro({ elapsedMs, settings, baselinePomodoros }: Args): PomodoroState {
  const [, force] = useState(0);
  const lastBoundary = useRef<string>(""); // dedupe nudges
  const tickRef = useRef<number | null>(null);

  // Re-render on a 1s cadence while running so the countdown updates.
  useEffect(() => {
    if (elapsedMs == null) return;
    tickRef.current = window.setInterval(() => force((n) => n + 1), 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [elapsedMs]);

  const fireNudge = useCallback(
    (next: Phase, key: string) => {
      if (!settings) return;
      if (lastBoundary.current === key) return;
      lastBoundary.current = key;
      const onBreak = next === "break" || next === "longBreak";
      if (settings.notificationsEnabled) {
        showNotification(
          onBreak ? "Time for a break" : "Back to work",
          onBreak
            ? next === "longBreak"
              ? `Nice work. Take a longer ${settings.longBreakMinutes}-minute break.`
              : `Step away for ${settings.breakMinutes} minutes and recharge.`
            : "Break's over — let's get focused again."
        );
      }
      if (settings.vibrationEnabled) vibrate(onBreak ? [200, 100, 200] : [120]);
      if (settings.soundEnabled) playChime(onBreak);
    },
    [settings]
  );

  if (!settings || elapsedMs == null) {
    return {
      phase: "focus",
      phaseRemainingMs: (settings?.workMinutes ?? 25) * 60000,
      phaseDurationMs: (settings?.workMinutes ?? 25) * 60000,
      completedPomodoros: baselinePomodoros,
      cycleInPhase: 1,
    };
  }

  const work = settings.workMinutes * 60000;
  const brk = settings.breakMinutes * 60000;
  const longBrk = settings.longBreakMinutes * 60000;
  const every = Math.max(1, settings.longBreakEvery);

  // Walk the schedule until we consume `elapsedMs`.
  let remaining = elapsedMs;
  let completed = 0; // focus blocks fully completed
  let phase: Phase = "focus";
  let phaseDur = work;
  let boundaryKey = "start";

  // Safety cap to avoid pathological loops on huge elapsed values.
  for (let guard = 0; guard < 10000; guard++) {
    if (phase === "focus") {
      if (remaining < work) {
        phaseDur = work;
        break;
      }
      remaining -= work;
      completed += 1;
      const isLong = completed % every === 0;
      phase = isLong ? "longBreak" : "break";
      phaseDur = isLong ? longBrk : brk;
      boundaryKey = `${completed}-${phase}`;
    } else {
      const dur = phase === "longBreak" ? longBrk : brk;
      if (remaining < dur) {
        phaseDur = dur;
        break;
      }
      remaining -= dur;
      phase = "focus";
      phaseDur = work;
      boundaryKey = `${completed}-focus`;
    }
  }

  // Fire a nudge once when we cross into a new phase.
  // boundaryKey "start" never nudges.
  if (boundaryKey !== "start") fireNudge(phase, boundaryKey);

  const cycleInPhase = (completed % every) + (phase === "focus" ? 1 : 0);

  return {
    phase,
    phaseRemainingMs: Math.max(0, phaseDur - remaining),
    phaseDurationMs: phaseDur,
    completedPomodoros: baselinePomodoros + completed,
    cycleInPhase: Math.min(every, Math.max(1, cycleInPhase || 1)),
  };
}
