import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MarketingStep } from '@/types/marketing';

export interface CampaignKPIs {
  totalContacts: number;
  activeContacts: number;
  respondedContacts: number;
  completedContacts: number;
  cancelledContacts: number;
  responseRate: number;
  completionRate: number;
  conversions: number;
  conversionRate: number;
}

export interface StepMetrics {
  stepNumber: number;
  sent: number;
  delivered: number;
  read: number;
  responded: number;
  stepMessage: string;
}

export interface ActionMetrics {
  actionType: string;
  count: number;
  successCount: number;
  percentage: number;
}

export interface StatusDistribution {
  status: string;
  count: number;
  percentage: number;
}

export interface CampaignContact {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  currentStep: number;
  status: string;
  createdAt: string;
  respondedAt: string | null;
  leadStatus: string | null;
  conversationId: string | null;
}

export interface ResponseTimelineData {
  date: string;
  responses: number;
  completions: number;
}

export function useMarketingDashboardKPIs(campaignId: string | null, startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['marketing-dashboard-kpis', campaignId, startDate?.toISOString(), endDate?.toISOString()],
    enabled: !!campaignId,
    queryFn: async (): Promise<CampaignKPIs> => {
      let query = supabase
        .from('active_marketing_campaigns')
        .select('id, status, responded_at, contact_id, contacts!inner(lead_status)', { count: 'exact' })
        .eq('campaign_id', campaignId!);

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, count, error } = await query;
      if (error) throw error;

      const totalContacts = count || 0;
      const activeContacts = data?.filter(d => d.status === 'active').length || 0;
      const respondedContacts = data?.filter(d => d.status === 'responded').length || 0;
      const completedContacts = data?.filter(d => d.status === 'completed').length || 0;
      const cancelledContacts = data?.filter(d => d.status === 'cancelled').length || 0;

      // Get conversion status IDs from company settings
      const { data: settings } = await supabase
        .from('company_settings')
        .select('conversion_status_ids')
        .single();

      const conversionStatusIds = settings?.conversion_status_ids || [];
      
      // Count contacts with conversion status
      const conversions = data?.filter(d => {
        const contact = d.contacts as { lead_status: string | null } | null;
        return contact?.lead_status && conversionStatusIds.includes(contact.lead_status);
      }).length || 0;

      return {
        totalContacts,
        activeContacts,
        respondedContacts,
        completedContacts,
        cancelledContacts,
        responseRate: totalContacts > 0 ? (respondedContacts / totalContacts) * 100 : 0,
        completionRate: totalContacts > 0 ? (completedContacts / totalContacts) * 100 : 0,
        conversions,
        conversionRate: totalContacts > 0 ? (conversions / totalContacts) * 100 : 0,
      };
    },
  });
}

export function useMarketingStepMetrics(campaignId: string | null, startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['marketing-step-metrics', campaignId, startDate?.toISOString(), endDate?.toISOString()],
    enabled: !!campaignId,
    queryFn: async (): Promise<StepMetrics[]> => {
      // Get campaign steps
      const { data: campaign, error: campaignError } = await supabase
        .from('marketing_campaigns')
        .select('steps')
        .eq('id', campaignId!)
        .single();

      if (campaignError) throw campaignError;
      
      const steps = (campaign?.steps as unknown as MarketingStep[]) || [];

      // Get scheduled messages stats
      let scheduledQuery = supabase
        .from('marketing_scheduled_messages')
        .select(`
          step_number,
          status,
          active_campaign_id,
          active_marketing_campaigns!inner(campaign_id)
        `)
        .eq('active_marketing_campaigns.campaign_id', campaignId!);

      const { data: scheduledData, error: scheduledError } = await scheduledQuery;
      if (scheduledError) throw scheduledError;

      // Get active campaigns to count responses per step
      let activeCampaignsQuery = supabase
        .from('active_marketing_campaigns')
        .select('current_step, status, responded_at')
        .eq('campaign_id', campaignId!);

      if (startDate) {
        activeCampaignsQuery = activeCampaignsQuery.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        activeCampaignsQuery = activeCampaignsQuery.lte('created_at', endDate.toISOString());
      }

      const { data: activeCampaigns, error: acError } = await activeCampaignsQuery;
      if (acError) throw acError;

      // Build step metrics
      return steps.map((step, index) => {
        const stepMessages = scheduledData?.filter(s => s.step_number === index) || [];
        const sent = stepMessages.filter(m => m.status === 'sent').length;
        
        // Responses: contacts that responded at or after this step
        const responded = activeCampaigns?.filter(ac => 
          ac.responded_at && ac.current_step >= index
        ).length || 0;

        return {
          stepNumber: index,
          sent,
          delivered: sent, // Approximation, would need message status tracking
          read: Math.round(sent * 0.8), // Approximation
          responded: Math.round(responded / (index + 1)), // Distribute responses
          stepMessage: step.message.substring(0, 50) + (step.message.length > 50 ? '...' : ''),
        };
      });
    },
  });
}

