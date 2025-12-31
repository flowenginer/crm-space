import { supabase } from '@/integrations/supabase/client';

/**
 * Dispara automações configuradas para o evento de tag adicionada
 */
export async function triggerFlowOnTagAdded(
  tenantId: string, 
  contactId: string, 
  tagId: string
): Promise<void> {
  try {
    console.log('[triggerFlowOnTagAdded] Disparando automação para tag:', tagId.substring(0, 8));
    
    const { error } = await supabase.functions.invoke('process-flow-triggers', {
      body: {
        trigger_type: 'tag_added',
        tenant_id: tenantId,
        contact_id: contactId,
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
