import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

interface DistributeResult {
  success: number;
  failed: number;
  errors: string[];
  distributions: Array<{
    userId: string;
    userName: string;
    count: number;
  }>;
}

interface BulkActionResult {
  success: number;
  failed: number;
  errors: string[];
}

// ============ HELPER FUNCTIONS ============

// Delay helper for throttling
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Process with automatic retry on failure
async function processWithRetry<T>(
  fn: () => Promise<T>,
  retries: number = 1,
  delayMs: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      console.log(`[BulkAction] Retrying after error, ${retries} attempts left...`);
      await delay(delayMs);
      return processWithRetry(fn, retries - 1, delayMs);
    }
    throw error;
  }
}

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper to process in chunks (for lighter operations)
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ============ HOOKS ============

export function useBulkTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationIds,
      toDepartmentId,
      toUserId,
      note,
      onProgress,
    }: {
      conversationIds: string[];
      toDepartmentId: string;
      toUserId?: string | null;
      note?: string;
      onProgress?: (processed: number, total: number) => void;
    }): Promise<BulkTransferResult> => {
      const result: BulkTransferResult = {
        success: 0,
        failed: 0,
        errors: [],
      };

      const total = conversationIds.length;
      let processed = 0;

      // Process SEQUENTIALLY with delays to avoid timeouts
      for (const conversationId of conversationIds) {
        try {
          await processWithRetry(async () => {
            const { error } = await supabase.rpc('transfer_conversation', {
              p_conversation_id: conversationId,
              p_to_user_id: toUserId || null,
              p_to_department_id: toDepartmentId,
              p_note: note || null,
              p_force: false,
            });

            if (error) throw error;
          });
          
          result.success++;
        } catch (error: any) {
          result.failed++;
          result.errors.push(`${conversationId}: ${error.message}`);
        }
        
        processed++;
        onProgress?.(processed, total);
        
        // Small delay between each item to prevent DB overload
        await delay(100);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-report'] });
    },
  });
}

export function useBulkReturnToOriginalAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationIds,
      onProgress,
    }: {
      conversationIds: string[];
      onProgress?: (processed: number, total: number) => void;
    }): Promise<BulkReturnResult> => {
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

      const total = conversations.length;
      let processed = 0;

      // Process SEQUENTIALLY with delays
      for (const conv of conversations) {
        const originalAgent = agentMap.get(conv.contact_id);

        if (!originalAgent || !originalAgent.original_agent_id) {
          result.noOriginalAgent++;
          processed++;
          onProgress?.(processed, total);
          continue;
        }

        try {
          await processWithRetry(async () => {
            const { error } = await supabase.rpc('transfer_conversation', {
              p_conversation_id: conv.id,
              p_to_user_id: originalAgent.original_agent_id,
              p_to_department_id: originalAgent.original_department_id || null,
              p_note: 'Devolvido ao atendente original',
              p_force: false,
            });

            if (error) throw error;
          });
          
          result.success++;
        } catch (error: any) {
          result.failed++;
          result.errors.push(`${conv.id}: ${error.message}`);
        }

        processed++;
        onProgress?.(processed, total);
        
        // Small delay between each item
        await delay(100);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-report'] });
    },
  });
}

// Distribute conversations evenly among multiple agents
export function useBulkDistribute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationIds,
      targetUserIds,
      targetUserNames,
      departmentId,
      note,
      onProgress,
    }: {
      conversationIds: string[];
      targetUserIds: string[];
      targetUserNames: Record<string, string>;
      departmentId: string;
      note?: string;
      onProgress?: (processed: number, total: number) => void;
    }): Promise<DistributeResult> => {
      const result: DistributeResult = {
        success: 0,
        failed: 0,
        errors: [],
        distributions: [],
      };

      if (targetUserIds.length === 0) {
        throw new Error('Selecione pelo menos um vendedor para distribuição');
      }

      // 1. Shuffle conversations for random distribution
      const shuffled = shuffleArray(conversationIds);

      // 2. Distribute via round-robin
      const assignments = new Map<string, string[]>();
      targetUserIds.forEach(id => assignments.set(id, []));

      shuffled.forEach((convId, index) => {
        const targetUser = targetUserIds[index % targetUserIds.length];
        assignments.get(targetUser)!.push(convId);
      });

      const total = conversationIds.length;
      let processed = 0;

      // 3. Process SEQUENTIALLY with delays per vendor
      for (const [userId, convIds] of assignments) {
        let successCount = 0;
        
        for (const convId of convIds) {
          try {
            await processWithRetry(async () => {
              const { error } = await supabase.rpc('transfer_conversation', {
                p_conversation_id: convId,
                p_to_user_id: userId,
                p_to_department_id: departmentId,
                p_note: note || 'Distribuição em massa',
                p_force: false,
              });

              if (error) throw error;
            });

            result.success++;
            successCount++;
          } catch (error: any) {
            result.failed++;
            result.errors.push(`${convId}: ${error.message}`);
          }

          processed++;
          onProgress?.(processed, total);
          
          // Small delay between each item
          await delay(100);
        }

        result.distributions.push({
          userId,
          userName: targetUserNames[userId] || 'Usuário',
          count: successCount,
        });

        // Additional delay between vendors
        await delay(300);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-report'] });
    },
  });
}

