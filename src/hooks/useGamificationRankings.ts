import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanySettings } from "./useCompanySettings";
import { useERPEnabled } from "./useERPEnabled";

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
  // Novas métricas
  avg_response_time_seconds: number;
  avg_ticket: number;
  conversion_rate: number;
  total_leads: number;
}

type PeriodFilter = 'daily' | 'weekly' | 'monthly';
export type RankingType = 'general' | 'sales' | 'speed' | 'ticket' | 'conversion' | 'attendance';

// Cores para vendedores sem perfil de gamificação
const DEFAULT_COLORS = [
  '#E10600', '#00D2BE', '#0090FF', '#FF8700', '#9B0000',
  '#F596C8', '#006F62', '#1E41FF', '#C92D4B', '#2D826D'
];

export function useGamificationRankings(
  period: PeriodFilter = 'monthly',
  rankingType: RankingType = 'general'
) {
  const queryClient = useQueryClient();
  const { data: companySettings } = useCompanySettings();
  const erpEnabled = useERPEnabled();

  // Real-time subscription
  useEffect(() => {
    // Subscribe to contacts changes
    const contactsChannel = supabase
      .channel('gamification-contacts')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'contacts'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['gamification-rankings'] });
      })
      .subscribe();

    // Subscribe to orders changes
    const ordersChannel = supabase
      .channel('gamification-orders')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['gamification-rankings'] });
      })
      .subscribe();

    // Subscribe to conversations changes (para velocidade)
    const conversationsChannel = supabase
      .channel('gamification-conversations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['gamification-rankings'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(contactsChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(conversationsChannel);
    };
  }, [queryClient]);

  const { data: rankings = [], isLoading } = useQuery({
    queryKey: ['gamification-rankings', period, rankingType, companySettings?.conversion_status_ids],
    queryFn: async (): Promise<RacerRanking[]> => {
      // Calcular range de datas baseado no período
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

      // Buscar vendedores ativos (role = 'vendedor')
      const { data: sellers, error: sellersError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('role', 'vendedor')
        .eq('is_active', true);

      if (sellersError) throw sellersError;

      if (!sellers || sellers.length === 0) {
        return [];
      }

      const sellerIds = sellers.map(s => s.id);

      // Determinar fonte de dados: CRM ou ERP
      // @ts-ignore - gamification_source pode não estar tipado ainda
      const gamificationSource = companySettings?.gamification_source || 'crm';
      const useERP = gamificationSource === 'erp' && erpEnabled;

      let salesByUser = new Map<string, { totalSales: number; totalDeals: number }>();

      if (useERP) {
        // Modo ERP: buscar de orders (apenas pedidos, não orçamentos)
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('seller_id, total')
          .eq('order_type', 'order')
          .gte('created_at', startDate.toISOString())
          .in('seller_id', sellerIds);

        if (ordersError) throw ordersError;

        ordersData?.forEach((order) => {
          if (!order.seller_id) return;
          const current = salesByUser.get(order.seller_id) || { totalSales: 0, totalDeals: 0 };
          current.totalSales += Number(order.total) || 0;
          current.totalDeals += 1;
          salesByUser.set(order.seller_id, current);
        });
      } else {
        // Modo CRM: buscar de contacts com status de conversão
        const conversionStatusIds = companySettings?.conversion_status_ids || [];

        if (conversionStatusIds.length === 0) {
          // Fallback: buscar todos os status que são de conversão
          const { data: leadStatuses } = await supabase
            .from('lead_statuses')
            .select('id, name')
            .order('order_position');

          // Usar status a partir do "07 - Pedido Fechado" como conversão
          const conversionStatuses = leadStatuses?.filter(s => {
            const num = parseInt(s.name?.split(' - ')[0] || '0');
            return num >= 7;
          }).map(s => s.name) || [];

          const { data: contactsData, error: contactsError } = await supabase
            .from('contacts')
            .select('assigned_to, negotiated_value, lead_status')
            .in('lead_status', conversionStatuses)
            .gte('updated_at', startDate.toISOString())
            .in('assigned_to', sellerIds);

          if (contactsError) throw contactsError;

          contactsData?.forEach((contact) => {
            if (!contact.assigned_to) return;
            const current = salesByUser.get(contact.assigned_to) || { totalSales: 0, totalDeals: 0 };
            current.totalSales += Number(contact.negotiated_value) || 0;
            current.totalDeals += 1;
            salesByUser.set(contact.assigned_to, current);
          });
        } else {
          // Buscar nomes dos status de conversão
          const { data: conversionStatusesData } = await supabase
            .from('lead_statuses')
            .select('id, name')
            .in('id', conversionStatusIds);

          const conversionStatusNames = conversionStatusesData?.map(s => s.name) || [];

          if (conversionStatusNames.length > 0) {
            const { data: contactsData, error: contactsError } = await supabase
              .from('contacts')
              .select('assigned_to, negotiated_value, lead_status')
              .in('lead_status', conversionStatusNames)
              .gte('updated_at', startDate.toISOString())
              .in('assigned_to', sellerIds);

            if (contactsError) throw contactsError;

            contactsData?.forEach((contact) => {
              if (!contact.assigned_to) return;
              const current = salesByUser.get(contact.assigned_to) || { totalSales: 0, totalDeals: 0 };
              current.totalSales += Number(contact.negotiated_value) || 0;
              current.totalDeals += 1;
              salesByUser.set(contact.assigned_to, current);
            });
          }
        }
      }

      // Buscar tempo médio de resposta (Velocidade)
      const { data: conversationsData } = await supabase
        .from('conversations')
        .select('assigned_to, first_response_at, created_at')
        .in('assigned_to', sellerIds)
        .not('first_response_at', 'is', null)
        .gte('created_at', startDate.toISOString());

      const responseTimeByUser = new Map<string, { totalTime: number; count: number }>();
      conversationsData?.forEach((conv) => {
        if (!conv.assigned_to || !conv.first_response_at || !conv.created_at) return;
        const responseTime = (new Date(conv.first_response_at).getTime() - new Date(conv.created_at).getTime()) / 1000;
        if (responseTime < 0) return; // Ignorar valores negativos
        const current = responseTimeByUser.get(conv.assigned_to) || { totalTime: 0, count: 0 };
        current.totalTime += responseTime;
        current.count += 1;
        responseTimeByUser.set(conv.assigned_to, current);
      });

      // Buscar total de leads por vendedor (para taxa de conversão)
      const { data: totalLeadsData } = await supabase
        .from('contacts')
        .select('assigned_to')
        .in('assigned_to', sellerIds)
        .gte('created_at', startDate.toISOString());

      const totalLeadsByUser = new Map<string, number>();
      totalLeadsData?.forEach((contact) => {
        if (!contact.assigned_to) return;
        totalLeadsByUser.set(contact.assigned_to, (totalLeadsByUser.get(contact.assigned_to) || 0) + 1);
      });

      // Construir rankings combinando vendedores e vendas
      const rankings: RacerRanking[] = sellers.map((seller, index) => {
        const userSales = salesByUser.get(seller.id) || { totalSales: 0, totalDeals: 0 };
        const responseTimeData = responseTimeByUser.get(seller.id);
        const totalLeads = totalLeadsByUser.get(seller.id) || 0;
        
        // Calcular pontos baseado em faturamento (1 ponto por R$10)
        const basePoints = Math.floor(userSales.totalSales / 10);
        
        // Determinar nível baseado em faturamento
        let level = 'bronze';
        if (userSales.totalSales >= 20000) level = 'gold';
        else if (userSales.totalSales >= 10000) level = 'silver';

        // Calcular métricas adicionais
        const avgResponseTime = responseTimeData 
          ? responseTimeData.totalTime / responseTimeData.count 
          : 0;
        const avgTicket = userSales.totalDeals > 0 
          ? userSales.totalSales / userSales.totalDeals 
          : 0;
        const conversionRate = totalLeads > 0 
          ? (userSales.totalDeals / totalLeads) * 100 
          : 0;

        return {
          user_id: seller.id,
          display_name: seller.full_name,
          avatar_url: seller.avatar_url,
          car_color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
          current_level: level,
          total_points: basePoints,
          total_sales: userSales.totalSales,
          total_deals: userSales.totalDeals,
          position: 0,
          avg_response_time_seconds: avgResponseTime,
          avg_ticket: avgTicket,
          conversion_rate: conversionRate,
          total_leads: totalLeads,
        };
      });

      // Ordenar conforme o tipo de ranking
      switch (rankingType) {
        case 'speed':
          // Menor tempo = melhor (quem não tem resposta vai pro fim)
          rankings.sort((a, b) => {
            if (a.avg_response_time_seconds === 0 && b.avg_response_time_seconds === 0) return 0;
            if (a.avg_response_time_seconds === 0) return 1;
            if (b.avg_response_time_seconds === 0) return -1;
            return a.avg_response_time_seconds - b.avg_response_time_seconds;
          });
          break;
        case 'ticket':
          rankings.sort((a, b) => b.avg_ticket - a.avg_ticket);
          break;
        case 'conversion':
          rankings.sort((a, b) => b.conversion_rate - a.conversion_rate);
          break;
        default: // general, sales, attendance
          rankings.sort((a, b) => b.total_sales - a.total_sales);
      }

      // Atribuir posições
      rankings.forEach((r, index) => {
        r.position = index + 1;
      });

      return rankings;
    },
    enabled: !!companySettings,
  });

  return { rankings, isLoading };
}
