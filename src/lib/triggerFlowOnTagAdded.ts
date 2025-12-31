import { supabase } from '@/integrations/supabase/client';

/**
 * Dispara automações configuradas para o evento de tag adicionada
 * IMPORTANTE: Busca canal/conversa existente para evitar criar duplicatas
 */
export async function triggerFlowOnTagAdded(
  tenantId: string, 
  contactId: string, 
  tagId: string
): Promise<void> {
  try {
    console.log('[triggerFlowOnTagAdded] Disparando automação para tag:', tagId.substring(0, 8));
    
    // BUSCAR CANAL E CONVERSA EXISTENTE DO CONTATO para não criar duplicatas
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id, channel_id')
      .eq('contact_id', contactId)
      .in('status', ['open', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const channelId = existingConversation?.channel_id || null;
    const conversationId = existingConversation?.id || null;
    
    console.log('[triggerFlowOnTagAdded] Canal encontrado:', channelId?.substring(0, 8) || 'nenhum', 'Conversa:', conversationId?.substring(0, 8) || 'nenhuma');
    
    const { error } = await supabase.functions.invoke('process-flow-triggers', {
      body: {
        trigger_type: 'tag_added',
        tenant_id: tenantId,
        contact_id: contactId,
        channel_id: channelId,
        conversation_id: conversationId,
        metadata: { tag_id: tagId }
      }
    });
    
    if (error) {
      console.error('[triggerFlowOnTagAdded] Erro ao invocar função:', error);
    }
  } catch (error) {
    console.error('[triggerFlowOnTagAdded] Erro:', error);
  }
}
