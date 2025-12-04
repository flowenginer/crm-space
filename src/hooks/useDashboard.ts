import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardMetrics {
  newContacts: number;
  totalConversations: number;
  respondedConversations: number;
  avgResponseTime: number;
}

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard_metrics'],
    queryFn: async () => {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      
      // Get new contacts this month
      const { count: newContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth);

      // Get total conversations
      const { count: totalConversations } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth);

      // Get responded conversations (has messages from us)
      const { count: respondedConversations } = await supabase
        .from('messages')
        .select('conversation_id', { count: 'exact', head: true })
        .eq('is_from_me', true)
        .gte('created_at', startOfMonth);

      return {
        newContacts: newContacts || 0,
        totalConversations: totalConversations || 0,
        respondedConversations: respondedConversations || 0,
        avgResponseTime: 0, // Would need more complex calculation
      };
    },
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ['recent_activity'],
    queryFn: async () => {
      // Get recent messages
      const { data: messages } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          is_from_me,
          conversation:conversations(
            contact:contacts(full_name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      // Get recent contacts
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, full_name, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      // Get recent deals
      const { data: deals } = await supabase
        .from('deals')
        .select('id, title, value, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      const activities: { id: string; text: string; time: string; type: string }[] = [];

      contacts?.forEach(contact => {
        activities.push({
          id: `contact-${contact.id}`,
          text: `Novo contato: ${contact.full_name}`,
          time: contact.created_at,
          type: 'contact',
        });
      });

      deals?.forEach(deal => {
        activities.push({
          id: `deal-${deal.id}`,
          text: deal.value 
            ? `Negócio criado: ${deal.title} - R$ ${deal.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            : `Negócio criado: ${deal.title}`,
          time: deal.created_at,
          type: 'deal',
        });
      });

      // Sort by time
      activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      return activities.slice(0, 10).map(a => ({
        ...a,
        time: formatTimeAgo(a.time),
      }));
    },
  });
}

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'agora mesmo';
  if (seconds < 3600) return `há ${Math.floor(seconds / 60)} minutos`;
  if (seconds < 86400) return `há ${Math.floor(seconds / 3600)} horas`;
  return `há ${Math.floor(seconds / 86400)} dias`;
}
