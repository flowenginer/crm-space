import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BadgeDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string;
  criteria_type: string | null;
  criteria_value: number | null;
  is_active: boolean;
}

export interface EarnedBadge {
  id: string;
  user_id: string;
  badge_code: string;
  earned_at: string;
}

export function useGamificationBadges(userId?: string) {
  // Get all badge definitions
  const { data: badges = [], isLoading: isLoadingBadges } = useQuery({
    queryKey: ['gamification-badge-definitions'],
    queryFn: async (): Promise<BadgeDefinition[]> => {
      const { data, error } = await supabase
        .from('gamification_badge_definitions')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Get earned badges for the current user
  const { data: earnedBadges = [], isLoading: isLoadingEarned } = useQuery({
    queryKey: ['gamification-badges', userId],
    queryFn: async (): Promise<EarnedBadge[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('gamification_badges')
        .select('*')
        .eq('user_id', userId || user.id);

      if (error) throw error;
      return data || [];
    },
  });

  return {
    badges,
    earnedBadges,
    isLoading: isLoadingBadges || isLoadingEarned,
  };
}
