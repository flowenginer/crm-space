import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { useState, useCallback } from 'react';

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

const MIN_SEARCH_LENGTH = 3;
const MESSAGES_PER_PAGE = 50;

export function useGlobalSearch(searchTerm: string, enabled: boolean = true) {
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const shouldSearch = enabled && debouncedSearchTerm.length >= MIN_SEARCH_LENGTH;
  
  // Pagination state for messages
  const [messageLimit, setMessageLimit] = useState(MESSAGES_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Reset pagination when search term changes
  const resetPagination = useCallback(() => {
    setMessageLimit(MESSAGES_PER_PAGE);
  }, []);

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

      // Get conversations for these contacts
      const contactIds = contacts.map((c: any) => c.id);
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, contact_id')
        .in('contact_id', contactIds)
        .order('last_message_at', { ascending: false });

      // Map conversations to contacts
      const convMap = new Map<string, string>();
      conversations?.forEach((conv: any) => {
        if (!convMap.has(conv.contact_id)) {
          convMap.set(conv.contact_id, conv.id);
        }
      });

      return contacts.map((contact: any) => ({
        id: contact.id,
        full_name: contact.full_name,
        phone: contact.phone,
        avatar_url: contact.avatar_url,
        conversationId: convMap.get(contact.id),
      }));
    },
  });

  // Search messages with pagination
  const messagesQuery = useQuery({
    queryKey: ['global-search-messages', debouncedSearchTerm, messageLimit],
    enabled: shouldSearch,
    staleTime: 30000, // 30s cache
    queryFn: async (): Promise<{ messages: MessageSearchResult[]; hasMore: boolean }> => {
      // Fetch one extra to know if there are more results
      const { data, error } = await supabase
        .rpc('search_messages_global', {
          p_search_term: debouncedSearchTerm,
          p_limit: messageLimit + 1,
        });

      if (error) {
        console.error('Error searching messages:', error);
        return { messages: [], hasMore: false };
      }

      if (!data) return { messages: [], hasMore: false };

      const hasMore = data.length > messageLimit;
      const messagesData = hasMore ? data.slice(0, messageLimit) : data;

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
