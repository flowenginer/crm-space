import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GamificationSetting {
  id: string;
  setting_key: string;
  setting_value: any;
  updated_at: string | null;
}

export function useGamificationSettings() {
  const queryClient = useQueryClient();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['gamification-settings'],
    queryFn: async (): Promise<GamificationSetting[]> => {
      const { data, error } = await supabase
        .from('gamification_settings')
        .select('*');

      if (error) throw error;
      return data || [];
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Record<string, any> }) => {
      const { error } = await supabase
        .from('gamification_settings')
        .upsert({
          setting_key: key,
          setting_value: value,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: 'setting_key' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamification-settings'] });
      toast.success('Configuração atualizada!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar configuração');
      console.error(error);
    },
  });

  const getSetting = (key: string) => {
    return settings.find((s) => s.setting_key === key)?.setting_value;
  };

  return {
    settings,
    isLoading,
    getSetting,
    updateSetting: updateSettingMutation.mutate,
  };
}
