import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkTransferResult {
  success: number;
  failed: number;
  errors: string[];
}

interface BulkReturnResult {
  success: number;
  failed: number;
  noOriginalAgent: number;
  errors: string[];
}

interface OriginalAgentInfo {
  contact_id: string;
  original_agent_id: string;
  original_agent_name: string | null;
  original_department_id: string | null;
}

export function useBulkTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationIds,
      toDepartmentId,
      toUserId,
      note,
    }: {
      conversationIds: string[];
      toDepartmentId: string;
      toUserId?: string | null;
      note?: string;
    }): Promise<BulkTransferResult> => {
      const result: BulkTransferResult = {
        success: 0,
        failed: 0,
        errors: [],
      };

      // Process in chunks of 10 to avoid overwhelming the server
      const chunkSize = 10;
      for (let i = 0; i < conversationIds.length; i += chunkSize) {
        const chunk = conversationIds.slice(i, i + chunkSize);
        
        const promises = chunk.map(async (conversationId) => {
          try {
            const { error } = await supabase.rpc('transfer_conversation', {
              p_conversation_id: conversationId,
              p_to_user_id: toUserId || null,
              p_to_department_id: toDepartmentId,
              p_note: note || null,
              p_force: false,
            });

            if (error) {
              result.failed++;
              result.errors.push(`${conversationId}: ${error.message}`);
            } else {
              result.success++;
            }
          } catch (error: any) {
            result.failed++;
            result.errors.push(`${conversationId}: ${error.message}`);
          }
        });

        await Promise.all(promises);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-counts'] });
    },
  });
}

export function useBulkReturnToOriginalAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationIds: string[]): Promise<BulkReturnResult> => {
      const result: BulkReturnResult = {
        success: 0,
        failed: 0,
        noOriginalAgent: 0,
        errors: [],
      };

      // First, get the contact IDs for these conversations
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id, contact_id')
        .in('id', conversationIds);

      if (convError || !conversations) {
        throw new Error('Erro ao buscar conversas: ' + (convError?.message || 'Dados não encontrados'));
      }

      const contactIds = conversations.map((c) => c.contact_id);

      // Get original agents for these contacts
      const { data: originalAgents, error: agentError } = await supabase.rpc(
        'get_original_agents_for_contacts',
        { contact_ids: contactIds }
      );

      if (agentError) {
        throw new Error('Erro ao buscar atendentes originais: ' + agentError.message);
      }

      // Create a map of contact_id -> original agent info
      const agentMap = new Map<string, OriginalAgentInfo>();
      if (originalAgents) {
        (originalAgents as OriginalAgentInfo[]).forEach((agent) => {
          agentMap.set(agent.contact_id, agent);
        });
      }

      // Process transfers in chunks
      const chunkSize = 10;
      for (let i = 0; i < conversations.length; i += chunkSize) {
        const chunk = conversations.slice(i, i + chunkSize);

        const promises = chunk.map(async (conv) => {
          const originalAgent = agentMap.get(conv.contact_id);

          if (!originalAgent || !originalAgent.original_agent_id) {
            result.noOriginalAgent++;
            return;
          }

          try {
            const { error } = await supabase.rpc('transfer_conversation', {
              p_conversation_id: conv.id,
              p_to_user_id: originalAgent.original_agent_id,
              p_to_department_id: originalAgent.original_department_id || null,
              p_note: 'Devolvido ao atendente original',
              p_force: false,
            });

            if (error) {
              result.failed++;
              result.errors.push(`${conv.id}: ${error.message}`);
            } else {
              result.success++;
            }
          } catch (error: any) {
            result.failed++;
            result.errors.push(`${conv.id}: ${error.message}`);
          }
        });

        await Promise.all(promises);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-counts'] });
    },
  });
}
