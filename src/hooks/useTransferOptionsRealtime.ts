import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mantém as opções do modal de transferência atualizadas em tempo real.
 * Invalida queries relevantes quando houver mudanças em departamentos,
 * vínculos usuário-departamento ou status/disponibilidade de usuários.
 * Também força refetch ao abrir o modal.
 */
export function useTransferOptionsRealtime(enabled: boolean) {
  const queryClient = useQueryClient();
  const prevEnabled = useRef(enabled);

  // Quando o modal é aberto, força refetch imediato das queries de transferência
  useEffect(() => {
    if (enabled && !prevEnabled.current) {
      // Modal acabou de abrir - invalidar e refetch imediato
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["all-user-departments"] });
      queryClient.invalidateQueries({ queryKey: ["team"] });
    }
    prevEnabled.current = enabled;
  }, [enabled, queryClient]);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel("transfer-options-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "departments" },
        () => {
          console.log("[TransferRealtime] departments changed");
          queryClient.invalidateQueries({ queryKey: ["departments"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_departments" },
        () => {
          console.log("[TransferRealtime] user_departments changed");
          queryClient.invalidateQueries({ queryKey: ["all-user-departments"] });
          queryClient.invalidateQueries({ queryKey: ["departments"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          console.log("[TransferRealtime] profiles changed");
          queryClient.invalidateQueries({ queryKey: ["team"] });
        }
      )
      .subscribe((status) => {
        console.log("[TransferRealtime] Subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}
