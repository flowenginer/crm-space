import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

export interface ContentBlock {
  type: 'text' | 'media';
  content?: string;
  media_url?: string;
  media_type?: string;
}

export interface MessageTemplate {
  id: string;
  title: string;
  content: string;
  category: string | null;
  folder_id: string | null;
  variables: string[] | null;
  usage_count: number | null;
  is_favorite: boolean | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  media_url: string | null;
  media_type: string | null;
  media_name: string | null;
  content_blocks: ContentBlock[] | null;
  folder?: { id: string; name: string } | null;
}

export interface TemplateFolder {
  id: string;
  name: string;
  color: string | null;
  parent_id: string | null;
  created_at: string;
}

export function useTemplates(category?: string) {
  return useQuery({
    queryKey: ['templates', category],
    queryFn: async () => {
      let query = supabase
        .from('message_templates')
        .select(`
          *,
          folder:template_folders(id, name)
        `)
        .order('created_at', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Transform the data to properly type content_blocks
      return (data || []).map(item => ({
        ...item,
        content_blocks: item.content_blocks as unknown as ContentBlock[] | null,
      })) as MessageTemplate[];
    },
  });
}

export function useTemplateFolders() {
  return useQuery({
    queryKey: ['template_folders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('template_folders')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as TemplateFolder[];
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: {
      title: string;
      content: string;
      category?: string | null;
      folder_id?: string | null;
      variables?: string[] | null;
      media_url?: string | null;
      media_type?: string | null;
      media_name?: string | null;
      content_blocks?: ContentBlock[] | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('message_templates')
        .insert({
          title: template.title,
          content: template.content,
          category: template.category || 'messages',
          folder_id: template.folder_id,
          variables: template.variables || [],
          media_url: template.media_url || null,
          media_type: template.media_type || null,
          media_name: template.media_name || null,
          content_blocks: template.content_blocks as unknown as Json || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...template }: Partial<MessageTemplate> & { id: string }) => {
      // Cast content_blocks to Json for Supabase compatibility
      const updateData = {
        ...template,
        content_blocks: template.content_blocks as unknown as Json,
      };
      
      const { error } = await supabase
        .from('message_templates')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useIncrementTemplateUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: current } = await supabase
        .from('message_templates')
        .select('usage_count')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('message_templates')
        .update({ usage_count: (current?.usage_count || 0) + 1 })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useCreateTemplateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (folder: { name: string; color?: string | null; parent_id?: string | null }) => {
      const { data, error } = await supabase
        .from('template_folders')
        .insert(folder)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template_folders'] });
    },
  });
}
