import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { Session, Settings, UpdateSettings, InsertSession } from "@shared/schema";
import * as db from "@/lib/db";

// Hooks are backed by IndexedDB (see lib/db.ts). Query keys are kept identical
// to the previous server-backed version so component code and cache
// invalidation continue to work unchanged.

export function useSessions() {
  return useQuery<Session[]>({
    queryKey: ["/api/sessions"],
    queryFn: () => db.getSessions(),
  });
}

export function useRunningSession() {
  return useQuery<Session | null>({
    queryKey: ["/api/sessions/running"],
    queryFn: () => db.getRunningSession(),
    refetchInterval: 15000,
  });
}

export function useSettings() {
  return useQuery<Settings>({
    queryKey: ["/api/settings"],
    queryFn: () => db.getSettings(),
  });
}

function invalidateSessions() {
  queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
  queryClient.invalidateQueries({ queryKey: ["/api/sessions/running"] });
}

export function useStartSession() {
  return useMutation({
    mutationFn: () => db.startSession(),
    onSuccess: invalidateSessions,
  });
}

export function useStopSession() {
  return useMutation({
    mutationFn: (pomodoros: number) => db.stopSession(pomodoros),
    onSuccess: invalidateSessions,
  });
}

export function useUpdateSession() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertSession> }) =>
      db.updateSession(id, data),
    onSuccess: invalidateSessions,
  });
}

export function useAddSession() {
  return useMutation({
    mutationFn: (data: InsertSession) => db.createSession(data),
    onSuccess: invalidateSessions,
  });
}

export function useDeleteSession() {
  return useMutation({
    mutationFn: (id: number) => db.deleteSession(id),
    onSuccess: invalidateSessions,
  });
}

export function useUpdateSettings() {
  return useMutation({
    mutationFn: (data: UpdateSettings) => db.updateSettings(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/settings"] }),
  });
}

export function useExportData() {
  return useMutation({ mutationFn: () => db.exportData() });
}

export function useImportData() {
  return useMutation({
    mutationFn: (bundle: db.BackupBundle) => db.importData(bundle),
    onSuccess: () => {
      invalidateSessions();
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });
}
