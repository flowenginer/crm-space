import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RacerRanking {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  car_color: string;
  current_level: string;
  total_points: number;
  total_sales: number;
  total_deals: number;
  position: number;
}

type PeriodFilter = 'daily' | 'weekly' | 'monthly';

export function useGamificationRankings(period: PeriodFilter = 'monthly') {
  const { data: rankings = [], isLoading } = useQuery({
    queryKey: ['gamification-rankings', period],
    queryFn: async (): Promise<RacerRanking[]> => {
      // First, get profiles with their points
      const { data: profiles, error: profilesError } = await supabase
        .from('gamification_profiles')
        .select('*');

      if (profilesError) throw profilesError;

      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'daily':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'weekly':
          const dayOfWeek = now.getDay();
          const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
          break;
        case 'monthly':
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }

      // Get points for the period
      const { data: points, error: pointsError } = await supabase
        .from('gamification_points')
        .select('user_id, points, reference_value')
        .gte('created_at', startDate.toISOString());

      if (pointsError) throw pointsError;

      // Aggregate points by user
      const pointsByUser = new Map<string, { totalPoints: number; totalSales: number; totalDeals: number }>();

      points?.forEach((p) => {
        const current = pointsByUser.get(p.user_id) || { totalPoints: 0, totalSales: 0, totalDeals: 0 };
        current.totalPoints += p.points;
        if (p.reference_value) {
          current.totalSales += Number(p.reference_value);
          current.totalDeals += 1;
        }
        pointsByUser.set(p.user_id, current);
      });

      // Build rankings
      const rankings: RacerRanking[] = (profiles || []).map((profile) => {
        const userPoints = pointsByUser.get(profile.user_id) || { totalPoints: 0, totalSales: 0, totalDeals: 0 };
        return {
          user_id: profile.user_id,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          car_color: profile.car_color || '#E10600',
          current_level: profile.current_level || 'bronze',
          total_points: userPoints.totalPoints,
          total_sales: userPoints.totalSales,
          total_deals: userPoints.totalDeals,
          position: 0,
        };
      });

      // Sort by points and assign positions
      rankings.sort((a, b) => b.total_points - a.total_points);
      rankings.forEach((r, index) => {
        r.position = index + 1;
      });

      return rankings;
    },
  });

  return { rankings, isLoading };
}
