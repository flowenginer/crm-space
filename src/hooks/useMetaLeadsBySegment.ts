import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SegmentCrossData {
  segmentId: string | null;
  segmentName: string;
  totalLeads: number;
  catalogoCount: number;  // 03 - Catálogo
  layoutCount: number;    // 04 - Layout
  pedidoFechadoCount: number; // 07 - Pedido Fechado
  revenue: number;
}

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export function useMetaLeadsBySegment(dateRange?: DateRange) {
  return useQuery({
    queryKey: ['meta_leads_by_segment', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<SegmentCrossData[]> => {
      // Fetch segments
      const { data: segments } = await supabase
        .from('segments')
        .select('id, name');

      const segmentMap = new Map<string, string>();
      segments?.forEach(s => {
        segmentMap.set(s.id, s.name);
      });

      // Build query for conversations with Meta Ads referral
      let query = supabase
        .from('conversations')
        .select(`
          id,
          contact_id,
          created_at,
          contacts!inner (
            id,
            segment_id,
            lead_status,
            negotiated_value
          )
        `)
        .not('referral_source', 'is', null);

      // Apply date filters
      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        const endDate = new Date(dateRange.to);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data: conversations } = await query;

      if (!conversations || conversations.length === 0) {
        return [];
      }

      // Group by segment
      const segmentData = new Map<string | null, SegmentCrossData>();

      // Track unique contacts per segment
      const contactsBySegment = new Map<string | null, Set<string>>();

      conversations.forEach((conv: any) => {
        const contact = conv.contacts;
        if (!contact) return;

        const segmentId = contact.segment_id;
        const segmentKey = segmentId || 'sem_segmento';

        if (!contactsBySegment.has(segmentKey)) {
          contactsBySegment.set(segmentKey, new Set());
        }

        // Only count unique contacts
        if (contactsBySegment.get(segmentKey)!.has(contact.id)) {
          return;
        }
        contactsBySegment.get(segmentKey)!.add(contact.id);

        if (!segmentData.has(segmentKey)) {
          segmentData.set(segmentKey, {
            segmentId: segmentId,
            segmentName: segmentId ? (segmentMap.get(segmentId) || 'Desconhecido') : 'Sem Segmento',
            totalLeads: 0,
            catalogoCount: 0,
            layoutCount: 0,
            pedidoFechadoCount: 0,
            revenue: 0
          });
        }

        const data = segmentData.get(segmentKey)!;
        data.totalLeads++;

        const status = contact.lead_status || '';
        if (status.includes('03 - Catálogo') || status.toLowerCase().includes('catálogo')) {
          data.catalogoCount++;
        }
        if (status.includes('04 - Layout') || status.toLowerCase().includes('layout')) {
          data.layoutCount++;
        }
        if (status.includes('07 - Pedido Fechado') || status.toLowerCase().includes('pedido fechado')) {
          data.pedidoFechadoCount++;
          data.revenue += contact.negotiated_value || 0;
        }
      });

      return Array.from(segmentData.values()).sort((a, b) => b.totalLeads - a.totalLeads);
    },
    staleTime: 60000,
  });
}