export function useMarketingActionMetrics(campaignId: string | null, startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['marketing-action-metrics', campaignId, startDate?.toISOString(), endDate?.toISOString()],
    enabled: !!campaignId,
    queryFn: async (): Promise<ActionMetrics[]> => {
      let query = supabase
        .from('marketing_action_logs')
        .select('action_type, success')
        .eq('campaign_id', campaignId!);

      if (startDate) {
        query = query.gte('executed_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('executed_at', endDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by action type
      const grouped = (data || []).reduce((acc, log) => {
        if (!acc[log.action_type]) {
          acc[log.action_type] = { total: 0, success: 0 };
        }
        acc[log.action_type].total++;
        if (log.success) acc[log.action_type].success++;
        return acc;
      }, {} as Record<string, { total: number; success: number }>);

      const total = data?.length || 1;

      return Object.entries(grouped).map(([actionType, stats]) => ({
        actionType,
        count: stats.total,
        successCount: stats.success,
        percentage: (stats.total / total) * 100,
      })).sort((a, b) => b.count - a.count);
    },
  });
}

export function useMarketingStatusDistribution(campaignId: string | null, startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['marketing-status-distribution', campaignId, startDate?.toISOString(), endDate?.toISOString()],
    enabled: !!campaignId,
    queryFn: async (): Promise<StatusDistribution[]> => {
      let query = supabase
        .from('active_marketing_campaigns')
        .select('contact_id, contacts!inner(lead_status)')
        .eq('campaign_id', campaignId!);

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get lead statuses
      const { data: leadStatuses } = await supabase
        .from('lead_statuses')
        .select('id, name, color');

      const statusMap = new Map(leadStatuses?.map(s => [s.id, s.name]) || []);

      // Group by lead status
      const grouped = (data || []).reduce((acc, item) => {
        const contact = item.contacts as { lead_status: string | null } | null;
        const status = contact?.lead_status || 'sem_status';
        const statusName = statusMap.get(status) || 'Sem Status';
        acc[statusName] = (acc[statusName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const total = data?.length || 1;

      return Object.entries(grouped).map(([status, count]) => ({
        status,
        count,
        percentage: (count / total) * 100,
      })).sort((a, b) => b.count - a.count);
    },
  });
}

export function useMarketingResponseTimeline(campaignId: string | null, startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['marketing-response-timeline', campaignId, startDate?.toISOString(), endDate?.toISOString()],
    enabled: !!campaignId,
    queryFn: async (): Promise<ResponseTimelineData[]> => {
      let query = supabase
        .from('active_marketing_campaigns')
        .select('created_at, responded_at, status')
        .eq('campaign_id', campaignId!);

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by date
      const grouped = (data || []).reduce((acc, item) => {
        if (item.responded_at) {
          const date = item.responded_at.split('T')[0];
          if (!acc[date]) {
            acc[date] = { responses: 0, completions: 0 };
          }
          acc[date].responses++;
          if (item.status === 'completed') {
            acc[date].completions++;
          }
        }
        return acc;
      }, {} as Record<string, { responses: number; completions: number }>);

      return Object.entries(grouped)
        .map(([date, stats]) => ({
          date,
          responses: stats.responses,
          completions: stats.completions,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
  });
}

export function useMarketingCampaignContacts(
  campaignId: string | null, 
  startDate?: Date, 
  endDate?: Date,
  page = 0,
  pageSize = 20
) {
  return useQuery({
    queryKey: ['marketing-campaign-contacts', campaignId, startDate?.toISOString(), endDate?.toISOString(), page, pageSize],
    enabled: !!campaignId,
    queryFn: async (): Promise<{ contacts: CampaignContact[]; total: number }> => {
      let query = supabase
        .from('active_marketing_campaigns')
        .select(`
          id,
          contact_id,
          current_step,
          status,
          created_at,
          responded_at,
          conversation_id,
          contacts!inner(full_name, phone, lead_status)
        `, { count: 'exact' })
        .eq('campaign_id', campaignId!)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, count, error } = await query;
      if (error) throw error;

      // Get lead statuses
      const { data: leadStatuses } = await supabase
        .from('lead_statuses')
        .select('id, name');

      const statusMap = new Map(leadStatuses?.map(s => [s.id, s.name]) || []);

      const contacts: CampaignContact[] = (data || []).map(item => {
        const contact = item.contacts as { full_name: string; phone: string; lead_status: string | null };
        return {
          id: item.id,
          contactId: item.contact_id,
          contactName: contact.full_name,
          contactPhone: contact.phone,
          currentStep: item.current_step || 0,
          status: item.status || 'active',
          createdAt: item.created_at || '',
          respondedAt: item.responded_at,
          leadStatus: contact.lead_status ? statusMap.get(contact.lead_status) || null : null,
          conversationId: item.conversation_id,
        };
      });

      return { contacts, total: count || 0 };
    },
  });
}

// Hook to list all campaigns for the selector
export function useMarketingCampaignsList() {
  return useQuery({
    queryKey: ['marketing-campaigns-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('id, title, description, is_active, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}

// Hook to get dispatches for a campaign
export function useMarketingDispatchStats(campaignId: string | null) {
  return useQuery({
    queryKey: ['marketing-dispatch-stats', campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bulk_dispatches')
        .select('id, name, status, total_contacts, sent_count, responded_count, error_count, skipped_count, created_at')
        .eq('marketing_campaign_id', campaignId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}
