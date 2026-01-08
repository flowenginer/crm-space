import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { useState, useCallback, useEffect } from 'react';

export interface MessageSearchResult {
  messageId: string;
  conversationId: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  contactAvatarUrl: string | null;
  matchHighlight: string;
  content: string;
  createdAt: string;
  isFromMe: boolean;
  /** Tipo de match: 'content' = termo encontrado na mensagem, 'contact' = mensagem pertence a contato que corresponde ao termo */
  matchType: 'content' | 'contact';
}

export interface GlobalSearchResults {
  messages: MessageSearchResult[];
}

/** Filtros aplicáveis à busca global */
export interface SearchFilters {
  /** Tipo de atribuição: all, mine, unassigned, pending */
  assignment?: 'all' | 'mine' | 'unassigned' | 'pending';
  /** ID do canal */
  channelId?: string;
  /** ID do departamento */
  departmentId?: string;
  /** ID do agente */
  agentId?: string;
  /** Origem: meta_ads, whatsapp, all */
  origin?: 'meta_ads' | 'whatsapp' | 'all';
  /** Status da conversa: active, open, pending, closed, all */
  statusFilter?: 'active' | 'open' | 'pending' | 'closed' | 'all';
  /** Status do lead */
  leadStatusFilter?: string;
  /** IDs das tags */
  tagIds?: string[];
  /** ID do usuário atual (para filtro "mine") */
  currentUserId?: string;
  /** Filtros de status de conversação: não lidas, não respondidas, etc. */
  isUnread?: boolean;
  isNotReplied?: boolean;
  isClientNotReplied?: boolean;
  /** Ordem de ordenação */
  sortOrder?: 'newest' | 'oldest';
}

const MIN_SEARCH_LENGTH = 3;
const MESSAGES_PER_PAGE = 50;

