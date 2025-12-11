import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';

export interface UserQuickTemplate {
  id: string;
  user_id: string;
  template_id: string;
  position: number;
  created_at: string;
  template?: {
    id: string;
    title: string;
    content: string;
    category: string | null;
    media_url: string | null;
    media_type: string | null;
    media_name: string | null;
    content_blocks: any[] | null;
  };
}

export function useUserQuickTemplates() {
  const { data: currentUser } = useCurrentUser();

  return useQuery({
    queryKey: ['user-quick-templates', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];

      const { data, error } = await supabase
        .from('user_quick_templates')
        .select(`
          id,
          user_id,
          template_id,
          position,
          created_at,
          template:message_templates (
            id,
            title,
            content,
            category,
            media_url,
            media_type,
            media_name,
            content_blocks
          )
        `)
        .eq('user_id', currentUser.id)
        .order('position', { ascending: true });

      if (error) throw error;
      
      // Type assertion for the joined data
      return (data || []) as unknown as UserQuickTemplate[];
    },
    enabled: !!currentUser?.id,
  });
}

export function useAddQuickTemplate() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ templateId, position }: { templateId: string; position: number }) => {
      if (!currentUser?.id) throw new Error('User not authenticated');

      // First check if this position already has a template
      const { data: existing } = await supabase
        .from('user_quick_templates')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('position', position)
        .single();

      if (existing) {
        // Update existing position
        const { error } = await supabase
          .from('user_quick_templates')
          .update({ template_id: templateId })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('user_quick_templates')
          .insert({
            user_id: currentUser.id,
            template_id: templateId,
            position,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-quick-templates'] });
    },
  });
}

export function useRemoveQuickTemplate() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  return useMutation({
    mutationFn: async (position: number) => {
      if (!currentUser?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('user_quick_templates')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('position', position);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-quick-templates'] });
    },
  });
}

export function useSwapQuickTemplatePosition() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ fromPosition, toPosition }: { fromPosition: number; toPosition: number }) => {
      if (!currentUser?.id) throw new Error('User not authenticated');

      // Get both templates
      const { data: templates } = await supabase
        .from('user_quick_templates')
        .select('id, position, template_id')
        .eq('user_id', currentUser.id)
        .in('position', [fromPosition, toPosition]);

      if (!templates || templates.length === 0) return;

      const fromTemplate = templates.find(t => t.position === fromPosition);
      const toTemplate = templates.find(t => t.position === toPosition);

      if (fromTemplate && toTemplate) {
        // Swap: delete both and re-insert with swapped positions
        await supabase
          .from('user_quick_templates')
          .delete()
          .eq('user_id', currentUser.id)
          .in('position', [fromPosition, toPosition]);

        await supabase
          .from('user_quick_templates')
          .insert([
            { user_id: currentUser.id, template_id: fromTemplate.template_id, position: toPosition },
            { user_id: currentUser.id, template_id: toTemplate.template_id, position: fromPosition },
          ]);
      } else if (fromTemplate) {
        // Just move fromTemplate to toPosition
        await supabase
          .from('user_quick_templates')
          .update({ position: toPosition })
          .eq('id', fromTemplate.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-quick-templates'] });
    },
  });
}
