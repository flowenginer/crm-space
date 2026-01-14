import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MetaTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phone_number?: string;
  }>;
  example?: {
    header_text?: string[];
    body_text?: string[][];
    header_handle?: string[];
  };
}

export interface MetaMessageTemplate {
  id: string;
  tenant_id: string;
  cloudapi_config_id: string | null;
  meta_template_id: string | null;
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED';
  components: MetaTemplateComponent[];
  example_values: Record<string, any> | null;
  rejection_reason: string | null;
  quality_score: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch templates from local database
export function useMetaTemplates() {
  return useQuery({
    queryKey: ['meta-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_message_templates')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as MetaMessageTemplate[];
    },
  });
}

// Fetch approved templates only (for selectors)
export function useApprovedMetaTemplates() {
  return useQuery({
    queryKey: ['meta-templates', 'approved'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_message_templates')
        .select('*')
        .eq('status', 'APPROVED')
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as MetaMessageTemplate[];
    },
  });
}

// Sync templates from Meta
export function useSyncMetaTemplates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        'https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/meta-get-templates',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to sync templates');
      }

      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['meta-templates'] });
      toast.success(`Templates sincronizados! ${data.synced_count} templates encontrados.`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao sincronizar templates');
    },
  });
}

// Create template on Meta
export function useCreateMetaTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: {
      name: string;
      language: string;
      category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
      components: MetaTemplateComponent[];
      allow_category_change?: boolean;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        'https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/meta-create-template',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(template),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create template');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-templates'] });
      toast.success('Template enviado para aprovação! A Meta geralmente leva 24-48 horas para revisar.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar template');
    },
  });
}

// Disable template locally (does not call Meta API)
export function useDisableMetaTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId }: { templateId: string }) => {
      const { error } = await supabase
        .from('meta_message_templates')
        .update({ status: 'DISABLED' })
        .eq('id', templateId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-templates'] });
      toast.success('Template desativado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao desativar template');
    },
  });
}

// Reactivate a disabled template locally
export function useReactivateMetaTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId }: { templateId: string }) => {
      const { error } = await supabase
        .from('meta_message_templates')
        .update({ status: 'APPROVED' })
        .eq('id', templateId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-templates'] });
      toast.success('Template reativado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao reativar template');
    },
  });
}

// Helper function to extract variables from template body
export function extractTemplateVariables(components: MetaTemplateComponent[]): number {
  let maxVar = 0;
  
  for (const component of components) {
    if (component.text) {
      const matches = component.text.match(/\{\{(\d+)\}\}/g);
      if (matches) {
        for (const match of matches) {
          const num = parseInt(match.replace(/[{}]/g, ''));
          if (num > maxVar) maxVar = num;
        }
      }
    }
  }
  
  return maxVar;
}

// Helper function to get body text from components
export function getTemplateBody(components: MetaTemplateComponent[]): string {
  const bodyComponent = components.find(c => c.type === 'BODY');
  return bodyComponent?.text || '';
}

// Helper function to get header text from components
export function getTemplateHeader(components: MetaTemplateComponent[]): string | null {
  const headerComponent = components.find(c => c.type === 'HEADER');
  return headerComponent?.text || null;
}

// Helper function to get footer text from components  
export function getTemplateFooter(components: MetaTemplateComponent[]): string | null {
  const footerComponent = components.find(c => c.type === 'FOOTER');
  return footerComponent?.text || null;
}
