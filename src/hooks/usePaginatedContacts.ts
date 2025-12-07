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

      // FILTRO POR TAGS - busca server-side
      if (tagIds && tagIds.length > 0) {
        const { data: taggedContacts } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', tagIds);

        if (taggedContacts && taggedContacts.length > 0) {
          const contactIds = [...new Set(taggedContacts.map(tc => tc.contact_id))];
          query = query.in('id', contactIds);
        } else {
          // Nenhum contato com essas tags
          return {
            contacts: [] as Contact[],
            nextPage: undefined,
            pageParam: 0,
            totalCount: 0,
          };
        }
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

// Hook para buscar contagens dos filtros - direto do servidor
export function useContactsFilterCounts() {
  return useQuery({
    queryKey: ['contacts-filter-counts'],
    queryFn: async () => {
      // Buscar contagens por estado
      const { data: byStateData } = await supabase
        .from('contacts')
        .select('state')
        .not('state', 'is', null);

      // Buscar contagens por status
      const { data: byStatusData } = await supabase
        .from('contacts')
        .select('lead_status');

      // Buscar contagens por responsável
      const { data: byAssigneeData } = await supabase
        .from('contacts')
        .select('assigned_to')
        .not('assigned_to', 'is', null);

      // Processar contagens
      const byState: Record<string, number> = {};
      byStateData?.forEach(c => {
        if (c.state) {
          byState[c.state] = (byState[c.state] || 0) + 1;
        }
      });

      const byStatus: Record<string, number> = {};
      byStatusData?.forEach(c => {
        const status = c.lead_status || 'sem_status';
        byStatus[status] = (byStatus[status] || 0) + 1;
      });

      const byAssignee: Record<string, number> = {};
      byAssigneeData?.forEach(c => {
        if (c.assigned_to) {
          byAssignee[c.assigned_to] = (byAssignee[c.assigned_to] || 0) + 1;
        }
      });

      return { byState, byStatus, byAssignee };
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
