import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type OnlineUser = { user_id: string; nome: string; online_at: string };
type Ctx = { onlineIds: Set<string>; onlineUsers: OnlineUser[] };
const OnlineCtx = createContext<Ctx>({ onlineIds: new Set(), onlineUsers: [] });

export function OnlineUsersProvider({
  userId,
  nome,
  children,
}: {
  userId: string;
  nome: string;
  children: ReactNode;
}) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel("online-users", {
      config: { presence: { key: userId } },
    });

    const syncState = () => {
      const state = channel.presenceState() as Record<string, OnlineUser[]>;
      const ids = new Set<string>();
      const users: OnlineUser[] = [];
      for (const key of Object.keys(state)) {
        ids.add(key);
        const first = state[key]?.[0];
        if (first) users.push({ user_id: key, nome: first.nome ?? "", online_at: first.online_at ?? "" });
      }
      users.sort((a, b) => a.nome.localeCompare(b.nome));
      setOnlineIds(ids);
      setOnlineUsers(users);
    };

    channel
      .on("presence", { event: "sync" }, syncState)
      .on("presence", { event: "join" }, syncState)
      .on("presence", { event: "leave" }, syncState)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId, nome, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, nome]);

  return <OnlineCtx.Provider value={{ onlineIds, onlineUsers }}>{children}</OnlineCtx.Provider>;
}

export function useOnlineUsers() {
  return useContext(OnlineCtx);
}

export function useIsUserOnline(userId?: string | null) {
  const { onlineIds } = useOnlineUsers();
  if (!userId) return false;
  return onlineIds.has(userId);
}