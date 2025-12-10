import { QueryClient } from '@tanstack/react-query';

/**
 * Helper functions para invalidação de queries agrupadas por contexto
 * Reduz chamadas individuais de invalidateQueries
 */

// Invalidar todas as queries relacionadas a conversas
export function invalidateConversationContext(queryClient: QueryClient, conversationId?: string) {
  const keysToInvalidate = [
    'conversations',
    'conversation_counts',
    'all_conversation_counts',
    'pinned_conversations',
  ];

  if (conversationId) {
    keysToInvalidate.push(`conversation_${conversationId}`);
    keysToInvalidate.push(`messages_${conversationId}`);
  }

  keysToInvalidate.forEach(key => {
    queryClient.invalidateQueries({ queryKey: [key], refetchType: 'active' });
  });
}

// Invalidar todas as queries relacionadas a contatos
export function invalidateContactContext(queryClient: QueryClient, contactId?: string) {
  const keysToInvalidate = [
    'contacts',
    'paginated_contacts',
    'contact_filter_counts',
  ];

  if (contactId) {
    keysToInvalidate.push(`contact_${contactId}`);
    keysToInvalidate.push(`contact_tags_${contactId}`);
  }

  keysToInvalidate.forEach(key => {
    queryClient.invalidateQueries({ queryKey: [key], refetchType: 'active' });
  });
}

// Invalidar todas as queries do dashboard
export function invalidateDashboardContext(queryClient: QueryClient) {
  queryClient.invalidateQueries({ 
    predicate: (query) => {
      const key = query.queryKey[0] as string;
      return key?.startsWith('dashboard') || 
             key?.startsWith('leads_by') || 
             key?.startsWith('timeline') ||
             key?.startsWith('funnel') ||
             key?.startsWith('agent_');
    },
    refetchType: 'active'
  });
}

// Invalidar queries de mensagens
export function invalidateMessagesContext(queryClient: QueryClient, conversationId: string) {
  queryClient.invalidateQueries({ 
    queryKey: ['messages', conversationId],
    refetchType: 'active'
  });
  queryClient.invalidateQueries({ 
    queryKey: ['paginated_messages', conversationId],
    refetchType: 'active'
  });
}

// Invalidar queries de tags
export function invalidateTagsContext(queryClient: QueryClient) {
  queryClient.invalidateQueries({ 
    predicate: (query) => {
      const key = query.queryKey[0] as string;
      return key?.includes('tag');
    },
    refetchType: 'active'
  });
}

// Invalidar queries de templates
export function invalidateTemplatesContext(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['templates'], refetchType: 'active' });
  queryClient.invalidateQueries({ queryKey: ['message_templates'], refetchType: 'active' });
}

// Invalidar queries de agentes/equipe
export function invalidateTeamContext(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['team'], refetchType: 'active' });
  queryClient.invalidateQueries({ queryKey: ['profiles'], refetchType: 'active' });
  queryClient.invalidateQueries({ queryKey: ['agents'], refetchType: 'active' });
}

// Invalidar queries de departamentos
export function invalidateDepartmentsContext(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['departments'], refetchType: 'active' });
  queryClient.invalidateQueries({ queryKey: ['user_departments'], refetchType: 'active' });
}

// Batch invalidation - para usar quando múltiplos contextos precisam ser atualizados
export function invalidateBatch(
  queryClient: QueryClient,
  contexts: ('conversations' | 'contacts' | 'dashboard' | 'tags' | 'templates' | 'team' | 'departments')[]
) {
  contexts.forEach(context => {
    switch (context) {
      case 'conversations':
        invalidateConversationContext(queryClient);
        break;
      case 'contacts':
        invalidateContactContext(queryClient);
        break;
      case 'dashboard':
        invalidateDashboardContext(queryClient);
        break;
      case 'tags':
        invalidateTagsContext(queryClient);
        break;
      case 'templates':
        invalidateTemplatesContext(queryClient);
        break;
      case 'team':
        invalidateTeamContext(queryClient);
        break;
      case 'departments':
        invalidateDepartmentsContext(queryClient);
        break;
    }
  });
}
