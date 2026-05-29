import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSettings, useUpdateSettings, useExportData, useImportData } from "@/lib/api";
import type { Settings } from "@shared/schema";
import { Brain, Coffee, Repeat, Bell, Volume2, Vibrate, Download, Upload } from "lucide-react";
import { ensureNotificationPermission } from "@/lib/nudge";
import { useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import type { BackupBundle } from "@/lib/db";

function Stepper({
  label,
  icon,
  value,
  min,
  max,
  unit,
  onChange,
  testId,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-2.5">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          data-testid={`button-dec-${testId}`}
          className="size-8 grid place-items-center rounded-md border border-border hover-elevate text-base font-semibold"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <span className="w-16 text-center text-sm font-semibold tabular-nums" data-testid={`value-${testId}`}>
          {value} {unit}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          data-testid={`button-inc-${testId}`}
          className="size-8 grid place-items-center rounded-md border border-border hover-elevate text-base font-semibold"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  icon,
  checked,
  onChange,
  testId,
}: {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <Label htmlFor={testId} className="flex items-center gap-2.5 cursor-pointer">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </Label>
      <Switch id={testId} checked={checked} onCheckedChange={onChange} data-testid={`switch-${testId}`} />
    </div>
  );
}

export default function SettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const exportData = useExportData();
  const importData = useImportData();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patch = (data: Partial<Settings>) => update.mutate(data);

  const handleExport = async () => {
    try {
      const bundle = await exportData.mutateAsync();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `focustrack-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Backup exported", description: `${bundle.sessions.length} sessions saved.` });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const bundle = JSON.parse(text) as BackupBundle;
      const res = await importData.mutateAsync(bundle);
      toast({
        title: "Backup restored",
        description: `${res.sessionsImported} sessions imported. Existing data was replaced.`,
      });
    } catch (e) {
      toast({
        title: "Import failed",
        description: e instanceof Error ? e.message : "Could not read that file.",
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-xl">
        <div className="mx-auto w-full max-w-2xl">
          <SheetHeader className="text-left">
            <SheetTitle>Pomodoro settings</SheetTitle>
            <SheetDescription>Tune your focus rhythm and how FocusTrack nudges you.</SheetDescription>
          </SheetHeader>

          {!settings ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="mt-2 divide-y divide-border">
              {/* Mode */}
              <div className="py-4">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Break behavior
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(["nudge", "enforced"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => patch({ mode: m })}
                      data-testid={`button-mode-${m}`}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        settings.mode === m
                          ? "border-primary bg-primary/10"
                          : "border-border hover-elevate"
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        {m === "nudge" ? "Nudge only" : "Enforced"}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-muted-foreground leading-snug">
                        {m === "nudge"
                          ? "Suggests breaks; clock keeps running."
                          : "Shows a break banner when it's time to rest."}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Durations */}
              <div className="py-2">
                <Stepper
                  label="Focus length"
                  icon={<Brain className="size-[18px]" />}
                  value={settings.workMinutes}
                  min={1}
                  max={120}
                  unit="min"
                  onChange={(v) => patch({ workMinutes: v })}
                  testId="work"
                />
                <Stepper
                  label="Short break"
                  icon={<Coffee className="size-[18px]" />}
                  value={settings.breakMinutes}
                  min={1}
                  max={60}
                  unit="min"
                  onChange={(v) => patch({ breakMinutes: v })}
                  testId="break"
                />
                <Stepper
                  label="Long break"
                  icon={<Coffee className="size-[18px]" />}
                  value={settings.longBreakMinutes}
                  min={1}
                  max={90}
                  unit="min"
                  onChange={(v) => patch({ longBreakMinutes: v })}
                  testId="longbreak"
                />
                <Stepper
                  label="Long break every"
                  icon={<Repeat className="size-[18px]" />}
                  value={settings.longBreakEvery}
                  min={2}
                  max={8}
                  unit="cycles"
                  onChange={(v) => patch({ longBreakEvery: v })}
                  testId="every"
                />
              </div>

              {/* Nudge prefs */}
              <div className="py-2">
                <Toggle
                  label="Notifications"
                  icon={<Bell className="size-[18px]" />}
                  checked={settings.notificationsEnabled}
                  onChange={async (v) => {
                    if (v) await ensureNotificationPermission();
                    patch({ notificationsEnabled: v });
                  }}
                  testId="notifications"
                />
                <Toggle
                  label="Sound"
                  icon={<Volume2 className="size-[18px]" />}
                  checked={settings.soundEnabled}
                  onChange={(v) => patch({ soundEnabled: v })}
                  testId="sound"
                />
                <Toggle
                  label="Vibration"
                  icon={<Vibrate className="size-[18px]" />}
                  checked={settings.vibrationEnabled}
                  onChange={(v) => patch({ vibrationEnabled: v })}
                  testId="vibration"
                />
              </div>

              {/* Backup & restore */}
              <div className="py-4">
                <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Backup &amp; restore
                </p>
                <p className="mb-3 text-[12px] text-muted-foreground leading-snug">
                  Your data is stored on this device. Export a backup file to move it to another
                  device or keep it safe. Importing replaces all data on this device.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleExport}
                    disabled={exportData.isPending}
                    data-testid="button-export"
                    className="flex items-center justify-center gap-2 rounded-lg border border-border p-3 text-sm font-medium hover-elevate disabled:opacity-50"
                  >
                    <Download className="size-[18px]" />
                    Export
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importData.isPending}
                    data-testid="button-import"
                    className="flex items-center justify-center gap-2 rounded-lg border border-border p-3 text-sm font-medium hover-elevate disabled:opacity-50"
                  >
                    <Upload className="size-[18px]" />
                    Import
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  data-testid="input-import-file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportFile(file);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
