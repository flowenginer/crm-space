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
}

type PeriodFilter = 'daily' | 'weekly' | 'monthly';

// Cores para vendedores sem perfil de gamificação
const DEFAULT_COLORS = [
  '#E10600', '#00D2BE', '#0090FF', '#FF8700', '#9B0000',
  '#F596C8', '#006F62', '#1E41FF', '#C92D4B', '#2D826D'
];

export function useGamificationRankings(period: PeriodFilter = 'monthly') {
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

    return () => {
      supabase.removeChannel(contactsChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, [queryClient]);

  const { data: rankings = [], isLoading } = useQuery({
    queryKey: ['gamification-rankings', period, companySettings?.conversion_status_ids],
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

      // Construir rankings combinando vendedores e vendas
      const rankings: RacerRanking[] = sellers.map((seller, index) => {
        const userSales = salesByUser.get(seller.id) || { totalSales: 0, totalDeals: 0 };
        
        // Calcular pontos baseado em faturamento (1 ponto por R$10)
        const basePoints = Math.floor(userSales.totalSales / 10);
        
        // Determinar nível baseado em faturamento
        let level = 'bronze';
        if (userSales.totalSales >= 20000) level = 'gold';
        else if (userSales.totalSales >= 10000) level = 'silver';

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
        };
      });

      // Ordenar por FATURAMENTO (total_sales) - não por pontos
      rankings.sort((a, b) => b.total_sales - a.total_sales);
      rankings.forEach((r, index) => {
        r.position = index + 1;
      });

      return rankings;
    },
    enabled: !!companySettings,
  });

  return { rankings, isLoading };
}
