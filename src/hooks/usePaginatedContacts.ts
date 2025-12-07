import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Contact } from './useContacts';

const PAGE_SIZE = 50;

// Campos otimizados
const CONTACT_FIELDS = `
  id,
  full_name,
  phone,
  email,
  state,
  city,
  lead_status,
  first_contact_at,
  last_interaction_at,
  assigned_to,
  department_id,
  avatar_url,
  is_online,
  created_at,
  updated_at,
  notes,
  cpf_cnpj,
  birth_date,
  street,
  number,
  complement,
  neighborhood,
  zip_code,
  country,
  person_type,
  origin,
  custom_fields
`;

export interface ContactFilters {
  searchQuery?: string;
  stateFilter?: string;
  statusFilter?: string;
  assignedTo?: string;
  tagIds?: string[];
  departmentId?: string;
}

export function usePaginatedContacts(filters: ContactFilters) {
  const { 
    searchQuery, 
    stateFilter, 
    statusFilter, 
    assignedTo, 
    tagIds, 
    departmentId 
  } = filters;

  return useInfiniteQuery({
    queryKey: [
      'contacts-paginated', 
      searchQuery, 
      stateFilter, 
      statusFilter, 
      assignedTo, 
      tagIds?.join(','), 
      departmentId
    ],
    queryFn: async ({ pageParam = 0 }) => {
      // Se tem filtro de tags, usa RPC para evitar limite de URL
      if (tagIds && tagIds.length > 0) {
        const { data: taggedContactIds, error: rpcError } = await supabase.rpc(
          'get_contacts_by_tag_filter',
          {
            p_tag_ids: tagIds,
            p_search_query: searchQuery || null,
            p_state_filter: stateFilter || null,
            p_status_filter: statusFilter || null,
            p_assigned_to: assignedTo || null,
            p_department_id: departmentId || null,
            p_offset: pageParam * PAGE_SIZE,
            p_limit: PAGE_SIZE,
          }
        );

        if (rpcError) throw rpcError;

        if (!taggedContactIds || taggedContactIds.length === 0) {
          return {
            contacts: [] as Contact[],
            nextPage: undefined,
            pageParam: 0,
            totalCount: 0,
          };
        }

        const contactIds = taggedContactIds.map((r: { contact_id: string }) => r.contact_id);
        
        // Busca os detalhes dos contatos
        const { data: contacts, error: contactsError } = await supabase
          .from('contacts')
          .select(`
            ${CONTACT_FIELDS},
            assignee:profiles!contacts_assigned_to_fkey(id, full_name),
            department:departments(id, name)
          `)
          .in('id', contactIds)
          .order('created_at', { ascending: false });

        if (contactsError) throw contactsError;

        // Buscar tags dos contatos
        let contactsWithTags = contacts || [];
        if (contactIds.length > 0) {
          const { data: contactTags } = await supabase
            .from('contact_tags')
            .select('contact_id, tag:tags(id, name, color)')
            .in('contact_id', contactIds);

          const tagMap: Record<string, { id: string; name: string; color: string | null }[]> = {};
          contactTags?.forEach(ct => {
            if (!tagMap[ct.contact_id]) tagMap[ct.contact_id] = [];
            if (ct.tag) tagMap[ct.contact_id].push(ct.tag as { id: string; name: string; color: string | null });
          });

          contactsWithTags = contacts?.map(contact => ({
            ...contact,
            tags: tagMap[contact.id] || []
          })) || [];
        }

        return {
          contacts: contactsWithTags as Contact[],
          nextPage: taggedContactIds.length === PAGE_SIZE ? pageParam + 1 : undefined,
          pageParam,
        };
      }

      // Query normal sem filtro de tags
      let query = supabase
        .from('contacts')
        .select(`
          ${CONTACT_FIELDS},
          assignee:profiles!contacts_assigned_to_fkey(id, full_name),
          department:departments(id, name)
        `);

      // BUSCA NO SERVIDOR - por nome, telefone ou email
      if (searchQuery && searchQuery.length >= 2) {
        query = query.or(
          `full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`
        );
      }

      // FILTRO POR ESTADO
      if (stateFilter) {
        query = query.eq('state', stateFilter);
      }

      // FILTRO POR STATUS DO LEAD
      if (statusFilter) {
        query = query.eq('lead_status', statusFilter);
      }

      // FILTRO POR RESPONSÁVEL
      if (assignedTo) {
        query = query.eq('assigned_to', assignedTo);
      }

      // FILTRO POR DEPARTAMENTO
      if (departmentId) {
        query = query.eq('department_id', departmentId);
      }

      // Ordenação e paginação
      query = query
        .order('created_at', { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      const { data, error } = await query;

      if (error) throw error;

      // Buscar tags dos contatos retornados
      const contactIds = data?.map(c => c.id) || [];
      let contactsWithTags = data || [];

      if (contactIds.length > 0) {
        const { data: contactTags } = await supabase
          .from('contact_tags')
          .select('contact_id, tag:tags(id, name, color)')
          .in('contact_id', contactIds);

        const tagMap: Record<string, { id: string; name: string; color: string | null }[]> = {};
        contactTags?.forEach(ct => {
          if (!tagMap[ct.contact_id]) tagMap[ct.contact_id] = [];
          if (ct.tag) tagMap[ct.contact_id].push(ct.tag as { id: string; name: string; color: string | null });
        });

        contactsWithTags = data?.map(contact => ({
          ...contact,
          tags: tagMap[contact.id] || []
        })) || [];
      }

      return {
        contacts: contactsWithTags as Contact[],
        nextPage: data?.length === PAGE_SIZE ? pageParam + 1 : undefined,
        pageParam,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 30000,
  });
}

// Hook para buscar contagens dos filtros - usando RPC para contagem agregada
export function useContactsFilterCounts() {
  return useQuery({
    queryKey: ['contacts-filter-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_contact_filter_counts');

      if (error) throw error;

      const result = data as { 
        byState?: Record<string, number>; 
        byStatus?: Record<string, number>; 
        byAssignee?: Record<string, number>;
        byTag?: Record<string, number>;
      } | null;

      return {
        byState: (result?.byState || {}) as Record<string, number>,
        byStatus: (result?.byStatus || {}) as Record<string, number>,
        byAssignee: (result?.byAssignee || {}) as Record<string, number>,
        byTag: (result?.byTag || {}) as Record<string, number>,
      };
    },
    staleTime: 60000, // 1 minute cache
  });
}

// Hook para contagem total com filtros aplicados
export function useFilteredContactsCount(filters: ContactFilters) {
  const { 
    searchQuery, 
    stateFilter, 
    statusFilter, 
    assignedTo, 
    tagIds, 
    departmentId 
  } = filters;

  return useQuery({
    queryKey: [
      'contacts-filtered-count', 
      searchQuery, 
      stateFilter, 
      statusFilter, 
      assignedTo, 
      tagIds?.join(','), 
      departmentId
    ],
    queryFn: async () => {
      let query = supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true });

      if (searchQuery && searchQuery.length >= 2) {
        query = query.or(
          `full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`
        );
      }

      if (stateFilter) {
        query = query.eq('state', stateFilter);
      }

      if (statusFilter) {
        query = query.eq('lead_status', statusFilter);
      }

      if (assignedTo) {
        query = query.eq('assigned_to', assignedTo);
      }

      if (departmentId) {
        query = query.eq('department_id', departmentId);
      }

      // Tags filter requires separate query
      if (tagIds && tagIds.length > 0) {
        const { data: taggedContacts } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', tagIds);

        if (taggedContacts && taggedContacts.length > 0) {
          const contactIds = [...new Set(taggedContacts.map(tc => tc.contact_id))];
          query = query.in('id', contactIds);
        } else {
          return 0;
        }
      }

      const { count, error } = await query;

      if (error) throw error;
      return count || 0;
    },
    staleTime: 30000,
  });
}