// Close conversations in bulk
export function useBulkCloseConversations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationIds,
      closeReason,
      onProgress,
    }: {
      conversationIds: string[];
      closeReason?: string;
      onProgress?: (processed: number, total: number) => void;
    }): Promise<BulkActionResult> => {
      const result: BulkActionResult = {
        success: 0,
        failed: 0,
        errors: [],
      };

      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      const total = conversationIds.length;
      let processed = 0;

      // Close is a lighter operation - can use smaller parallel chunks
      const chunks = chunkArray(conversationIds, 5);

      for (const chunk of chunks) {
        const promises = chunk.map(async (convId) => {
          try {
            const { error } = await supabase
              .from('conversations')
              .update({
                status: 'closed',
                closed_at: now,
                closed_by: user?.id || null,
                close_reason: closeReason || null,
              })
              .eq('id', convId);

            if (error) {
              result.failed++;
              result.errors.push(`${convId}: ${error.message}`);
            } else {
              // Insert close event
              await supabase.from('conversation_events').insert({
                conversation_id: convId,
                event_type: 'closed',
                actor_id: user?.id,
                data: { reason: closeReason || null, bulk: true },
              });
              result.success++;
            }
          } catch (error: any) {
            result.failed++;
            result.errors.push(`${convId}: ${error.message}`);
          }
        });

        await Promise.all(promises);
        
        processed += chunk.length;
        onProgress?.(processed, total);
        
        // Delay between chunks
        await delay(200);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-report'] });
    },
  });
}

// Add tag to contacts in bulk
export function useBulkAddTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactIds,
      tagId,
      onProgress,
    }: {
      contactIds: string[];
      tagId: string;
      onProgress?: (processed: number, total: number) => void;
    }): Promise<BulkActionResult> => {
      const result: BulkActionResult = {
        success: 0,
        failed: 0,
        errors: [],
      };

      // Fetch tenant_id from logged-in user's profile
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      const tenantId = profile?.tenant_id;
      if (!tenantId) throw new Error('Tenant não encontrado');

      // Use upsert to avoid duplicates
      const inserts = contactIds.map(contactId => ({
        contact_id: contactId,
        tag_id: tagId,
        tenant_id: tenantId,
      }));

      const chunks = chunkArray(inserts, 50);
      const total = chunks.length;
      let processed = 0;

      for (const chunk of chunks) {
        try {
          const { error } = await supabase
            .from('contact_tags')
            .upsert(chunk as any, { onConflict: 'contact_id,tag_id', ignoreDuplicates: true });

          if (error) {
            result.failed += chunk.length;
            result.errors.push(error.message);
          } else {
            result.success += chunk.length;
          }
        } catch (error: any) {
          result.failed += chunk.length;
          result.errors.push(error.message);
        }
        
        processed++;
        onProgress?.(processed, total);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-tags'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-report'] });
    },
  });
}

// Remove tag from contacts in bulk
export function useBulkRemoveTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactIds,
      tagId,
    }: {
      contactIds: string[];
      tagId: string;
    }): Promise<BulkActionResult> => {
      const result: BulkActionResult = {
        success: 0,
        failed: 0,
        errors: [],
      };

      try {
        const { error, count } = await supabase
          .from('contact_tags')
          .delete()
          .in('contact_id', contactIds)
          .eq('tag_id', tagId);

        if (error) {
          result.failed = contactIds.length;
          result.errors.push(error.message);
        } else {
          result.success = count || contactIds.length;
        }
      } catch (error: any) {
        result.failed = contactIds.length;
        result.errors.push(error.message);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-tags'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-report'] });
    },
  });
}

// Update lead status in bulk
export function useBulkUpdateLeadStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactIds,
      leadStatus,
      onProgress,
    }: {
      contactIds: string[];
      leadStatus: string;
      onProgress?: (processed: number, total: number) => void;
    }): Promise<BulkActionResult> => {
      const result: BulkActionResult = {
        success: 0,
        failed: 0,
        errors: [],
      };

      const chunks = chunkArray(contactIds, 50);
      const total = chunks.length;
      let processed = 0;

      for (const chunk of chunks) {
        try {
          const { error, count } = await supabase
            .from('contacts')
            .update({ lead_status: leadStatus })
            .in('id', chunk);

          if (error) {
            result.failed += chunk.length;
            result.errors.push(error.message);
          } else {
            result.success += count || chunk.length;
          }
        } catch (error: any) {
          result.failed += chunk.length;
          result.errors.push(error.message);
        }
        
        processed++;
        onProgress?.(processed, total);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-report'] });
    },
  });
}

// Reopen conversations in bulk
export function useBulkReopenConversations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationIds,
      onProgress,
    }: {
      conversationIds: string[];
      onProgress?: (processed: number, total: number) => void;
    }): Promise<BulkActionResult> => {
      const result: BulkActionResult = {
        success: 0,
        failed: 0,
        errors: [],
      };

      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      const total = conversationIds.length;
      let processed = 0;

      // Process SEQUENTIALLY with delays
      for (const convId of conversationIds) {
        try {
          // First get current reopen_count
          const { data: conv } = await supabase
            .from('conversations')
            .select('reopen_count')
            .eq('id', convId)
            .single();

          const currentCount = conv?.reopen_count || 0;

          const { error } = await supabase
            .from('conversations')
            .update({
              status: 'open',
              reopened_at: now,
              reopen_count: currentCount + 1,
              closed_at: null,
              closed_by: null,
              close_reason: null,
            })
            .eq('id', convId);

          if (error) {
            result.failed++;
            result.errors.push(`${convId}: ${error.message}`);
          } else {
            // Insert reopen event
            await supabase.from('conversation_events').insert({
              conversation_id: convId,
              event_type: 'reopened',
              actor_id: user?.id,
              data: { bulk: true },
            });
            result.success++;
          }
        } catch (error: any) {
          result.failed++;
          result.errors.push(`${convId}: ${error.message}`);
        }

        processed++;
        onProgress?.(processed, total);
        
        // Small delay between each item
        await delay(100);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-report'] });
    },
  });
}
