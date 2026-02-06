import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser, useCurrentUserProfile } from './useCurrentUser';
import { triggerFlowOnTagAdded } from '@/lib/triggerFlowOnTagAdded';
// ============ Standalone Functions ============

// Random colors for auto-created tags
const TAG_COLORS = ['#8B5CF6', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#EC4899', '#06B6D4', '#84CC16'];

export async function findTagByName(name: string) {
  const { data } = await supabase
    .from('tags')
    .select('*')
    .ilike('name', name.trim())
    .maybeSingle();
  
  return data;
}

export async function findOrCreateTag(name: string, preferredColor?: string): Promise<{ id: string; name: string; color: string; isNew?: boolean } & Record<string, any>> {
  const existing = await findTagByName(name);
  if (existing) return { ...existing, isNew: false };
  
  const { data: { user } } = await supabase.auth.getUser();
  const color = preferredColor || TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
  
  // IMPORTANT: tenant_id must be null to let the database trigger assign it correctly
  // This fixes RLS "Tenant isolation for tags" errors during import
  const { data, error } = await supabase
    .from('tags')
    .insert({ 
      name: name.trim(), 
      color, 
      visibility: 'public',
      created_by: user?.id,
      tenant_id: null, // Let trigger set tenant_id from authenticated user
    } as any)
    .select()
    .single();
  
  if (error) throw error;
  return { ...data, isNew: true };
}

// ============ Types ============

export type TagVisibility = 'public' | 'private' | 'department';

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  usage_count: number | null;
  created_at: string;
  visibility: TagVisibility;
  created_by: string | null;
  department_id: string | null;
  order_position: number | null;
  department?: { id: string; name: string } | null;
  creator?: { id: string; full_name: string | null } | null;
}

export interface CreateTagInput {
  name: string;
  color?: string | null;
  description?: string | null;
  visibility?: TagVisibility;
  department_id?: string | null;
}

// OTIMIZAÇÃO: Usa hooks centralizados para evitar chamadas duplicadas
export function useTags() {
  const { data: currentUser } = useCurrentUser();
  const { data: profile } = useCurrentUserProfile();

  return useQuery({
    queryKey: ['tags', currentUser?.id],
    staleTime: 2 * 60 * 1000, // OTIMIZAÇÃO: 2 minutos de cache
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!currentUser?.id) return [];

      // Apply visibility filter
      const conditions = ['visibility.eq.public'];
      conditions.push(`and(visibility.eq.private,created_by.eq.${currentUser.id})`);
      if (profile?.department_id) {
        conditions.push(`and(visibility.eq.department,department_id.eq.${profile.department_id})`);
      }

      const { data, error } = await supabase
        .from('tags')
        .select(`
          *,
          department:departments(id, name),
          creator:profiles!tags_created_by_fkey(id, full_name)
        `)
        .or(conditions.join(','))
        .order('order_position', { ascending: true, nullsFirst: false })
        .order('name');

      if (error) throw error;
      return data as Tag[];
    },
    enabled: !!currentUser?.id,
  });
}

// Fetch all tags (for admins)
export function useAllTags() {
  return useQuery({
    queryKey: ['all-tags'],
    staleTime: 60000, // 1 minute cache
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select(`
          *,
          department:departments(id, name),
          creator:profiles!tags_created_by_fkey(id, full_name)
        `)
        .order('order_position', { ascending: true, nullsFirst: false })
        .order('name');

      if (error) throw error;
      return data as Tag[];
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tag: CreateTagInput) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Obter tenant_id do usuário logado
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      const { data, error } = await supabase
        .from('tags')
        .insert({
          name: tag.name,
          color: tag.color || '#8B5CF6',
          description: tag.description,
          visibility: tag.visibility || 'public',
          department_id: tag.visibility === 'department' ? tag.department_id : null,
          created_by: user?.id,
          tenant_id: profile?.tenant_id, // CRÍTICO: Incluir tenant_id
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['all-tags'] });
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...tag }: Partial<Tag> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (tag.name !== undefined) updateData.name = tag.name;
      if (tag.color !== undefined) updateData.color = tag.color;
      if (tag.description !== undefined) updateData.description = tag.description;
      if (tag.visibility !== undefined) updateData.visibility = tag.visibility;
      if (tag.department_id !== undefined) updateData.department_id = tag.department_id;

      const { error } = await supabase
        .from('tags')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['all-tags'] });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['all-tags'] });
    },
  });
}

export function useAddTagToContact() {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentUserProfile();

  return useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: string; tagId: string }) => {
      const { error } = await supabase
        .from('contact_tags')
        .upsert({ contact_id: contactId, tag_id: tagId } as any, { onConflict: 'contact_id,tag_id', ignoreDuplicates: true });

      if (error) throw error;

      // Disparar automações de tag_added
      if (profile?.tenant_id) {
        triggerFlowOnTagAdded(profile.tenant_id, contactId, tagId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
    },
  });
}

export function useRemoveTagFromContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: string; tagId: string }) => {
      const { error } = await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId)
        .eq('tag_id', tagId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
    },
  });
}

export function useReorderTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { id: string; order_position: number }[]) => {
      const promises = updates.map(({ id, order_position }) =>
        supabase.from('tags').update({ order_position } as any).eq('id', id)
      );
      const results = await Promise.all(promises);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['all-tags'] });
    },
  });
}
