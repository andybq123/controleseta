import { createContext, useContext, type ReactNode } from "react";
import { useProtocolosRealtime, useRecentSyncFlag } from "./use-protocolos-realtime";

type Ctx = { lastSyncAt: number | null; recentlySynced: boolean };
const RealtimeSyncCtx = createContext<Ctx>({ lastSyncAt: null, recentlySynced: false });

export function RealtimeSyncProvider({ children }: { children: ReactNode }) {
  const { lastSyncAt } = useProtocolosRealtime();
  const recentlySynced = useRecentSyncFlag(lastSyncAt);
  return (
    <RealtimeSyncCtx.Provider value={{ lastSyncAt, recentlySynced }}>
      {children}
    </RealtimeSyncCtx.Provider>
  );
}

export function useRealtimeSync() {
  return useContext(RealtimeSyncCtx);
}