export function useGlobalSearch(
  searchTerm: string, 
  enabled: boolean = true,
  filters?: SearchFilters
) {
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const shouldSearch = enabled && debouncedSearchTerm.length >= MIN_SEARCH_LENGTH;
  
  // Pagination state for messages
  const [messageLimit, setMessageLimit] = useState(MESSAGES_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Reset pagination when search term changes
  const resetPagination = useCallback(() => {
    setMessageLimit(MESSAGES_PER_PAGE);
  }, []);

  // Reset pagination when search term changes
  useEffect(() => {
    setMessageLimit(MESSAGES_PER_PAGE);
  }, [debouncedSearchTerm]);

  // Unified search - messages by content OR by contact name/phone
  const messagesQuery = useQuery({
    queryKey: ['global-search-unified', debouncedSearchTerm, messageLimit, filters],
    enabled: shouldSearch,
    staleTime: 30000, // 30s cache
    queryFn: async (): Promise<{ messages: MessageSearchResult[]; hasMore: boolean }> => {
      // Step 1: Find contacts matching the search term (by name or phone)
      const { data: matchingContacts } = await supabase
        .rpc('search_contacts_unaccent', {
          p_search_query: debouncedSearchTerm,
          p_limit: 50,
        });

      const matchingContactIds = new Set<string>(
        (matchingContacts || []).map((c: any) => c.id)
      );

      // Create a map for quick contact data lookup
      const contactDataMap = new Map<string, { full_name: string; phone: string; avatar_url: string | null }>();
      (matchingContacts || []).forEach((c: any) => {
        contactDataMap.set(c.id, {
          full_name: c.full_name,
          phone: c.phone,
          avatar_url: c.avatar_url,
        });
      });

      // Step 2: Get messages by content match using existing RPC
      const { data: contentMessages, error } = await supabase
        .rpc('search_messages_global', {
          p_search_term: debouncedSearchTerm,
          p_limit: 300,
        });

      if (error) {
        console.error('Error searching messages:', error);
        return { messages: [], hasMore: false };
      }

      // Step 3: Get recent messages from matching contacts (if any found)
      let contactMessages: any[] = [];
      if (matchingContactIds.size > 0) {
        const { data: recentContactMsgs } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            is_from_me,
            conversation_id,
            conversations!inner (
              id,
              contact_id,
              assigned_to,
              department_id,
              channel_id,
              status,
              referral_source,
              contacts!inner (
                id,
                full_name,
                phone,
                avatar_url,
                lead_status
              )
            )
          `)
          .in('conversations.contact_id', Array.from(matchingContactIds))
          .order('created_at', { ascending: false })
          .limit(200);

        contactMessages = (recentContactMsgs || []).map((msg: any) => ({
          message_id: msg.id,
          conversation_id: msg.conversation_id,
          contact_id: msg.conversations?.contact_id,
          contact_name: msg.conversations?.contacts?.full_name,
          contact_phone: msg.conversations?.contacts?.phone,
          contact_avatar_url: msg.conversations?.contacts?.avatar_url,
          content: msg.content,
          created_at: msg.created_at,
          is_from_me: msg.is_from_me,
          match_highlight: msg.content?.substring(0, 100),
          _matchType: 'contact' as const,
          _conversation: msg.conversations,
        }));
      }

      // Step 4: Combine and deduplicate
      const seenMessageIds = new Set<string>();
      const allMessages: any[] = [];

      // Add contact messages first (they have priority)
      for (const msg of contactMessages) {
        if (!seenMessageIds.has(msg.message_id)) {
          seenMessageIds.add(msg.message_id);
          allMessages.push({ ...msg, _matchType: 'contact' });
        }
      }

      // Add content messages
      for (const msg of contentMessages || []) {
        if (!seenMessageIds.has(msg.message_id)) {
          seenMessageIds.add(msg.message_id);
          allMessages.push({ ...msg, _matchType: 'content' });
        }
      }

      // Step 5: Apply filters
      let filteredData = allMessages;
      
      if (filters) {
        // Get conversation details to apply filters
        const conversationIds = [...new Set(allMessages.map((msg: any) => msg.conversation_id))];
        
        if (conversationIds.length > 0) {
          let convQuery = supabase
            .from('conversations')
            .select('id, assigned_to, department_id, channel_id, status, referral_source, is_unread, last_message_is_from_me, contacts!inner(lead_status)')
            .in('id', conversationIds);

          // Apply filters to conversations query
          if (filters.statusFilter && filters.statusFilter !== 'all') {
            if (filters.statusFilter === 'active') {
              convQuery = convQuery.in('status', ['open', 'pending']);
            } else {
              convQuery = convQuery.eq('status', filters.statusFilter);
            }
          }
          if (filters.channelId) {
            convQuery = convQuery.eq('channel_id', filters.channelId);
          }
          if (filters.departmentId) {
            convQuery = convQuery.eq('department_id', filters.departmentId);
          }
          if (filters.agentId) {
            convQuery = convQuery.eq('assigned_to', filters.agentId);
          }
          if (filters.assignment === 'mine' && filters.currentUserId) {
            convQuery = convQuery.eq('assigned_to', filters.currentUserId);
          }
          if (filters.assignment === 'unassigned') {
            convQuery = convQuery.is('assigned_to', null);
          }
          if (filters.origin && filters.origin !== 'all') {
            convQuery = convQuery.eq('referral_source', filters.origin);
          }
          if (filters.leadStatusFilter) {
            convQuery = convQuery.eq('contacts.lead_status', filters.leadStatusFilter);
          }
          if (filters.isUnread) {
            convQuery = convQuery.eq('is_unread', true);
          }
          if (filters.isNotReplied) {
            convQuery = convQuery.eq('last_message_is_from_me', false);
          }
          if (filters.isClientNotReplied) {
            convQuery = convQuery.eq('last_message_is_from_me', true);
          }

          const { data: matchingConversations } = await convQuery;
          const matchingIds = new Set(matchingConversations?.map((c: any) => c.id) || []);
          
          // Filter messages to only include those from matching conversations
          filteredData = allMessages.filter((msg: any) => matchingIds.has(msg.conversation_id));
        }
      }
      
      // Apply sort order
      if (filters?.sortOrder === 'oldest') {
        filteredData.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      } else {
        // Default: newest first, but prioritize contact matches
        filteredData.sort((a: any, b: any) => {
          // Contact matches come first
          if (a._matchType === 'contact' && b._matchType !== 'contact') return -1;
          if (a._matchType !== 'contact' && b._matchType === 'contact') return 1;
          // Then by date
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      }

      const hasMore = filteredData.length > messageLimit;
      const messagesData = filteredData.slice(0, messageLimit);

      const messages: MessageSearchResult[] = messagesData.map((msg: any) => ({
        messageId: msg.message_id,
        conversationId: msg.conversation_id,
        contactId: msg.contact_id,
        contactName: msg.contact_name,
        contactPhone: msg.contact_phone,
        contactAvatarUrl: msg.contact_avatar_url || null,
        matchHighlight: msg.match_highlight || msg.content?.substring(0, 80),
        content: msg.content,
        createdAt: msg.created_at,
        isFromMe: msg.is_from_me,
        matchType: msg._matchType || 'content',
      }));

      return { messages, hasMore };
    },
  });

  // Load more messages
  const loadMoreMessages = useCallback(async () => {
    setIsLoadingMore(true);
    setMessageLimit(prev => prev + MESSAGES_PER_PAGE);
    setTimeout(() => setIsLoadingMore(false), 500);
  }, []);

  const results: GlobalSearchResults = {
    messages: messagesQuery.data?.messages || [],
  };

  const hasMoreMessages = messagesQuery.data?.hasMore || false;
  const isLoading = messagesQuery.isLoading;
  const hasResults = results.messages.length > 0;

  return {
    results,
    isLoading,
    hasResults,
    searchTerm: debouncedSearchTerm,
    isSearching: shouldSearch,
    // Pagination
    hasMoreMessages,
    isLoadingMore,
    loadMoreMessages,
    resetPagination,
  };
}
