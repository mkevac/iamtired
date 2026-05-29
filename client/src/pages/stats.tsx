import { useMemo, useState } from "react";
import { useSessions } from "@/lib/api";
import {
  workedInRange,
  dailyBuckets,
  weeklyBuckets,
  formatDuration,
  todayStart,
  weekStart,
  monthStart,
} from "@/lib/time";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

function hoursLabel(ms: number) {
  const h = ms / 3600000;
  if (h >= 10) return `${Math.round(h)}h`;
  if (h >= 1) return `${h.toFixed(1)}h`;
  const m = Math.round(ms / 60000);
  return `${m}m`;
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-card-border bg-card p-4">
      <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1.5 text-xl font-bold tabular-nums ${accent ? "text-primary" : ""}`}
        data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {value}
      </p>
    </div>
  );
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{d.label}</p>
      <p className="text-muted-foreground">{formatDuration(d.total)}</p>
      {d.pomodoros > 0 && <p className="text-muted-foreground">{d.pomodoros} cycles</p>}
    </div>
  );
}

export default function StatsPage() {
  const { data: sessions, isLoading } = useSessions();
  const [view, setView] = useState<"daily" | "weekly">("daily");

  const all = sessions ?? [];

  const stats = useMemo(() => {
    const now = Date.now();
    const today = workedInRange(all, todayStart(), now);
    const week = workedInRange(all, weekStart(), now);
    const month = workedInRange(all, monthStart(), now);
    const days7 = dailyBuckets(all, 7);
    const activeDays = days7.filter((d) => d.total > 0).length;
    const avg = activeDays ? days7.reduce((a, d) => a + d.total, 0) / activeDays : 0;
    const totalCycles = all.reduce((a, s) => a + s.pomodoros, 0);
    return { today, week, month, avg, totalCycles };
  }, [all]);

  const chartData = useMemo(
    () => (view === "daily" ? dailyBuckets(all, 7) : weeklyBuckets(all, 8)),
    [all, view]
  );

  const maxVal = Math.max(1, ...chartData.map((d) => d.total));
  const todayKey = todayStart();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold tracking-tight">Stats</h1>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Today" value={hoursLabel(stats.today)} accent />
        <StatCard label="This week" value={hoursLabel(stats.week)} />
        <StatCard label="This month" value={hoursLabel(stats.month)} />
        <StatCard label="Daily avg" value={hoursLabel(stats.avg)} />
      </div>

      <div className="mt-3">
        <StatCard label="Total focus cycles" value={String(stats.totalCycles)} />
      </div>

      {/* Chart */}
      <div className="mt-7 rounded-lg border border-card-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {view === "daily" ? "Last 7 days" : "Last 8 weeks"}
          </h2>
          <div className="inline-flex rounded-md border border-border p-0.5">
            {(["daily", "weekly"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                data-testid={`button-view-${v}`}
                className={`rounded px-3 py-1 text-[13px] font-medium capitalize transition-colors ${
                  view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {chartData.every((d) => d.total === 0) ? (
          <div className="grid h-56 place-items-center text-center">
            <p className="text-[13px] text-muted-foreground">
              No tracked time yet.
              <br />
              Start a session to see your trend.
            </p>
          </div>
        ) : (
          <div className="h-56" data-testid="chart-trend">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                <XAxis
                  dataKey="shortLabel"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v / 3600000)}h`}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {chartData.map((d) => (
                    <Cell
                      key={d.key}
                      fill={
                        view === "daily" && d.key === todayKey
                          ? "hsl(var(--break))"
                          : "hsl(var(--primary))"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {view === "daily" && !chartData.every((d) => d.total === 0) && (
          <p className="mt-2 text-center text-[12px] text-muted-foreground">
            <span className="inline-block size-2 rounded-full bg-break align-middle" /> Today
            <span className="ml-3 inline-block size-2 rounded-full bg-primary align-middle" /> Previous days
          </p>
        )}
      </div>
    </div>
  );
}
