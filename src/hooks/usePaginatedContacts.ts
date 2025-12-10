import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Contact } from './useContacts';

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

export interface PaginationParams {
  page: number;
  perPage: number;
}

// Hook principal com paginação direta no servidor
export function usePaginatedContacts(filters: ContactFilters, pagination: PaginationParams) {
  const { 
    searchQuery, 
    stateFilter, 
    statusFilter, 
    assignedTo, 
    tagIds, 
    departmentId 
  } = filters;

  const { page, perPage } = pagination;
  const offset = (page - 1) * perPage;

  return useQuery({
    queryKey: [
      'contacts-paginated', 
      searchQuery, 
      stateFilter, 
      statusFilter, 
      assignedTo, 
      tagIds?.join(','), 
      departmentId,
      page,
      perPage
    ],
    queryFn: async () => {
      console.log(`[usePaginatedContacts] Buscando página ${page}, offset ${offset}, limit ${perPage}`);

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
            p_offset: offset,
            p_limit: perPage,
          }
        );

        if (rpcError) {
          console.error('[usePaginatedContacts] RPC Error:', rpcError);
          throw rpcError;
        }

        console.log(`[usePaginatedContacts] RPC retornou ${taggedContactIds?.length || 0} contatos`);

        if (!taggedContactIds || taggedContactIds.length === 0) {
          return {
            contacts: [] as Contact[],
            totalCount: 0,
          };
        }

        // Pega o total_count da primeira linha (todas têm o mesmo valor)
        const totalCount = taggedContactIds[0]?.total_count || 0;
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

        console.log(`[usePaginatedContacts] Retornando ${contactsWithTags.length} contatos, total: ${totalCount}`);

        return {
          contacts: contactsWithTags as Contact[],
          totalCount: Number(totalCount),
        };
      }

      // Query usando RPC com unaccent para busca insensível a acentos
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'search_contacts_paginated',
        {
          p_search_query: searchQuery || null,
          p_state_filter: stateFilter || null,
          p_status_filter: statusFilter || null,
          p_assigned_to: assignedTo || null,
          p_department_id: departmentId || null,
          p_offset: offset,
          p_limit: perPage,
        }
      );

      if (rpcError) {
        console.error('[usePaginatedContacts] RPC Error:', rpcError);
        throw rpcError;
      }

      if (!rpcData || rpcData.length === 0) {
        return {
          contacts: [] as Contact[],
          totalCount: 0,
        };
      }

      // Pega o total_count da primeira linha
      const totalCount = rpcData[0]?.total_count || 0;
      const contactIds = rpcData.map((r: { id: string }) => r.id);

      // Buscar dados relacionados (assignee e department)
      const { data: relatedData } = await supabase
        .from('contacts')
        .select(`
          id,
          assignee:profiles!contacts_assigned_to_fkey(id, full_name),
          department:departments(id, name)
        `)
        .in('id', contactIds);

      // Criar mapa de dados relacionados
      const relatedMap: Record<string, { assignee: any; department: any }> = {};
      relatedData?.forEach(r => {
        relatedMap[r.id] = { assignee: r.assignee, department: r.department };
      });

      // Buscar tags dos contatos retornados
      let contactsWithTags = rpcData;

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

        contactsWithTags = rpcData.map((contact: any) => ({
          ...contact,
          assignee: relatedMap[contact.id]?.assignee || null,
          department: relatedMap[contact.id]?.department || null,
          tags: tagMap[contact.id] || []
        }));
      }

      console.log(`[usePaginatedContacts] Retornando ${contactsWithTags.length} contatos, total: ${totalCount}`);

      return {
        contacts: contactsWithTags as Contact[],
        totalCount: Number(totalCount),
      };
    },
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
      // Se tem filtro de tags, usa a RPC que já retorna o total_count
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
            p_offset: 0,
            p_limit: 1, // Só precisa de 1 para pegar o total_count
          }
        );

        if (rpcError) throw rpcError;
        
        // Se não tem resultados, busca contagem via query alternativa
        if (!taggedContactIds || taggedContactIds.length === 0) {
          return 0;
        }
        
        return Number(taggedContactIds[0]?.total_count || 0);
      }

      // Usa a mesma RPC com limit 1 para pegar o total
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'search_contacts_paginated',
        {
          p_search_query: searchQuery || null,
          p_state_filter: stateFilter || null,
          p_status_filter: statusFilter || null,
          p_assigned_to: assignedTo || null,
          p_department_id: departmentId || null,
          p_offset: 0,
          p_limit: 1,
        }
      );

      if (rpcError) throw rpcError;

      if (!rpcData || rpcData.length === 0) {
        // Se não retornou resultados, precisa contar de outra forma
        const { count, error } = await supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true });
        
        if (error) throw error;
        return count || 0;
      }
      
      return Number(rpcData[0]?.total_count || 0);
    },
    staleTime: 30000,
  });
}
