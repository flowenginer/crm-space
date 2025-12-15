import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mantém as opções do modal de transferência atualizadas em tempo real.
 * Invalida queries relevantes quando houver mudanças em departamentos,
 * vínculos usuário-departamento ou status/disponibilidade de usuários.
 */
export function useTransferOptionsRealtime(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel("transfer-options-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "departments" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["departments"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_departments" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["all-user-departments"] });
          // também afeta contagens e filtros
          queryClient.invalidateQueries({ queryKey: ["departments"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          // online/disponibilidade/role afetam lista de atendentes
          queryClient.invalidateQueries({ queryKey: ["team"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}
