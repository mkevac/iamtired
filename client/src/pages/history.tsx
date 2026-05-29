import { useMemo, useState } from "react";
import { useSessions, useDeleteSession, useUpdateSession, useAddSession } from "@/lib/api";
import type { Session } from "@shared/schema";
import {
  sessionDuration,
  formatDuration,
  formatDayLabel,
  formatTime,
  toLocalInputValue,
  fromLocalInputValue,
} from "@/lib/time";
import { Pencil, Trash2, Plus, Clock, Coffee } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface DayGroup {
  key: number;
  label: string;
  total: number;
  items: Session[];
}

export default function HistoryPage() {
  const { data: sessions, isLoading } = useSessions();
  const del = useDeleteSession();
  const update = useUpdateSession();
  const add = useAddSession();
  const { toast } = useToast();

  const [editing, setEditing] = useState<Session | null>(null);
  const [adding, setAdding] = useState(false);

  const completed = useMemo(() => (sessions ?? []).filter((s) => s.end != null), [sessions]);

  const groups = useMemo<DayGroup[]>(() => {
    const map = new Map<number, DayGroup>();
    for (const s of completed) {
      const d = new Date(s.start);
      d.setHours(0, 0, 0, 0);
      const key = d.getTime();
      if (!map.has(key)) map.set(key, { key, label: formatDayLabel(s.start), total: 0, items: [] });
      const g = map.get(key)!;
      g.items.push(s);
      g.total += sessionDuration(s);
    }
    return Array.from(map.values()).sort((a, b) => b.key - a.key);
  }, [completed]);

  const handleDelete = (s: Session) => {
    del.mutate(s.id, {
      onSuccess: () =>
        toast({
          title: "Session deleted",
          description: "Removed from your history.",
          action: (
            <button
              onClick={() =>
                add.mutate(
                  { start: s.start, end: s.end, pomodoros: s.pomodoros, tag: s.tag },
                  { onSuccess: () => toast({ title: "Restored" }) }
                )
              }
              className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover-elevate"
              data-testid="button-undo-delete"
            >
              Undo
            </button>
          ),
        }),
    });
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">History</h1>
        <button
          onClick={() => setAdding(true)}
          data-testid="button-add-session"
          className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-2 text-sm font-medium hover-elevate"
        >
          <Plus className="size-4" /> Add
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState onAdd={() => setAdding(true)} />
      ) : (
        <div className="space-y-7">
          {groups.map((g) => (
            <section key={g.key} data-testid={`day-group-${g.key}`}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">{g.label}</h2>
                <span className="text-[13px] font-medium text-muted-foreground tabular-nums">
                  {formatDuration(g.total)}
                </span>
              </div>
              <ul role="list" className="space-y-2">
                {g.items
                  .sort((a, b) => b.start - a.start)
                  .map((s) => (
                    <li
                      key={s.id}
                      data-testid={`session-${s.id}`}
                      className="flex items-center gap-3 rounded-lg border border-card-border bg-card p-3"
                    >
                      <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/12 text-primary">
                        <Clock className="size-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold tabular-nums" data-testid={`text-duration-${s.id}`}>
                          {formatDuration(sessionDuration(s))}
                        </p>
                        <p className="text-[13px] text-muted-foreground tabular-nums">
                          {formatTime(s.start)} – {s.end ? formatTime(s.end) : "…"}
                          {s.pomodoros > 0 && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <Coffee className="size-3" /> {s.pomodoros}
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => setEditing(s)}
                        data-testid={`button-edit-${s.id}`}
                        aria-label="Edit session"
                        className="size-9 grid place-items-center rounded-md text-muted-foreground hover-elevate"
                      >
                        <Pencil className="size-[17px]" />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        data-testid={`button-delete-${s.id}`}
                        aria-label="Delete session"
                        className="size-9 grid place-items-center rounded-md text-muted-foreground hover-elevate hover:text-destructive"
                      >
                        <Trash2 className="size-[17px]" />
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editing && (
        <EditDialog
          session={editing}
          onClose={() => setEditing(null)}
          onSave={(start, end) =>
            update.mutate(
              { id: editing.id, data: { start, end } },
              {
                onSuccess: () => {
                  setEditing(null);
                  toast({ title: "Session updated" });
                },
                onError: (e: any) =>
                  toast({ title: "Couldn't save", description: String(e.message ?? e), variant: "destructive" }),
              }
            )
          }
        />
      )}

      {adding && (
        <AddDialog
          onClose={() => setAdding(false)}
          onSave={(start, end) =>
            add.mutate(
              { start, end, pomodoros: 0, tag: null },
              {
                onSuccess: () => {
                  setAdding(false);
                  toast({ title: "Session added" });
                },
                onError: (e: any) =>
                  toast({ title: "Couldn't add", description: String(e.message ?? e), variant: "destructive" }),
              }
            )
          }
        />
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-16 flex flex-col items-center text-center">
      <div className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
        <Clock className="size-7" />
      </div>
      <p className="mt-4 text-sm font-medium">No sessions yet</p>
      <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">
        Start the timer on the Timer tab, or add a past session manually.
      </p>
      <button
        onClick={onAdd}
        data-testid="button-add-first"
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover-elevate"
      >
        <Plus className="size-4" /> Add a session
      </button>
    </div>
  );
}

function TimeFields({
  start,
  end,
  setStart,
  setEnd,
  error,
}: {
  start: string;
  end: string;
  setStart: (v: string) => void;
  setEnd: (v: string) => void;
  error: string | null;
}) {
  return (
    <div className="space-y-4 py-2">
      <div>
        <label className="mb-1.5 block text-[13px] font-medium" htmlFor="start-input">
          Start
        </label>
        <input
          id="start-input"
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          data-testid="input-start"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-medium" htmlFor="end-input">
          End
        </label>
        <input
          id="end-input"
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          data-testid="input-end"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-[13px] font-medium text-destructive" data-testid="text-error">{error}</p>}
    </div>
  );
}

function EditDialog({
  session,
  onClose,
  onSave,
}: {
  session: Session;
  onClose: () => void;
  onSave: (start: number, end: number) => void;
}) {
  const [start, setStart] = useState(toLocalInputValue(session.start));
  const [end, setEnd] = useState(toLocalInputValue(session.end ?? Date.now()));
  const s = fromLocalInputValue(start);
  const e = fromLocalInputValue(end);
  const error = !s || !e ? "Pick a valid date and time." : e <= s ? "End must be after start." : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit session</DialogTitle>
          <DialogDescription>Adjust the start and end times.</DialogDescription>
        </DialogHeader>
        <TimeFields start={start} end={end} setStart={setStart} setEnd={setEnd} error={error} />
        <DialogFooter>
          <button
            onClick={onClose}
            data-testid="button-cancel-edit"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover-elevate"
          >
            Cancel
          </button>
          <button
            onClick={() => !error && onSave(s, e)}
            disabled={!!error}
            data-testid="button-save-edit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover-elevate disabled:opacity-50"
          >
            Save
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (start: number, end: number) => void;
}) {
  const now = Date.now();
  const [start, setStart] = useState(toLocalInputValue(now - 3600000));
  const [end, setEnd] = useState(toLocalInputValue(now));
  const s = fromLocalInputValue(start);
  const e = fromLocalInputValue(end);
  const error = !s || !e ? "Pick a valid date and time." : e <= s ? "End must be after start." : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add past session</DialogTitle>
          <DialogDescription>Log a work block you forgot to track.</DialogDescription>
        </DialogHeader>
        <TimeFields start={start} end={end} setStart={setStart} setEnd={setEnd} error={error} />
        <DialogFooter>
          <button
            onClick={onClose}
            data-testid="button-cancel-add"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover-elevate"
          >
            Cancel
          </button>
          <button
            onClick={() => !error && onSave(s, e)}
            disabled={!!error}
            data-testid="button-save-add"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover-elevate disabled:opacity-50"
          >
            Add
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
