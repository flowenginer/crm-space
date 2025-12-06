import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

export async function findOrCreateTag(name: string) {
  const existing = await findTagByName(name);
  if (existing) return existing;
  
  const { data: { user } } = await supabase.auth.getUser();
  const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
  
  const { data, error } = await supabase
    .from('tags')
    .insert({ 
      name: name.trim(), 
      color, 
      visibility: 'public',
      created_by: user?.id,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
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

// Fetch tags with visibility filtering
export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    staleTime: 60000, // 1 minute cache
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get user's department
      const { data: profile } = await supabase
        .from('profiles')
        .select('department_id')
        .eq('id', user.id)
        .maybeSingle();

      // Build query with visibility filter
      // Public tags OR private tags created by user OR department tags for user's department
      let query = supabase
        .from('tags')
        .select(`
          *,
          department:departments(id, name),
          creator:profiles!tags_created_by_fkey(id, full_name)
        `)
        .order('name');

      // Apply visibility filter
      const conditions = ['visibility.eq.public'];
      conditions.push(`and(visibility.eq.private,created_by.eq.${user.id})`);
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
        .order('name');

      if (error) throw error;
      return data as Tag[];
    },
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
      
      const { data, error } = await supabase
        .from('tags')
        .insert({
          name: tag.name,
          color: tag.color || '#8B5CF6',
          description: tag.description,
          visibility: tag.visibility || 'public',
          department_id: tag.visibility === 'department' ? tag.department_id : null,
          created_by: user?.id,
        })
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

  return useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: string; tagId: string }) => {
      const { error } = await supabase
        .from('contact_tags')
        .insert({ contact_id: contactId, tag_id: tagId });

      if (error) throw error;
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
