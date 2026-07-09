import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type Ctx = { onlineIds: Set<string> };
const OnlineCtx = createContext<Ctx>({ onlineIds: new Set() });

export function OnlineUsersProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel("online-users", {
      config: { presence: { key: userId } },
    });

    const syncState = () => {
      const state = channel.presenceState() as Record<string, unknown[]>;
      setOnlineIds(new Set(Object.keys(state)));
    };

    channel
      .on("presence", { event: "sync" }, syncState)
      .on("presence", { event: "join" }, syncState)
      .on("presence", { event: "leave" }, syncState)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return <OnlineCtx.Provider value={{ onlineIds }}>{children}</OnlineCtx.Provider>;
}

export function useOnlineUsers() {
  return useContext(OnlineCtx);
}

export function useIsUserOnline(userId?: string | null) {
  const { onlineIds } = useOnlineUsers();
  if (!userId) return false;
  return onlineIds.has(userId);
}