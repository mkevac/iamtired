import { useEffect, useMemo, useState } from "react";
import { Play, Square, Settings as SettingsIcon, Coffee, Brain } from "lucide-react";
import {
  useRunningSession,
  useStartSession,
  useStopSession,
  useUpdateSession,
  useSettings,
} from "@/lib/api";
import { usePomodoro } from "@/lib/usePomodoro";
import { formatClock } from "@/lib/time";
import { ensureNotificationPermission, primeAudio } from "@/lib/nudge";
import { useToast } from "@/hooks/use-toast";
import SettingsSheet from "@/components/settings-sheet";

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

const PHASE_LABEL: Record<string, string> = { focus: "Focus", break: "Break", longBreak: "Long break" };

export default function TimerPage() {
  const { data: running, isLoading } = useRunningSession();
  const { data: settings } = useSettings();
  const start = useStartSession();
  const stop = useStopSession();
  const updateSession = useUpdateSession();
  const { toast } = useToast();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isRunning = !!running;
  const now = useNow(isRunning);
  const elapsedMs = isRunning && running ? now - running.start : null;

  const pomo = usePomodoro({
    elapsedMs,
    settings,
    baselinePomodoros: 0,
  });

  // Persist completed pomodoro count to the running session as it grows.
  useEffect(() => {
    if (running && pomo.completedPomodoros !== running.pomodoros) {
      updateSession.mutate({ id: running.id, data: { pomodoros: pomo.completedPomodoros } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pomo.completedPomodoros]);

  const handleStart = async () => {
    primeAudio();
    await ensureNotificationPermission();
    start.mutate();
  };

  const handleStop = () => {
    stop.mutate(pomo.completedPomodoros, {
      onSuccess: () =>
        toast({ title: "Session saved", description: "Your work session is in History." }),
    });
  };

  const onBreak = pomo.phase === "break" || pomo.phase === "longBreak";
  const enforced = settings?.mode === "enforced";

  // Ring progress for the current pomodoro phase.
  const ringPct = useMemo(() => {
    if (!pomo.phaseDurationMs) return 0;
    return 1 - pomo.phaseRemainingMs / pomo.phaseDurationMs;
  }, [pomo.phaseRemainingMs, pomo.phaseDurationMs]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-6 pt-10">
        <div className="size-72 rounded-full bg-muted animate-pulse" />
        <div className="h-12 w-48 rounded-full bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Status pill */}
      <div className="mt-2 mb-6 flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ${
            !isRunning
              ? "bg-muted text-muted-foreground"
              : onBreak
                ? "bg-break/15 text-break"
                : "bg-primary/15 text-primary"
          }`}
          data-testid="status-phase"
        >
          {!isRunning ? (
            "Not tracking"
          ) : onBreak ? (
            <>
              <Coffee className="size-3.5" /> {PHASE_LABEL[pomo.phase]}
            </>
          ) : (
            <>
              <Brain className="size-3.5" /> {PHASE_LABEL[pomo.phase]}
            </>
          )}
        </span>
        <button
          onClick={() => setSettingsOpen(true)}
          data-testid="button-open-settings"
          aria-label="Pomodoro settings"
          className="size-8 grid place-items-center rounded-md text-muted-foreground hover-elevate"
        >
          <SettingsIcon className="size-[18px]" />
        </button>
      </div>

      {/* Timer ring */}
      <ProgressRing
        pct={isRunning ? ringPct : 0}
        color={onBreak ? "hsl(var(--break))" : "hsl(var(--primary))"}
      >
        <div className="flex flex-col items-center">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
            {isRunning ? "Worked" : "Ready"}
          </span>
          <span
            className="font-mono font-semibold tabular-nums leading-none text-[clamp(2.4rem,12vw,3.4rem)]"
            data-testid="text-elapsed"
          >
            {formatClock(elapsedMs ?? 0)}
          </span>
          {isRunning && (
            <span className="mt-3 text-[13px] text-muted-foreground" data-testid="text-phase-countdown">
              {onBreak ? "Rest for" : "Focus for"}{" "}
              <span className={`font-semibold ${onBreak ? "text-break" : "text-primary"}`}>
                {formatClock(pomo.phaseRemainingMs)}
              </span>
            </span>
          )}
        </div>
      </ProgressRing>

      {/* Cycle dots */}
      {isRunning && settings && (
        <div className="mt-5 flex items-center gap-2" data-testid="cycle-dots">
          {Array.from({ length: settings.longBreakEvery }).map((_, i) => {
            const doneInGroup = pomo.completedPomodoros % settings.longBreakEvery;
            return (
              <span
                key={i}
                className={`size-2.5 rounded-full transition-colors ${
                  i < doneInGroup ? "bg-primary" : "bg-muted"
                }`}
              />
            );
          })}
          <span className="ml-2 text-[12px] text-muted-foreground">
            {pomo.completedPomodoros} {pomo.completedPomodoros === 1 ? "cycle" : "cycles"} this session
          </span>
        </div>
      )}

      {/* Enforced-mode break banner */}
      {isRunning && enforced && onBreak && (
        <div className="mt-6 w-full rounded-lg border border-break/30 bg-break/10 p-4 text-center">
          <p className="text-sm font-medium text-break">Break time — step away from the screen.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Your work clock keeps running. The timer will nudge you when the break ends.
          </p>
        </div>
      )}

      {/* Primary action */}
      <div className="mt-9">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={start.isPending}
            data-testid="button-start"
            className="inline-flex items-center gap-2.5 rounded-full bg-primary px-9 py-4 text-primary-foreground text-base font-semibold shadow-lg hover-elevate active-elevate-2 disabled:opacity-60"
          >
            <Play className="size-5 fill-current" /> Start working
          </button>
        ) : (
          <button
            onClick={handleStop}
            disabled={stop.isPending}
            data-testid="button-stop"
            className="inline-flex items-center gap-2.5 rounded-full bg-destructive px-9 py-4 text-destructive-foreground text-base font-semibold shadow-lg hover-elevate active-elevate-2 disabled:opacity-60"
          >
            <Square className="size-5 fill-current" /> Stop working
          </button>
        )}
      </div>

      {!isRunning && (
        <p className="mt-5 max-w-xs text-center text-[13px] text-muted-foreground">
          Tap start when you begin a work block. FocusTrack will nudge you to rest on your{" "}
          {settings?.workMinutes ?? 25}/{settings?.breakMinutes ?? 5} Pomodoro rhythm.
        </p>
      )}

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

function ProgressRing({
  pct,
  color,
  children,
}: {
  pct: number;
  color: string;
  children: React.ReactNode;
}) {
  const size = 280;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, pct));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1), stroke 0.3s" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
