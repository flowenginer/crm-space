import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { useState, useCallback, useEffect } from 'react';

export interface ContactSearchResult {
  id: string;
  full_name: string;
  phone: string;
  avatar_url: string | null;
  conversationId?: string;
}

export interface MessageSearchResult {
  messageId: string;
  conversationId: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  matchHighlight: string;
  content: string;
  createdAt: string;
  isFromMe: boolean;
}

export interface GlobalSearchResults {
  contacts: ContactSearchResult[];
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

  // Search contacts
  const contactsQuery = useQuery({
    queryKey: ['global-search-contacts', debouncedSearchTerm],
    enabled: shouldSearch,
    staleTime: 30000, // 30s cache
    queryFn: async (): Promise<ContactSearchResult[]> => {
      // Use the existing RPC for contact search
      const { data: contacts, error } = await supabase
        .rpc('search_contacts_unaccent', {
          p_search_query: debouncedSearchTerm,
          p_limit: 20,
        });

      if (error) {
        console.error('Error searching contacts:', error);
        return [];
      }

      if (!contacts || contacts.length === 0) return [];

      // Get conversations for these contacts with filters applied
      const contactIds = contacts.map((c: any) => c.id);
      let query = supabase
        .from('conversations')
        .select('id, contact_id, assigned_to, department_id, channel_id, status, referral_source')
        .in('contact_id', contactIds)
        .order('last_message_at', { ascending: false });

      // Apply filters to conversations
      if (filters) {
        if (filters.statusFilter && filters.statusFilter !== 'all') {
          if (filters.statusFilter === 'active') {
            query = query.in('status', ['open', 'pending']);
          } else {
            query = query.eq('status', filters.statusFilter);
          }
        }
        if (filters.channelId) {
          query = query.eq('channel_id', filters.channelId);
        }
        if (filters.departmentId) {
          query = query.eq('department_id', filters.departmentId);
        }
        if (filters.agentId) {
          query = query.eq('assigned_to', filters.agentId);
        }
        if (filters.assignment === 'mine' && filters.currentUserId) {
          query = query.eq('assigned_to', filters.currentUserId);
        }
        if (filters.assignment === 'unassigned') {
          query = query.is('assigned_to', null);
        }
        if (filters.origin && filters.origin !== 'all') {
          query = query.eq('referral_source', filters.origin);
        }
      }

      const { data: conversations } = await query;

      // Map conversations to contacts - only include contacts with matching conversations
      const convMap = new Map<string, string>();
      conversations?.forEach((conv: any) => {
        if (!convMap.has(conv.contact_id)) {
          convMap.set(conv.contact_id, conv.id);
        }
      });

      // If filters are applied, only return contacts that have matching conversations
      const hasActiveFilters = filters && (
        filters.assignment !== 'all' ||
        filters.statusFilter !== 'all' ||
        filters.channelId ||
        filters.departmentId ||
        filters.agentId ||
        (filters.origin && filters.origin !== 'all')
      );

      const filteredContacts = hasActiveFilters
        ? contacts.filter((c: any) => convMap.has(c.id))
        : contacts;

      return filteredContacts.map((contact: any) => ({
        id: contact.id,
        full_name: contact.full_name,
        phone: contact.phone,
        avatar_url: contact.avatar_url,
        conversationId: convMap.get(contact.id),
      }));
    },
  });

  // Search messages with pagination and filters
  const messagesQuery = useQuery({
    queryKey: ['global-search-messages', debouncedSearchTerm, messageLimit, filters],
    enabled: shouldSearch,
    staleTime: 30000, // 30s cache
    queryFn: async (): Promise<{ messages: MessageSearchResult[]; hasMore: boolean }> => {
      // First get messages using existing RPC
      const { data, error } = await supabase
        .rpc('search_messages_global', {
          p_search_term: debouncedSearchTerm,
          p_limit: 500, // Get more to filter client-side
        });

      if (error) {
        console.error('Error searching messages:', error);
        return { messages: [], hasMore: false };
      }

      if (!data) return { messages: [], hasMore: false };

      // Apply filters client-side if needed
      let filteredData = data;
      
      if (filters) {
        // Get conversation details to apply filters
        const conversationIds = [...new Set(data.map((msg: any) => msg.conversation_id))];
        
        if (conversationIds.length > 0) {
          let convQuery = supabase
            .from('conversations')
            .select('id, assigned_to, department_id, channel_id, status, referral_source, contacts!inner(lead_status)')
            .in('id', conversationIds);

          // Apply filters to conversations query
          if (filters.statusFilter && filters.statusFilter !== 'all') {
            // Handle 'active' as filter for 'open' or 'pending' status
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

          const { data: matchingConversations } = await convQuery;
          const matchingIds = new Set(matchingConversations?.map((c: any) => c.id) || []);
          
          // Filter messages to only include those from matching conversations
          filteredData = data.filter((msg: any) => matchingIds.has(msg.conversation_id));
        }
      }

      const hasMore = filteredData.length > messageLimit;
      const messagesData = filteredData.slice(0, messageLimit);

      const messages = messagesData.map((msg: any) => ({
        messageId: msg.message_id,
        conversationId: msg.conversation_id,
        contactId: msg.contact_id,
        contactName: msg.contact_name,
        contactPhone: msg.contact_phone,
        matchHighlight: msg.match_highlight || msg.content?.substring(0, 80),
        content: msg.content,
        createdAt: msg.created_at,
        isFromMe: msg.is_from_me,
      }));

      return { messages, hasMore };
    },
  });

  // Load more messages
  const loadMoreMessages = useCallback(async () => {
    setIsLoadingMore(true);
    setMessageLimit(prev => prev + MESSAGES_PER_PAGE);
    // Wait a bit for the query to refetch
    setTimeout(() => setIsLoadingMore(false), 500);
  }, []);

  const results: GlobalSearchResults = {
    contacts: contactsQuery.data || [],
    messages: messagesQuery.data?.messages || [],
  };

  const hasMoreMessages = messagesQuery.data?.hasMore || false;
  const isLoading = contactsQuery.isLoading || messagesQuery.isLoading;
  const hasResults = results.contacts.length > 0 || results.messages.length > 0;

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
