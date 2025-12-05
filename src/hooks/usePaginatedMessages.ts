import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Message, MessageReaction } from './useConversations';

const PAGE_SIZE = 50;

// Campos otimizados para mensagens
const MESSAGE_FIELDS = `
  id,
  conversation_id,
  sender_id,
  contact_id,
  is_from_me,
  content,
  message_type,
  media_url,
  media_mime_type,
  status,
  whatsapp_message_id,
  created_at,
  reply_to_message_id,
  reactions,
  is_deleted,
  deleted_at
`;

export function usePaginatedMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  return useInfiniteQuery({
    queryKey: ['messages-paginated', conversationId],
    queryFn: async ({ pageParam }) => {
      if (!conversationId) return { messages: [], nextCursor: undefined, hasMore: false };
      
      let query = supabase
        .from('messages')
        .select(MESSAGE_FIELDS)
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      // Para paginação cursor-based: buscar mensagens mais antigas que o cursor
      if (pageParam) {
        query = query.lt('created_at', pageParam);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Mapear para o tipo Message
      const messages: Message[] = (data || []).map(m => ({
        ...m,
        reactions: (m.reactions as unknown as MessageReaction[]) || null,
        reply_to: null,
      }));

      // Buscar replies se existirem
      const replyIds = messages.filter(m => m.reply_to_message_id).map(m => m.reply_to_message_id!);
      
      if (replyIds.length > 0) {
        const { data: replyMessages } = await supabase
          .from('messages')
          .select(MESSAGE_FIELDS)
          .in('id', replyIds);
        
        const replyMap = new Map((replyMessages || []).map(m => [m.id, {
          ...m,
          reactions: (m.reactions as unknown as MessageReaction[]) || null,
          reply_to: null,
        } as Message]));
        
        messages.forEach(m => {
          if (m.reply_to_message_id && replyMap.has(m.reply_to_message_id)) {
            m.reply_to = [replyMap.get(m.reply_to_message_id)!];
          }
        });
      }

      // Cursor para próxima página é o created_at da mensagem mais antiga
      const oldestMessage = messages[messages.length - 1];
      const nextCursor = messages.length === PAGE_SIZE ? oldestMessage?.created_at : undefined;

      return {
        messages: messages.reverse(), // Reverter para ordem cronológica
        nextCursor,
        hasMore: messages.length === PAGE_SIZE,
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!conversationId,
    staleTime: 10000, // 10 seconds
  });
}

// Helper para obter todas as mensagens carregadas em ordem cronológica
export function getAllPaginatedMessages(pages: { messages: Message[] }[] | undefined): Message[] {
  if (!pages) return [];
  
  // Pages estão em ordem reversa (página mais recente primeiro)
  // Cada página já está em ordem cronológica, então precisamos concatenar páginas antigas primeiro
  const allMessages: Message[] = [];
  
  // Iterar de trás para frente (páginas mais antigas primeiro)
  for (let i = pages.length - 1; i >= 0; i--) {
    allMessages.push(...pages[i].messages);
  }
  
  return allMessages;
}
