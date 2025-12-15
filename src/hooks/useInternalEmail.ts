import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import type { User } from '@supabase/supabase-js';

// Helper para obter usuário de forma robusta (getSession primeiro, depois getUser como fallback)
async function getAuthenticatedUser(): Promise<User | null> {
  // Primeiro tenta getSession (lê do localStorage, mais confiável e rápido)
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) {
    return sessionData.session.user;
  }
  
  // Fallback para getUser (verifica com servidor)
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user) {
    return userData.user;
  }
  
  return null;
}

// Types
export interface EmailAttachment {
  id: string;
  email_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  is_layout_file: boolean;
  layout_version: number;
  created_at: string;
}

export interface EmailRecipient {
  id: string;
  email_id: string;
  user_id: string;
  recipient_type: 'to' | 'cc';
  is_read: boolean;
  read_at: string | null;
  is_starred: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  labels: string[];
  folder: 'inbox' | 'starred' | 'archive' | 'trash';
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface InternalEmail {
  id: string;
  tenant_id: string | null;
  sender_id: string;
  subject: string;
  body: string;
  body_html: string | null;
  priority: 'low' | 'normal' | 'high';
  status: 'draft' | 'sent' | 'scheduled';
  category: string;
  order_id: string | null;
  quote_id: string | null;
  contact_id: string | null;
  conversation_id: string | null;
  parent_email_id: string | null;
  thread_id: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  // Campos de caixa compartilhada
  shared_box_id: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  workflow_status: 'pending' | 'in_progress' | 'completed';
  sender?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  claimed_by_user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  recipients?: EmailRecipient[];
  attachments?: EmailAttachment[];
  order?: {
    id: string;
    order_number: string;
  } | null;
  quote?: {
    id: string;
    quote_number: string;
  } | null;
  shared_box?: {
    id: string;
    name: string;
  } | null;
  // For recipient-specific data
  recipient_data?: {
    is_read: boolean;
    is_starred: boolean;
    folder: string;
    labels: string[];
  };
}

export interface EmailLabel {
  id: string;
  tenant_id: string | null;
  name: string;
  color: string;
  icon: string;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
}

export type EmailFolder = 'inbox' | 'sent' | 'drafts' | 'starred' | 'archive' | 'trash';

// Hook para buscar e-mails por pasta
export function useInternalEmails(folder: EmailFolder, search?: string) {
  const { data: user } = useCurrentUserId();

  return useQuery({
    queryKey: ['internal-emails', folder, search, user],
    queryFn: async () => {
      if (!user) return [];

      let query;

      if (folder === 'sent') {
        // E-mails enviados pelo usuário (não deletados pelo remetente)
        query = supabase
          .from('internal_emails')
          .select(`
            *,
            sender:profiles!internal_emails_sender_id_fkey(id, full_name, avatar_url),
            recipients:internal_email_recipients(
              id,
              recipient_type,
              user:profiles!internal_email_recipients_user_id_fkey(id, full_name, avatar_url)
            )
          `)
          .eq('sender_id', user)
          .eq('status', 'sent')
          .or('is_deleted_by_sender.is.null,is_deleted_by_sender.eq.false')
          .order('sent_at', { ascending: false });
      } else if (folder === 'drafts') {
        // Rascunhos do usuário
        query = supabase
          .from('internal_emails')
          .select(`
            *,
            sender:profiles!internal_emails_sender_id_fkey(id, full_name, avatar_url)
          `)
          .eq('sender_id', user)
          .eq('status', 'draft')
          .order('updated_at', { ascending: false });
      } else if (folder === 'trash') {
        // Lixeira: busca recipients deletados + emails enviados deletados pelo remetente
        const { data: recipientEmails, error: recError } = await supabase
          .from('internal_email_recipients')
          .select('email_id, is_read, is_starred, folder, labels')
          .eq('user_id', user)
          .eq('is_deleted', true);

        if (recError) throw recError;

        const recipientEmailIds = recipientEmails?.map(r => r.email_id) || [];

        // Busca e-mails dos recipients
        let trashEmails: InternalEmail[] = [];
        if (recipientEmailIds.length > 0) {
          const { data, error } = await supabase
            .from('internal_emails')
            .select(`
              *,
              sender:profiles!internal_emails_sender_id_fkey(id, full_name, avatar_url)
            `)
            .in('id', recipientEmailIds)
            .eq('status', 'sent')
            .order('sent_at', { ascending: false });

          if (error) throw error;

          trashEmails = (data || []).map(email => {
            const recipientData = recipientEmails?.find(r => r.email_id === email.id);
            return {
              ...email,
              recipient_data: recipientData ? {
                is_read: recipientData.is_read,
                is_starred: recipientData.is_starred,
                folder: recipientData.folder,
                labels: recipientData.labels || []
              } : undefined
            };
          }) as InternalEmail[];
        }

        // Busca e-mails enviados deletados pelo remetente
        const { data: sentDeletedEmails, error: sentError } = await supabase
          .from('internal_emails')
          .select(`
            *,
            sender:profiles!internal_emails_sender_id_fkey(id, full_name, avatar_url)
          `)
          .eq('sender_id', user)
          .eq('status', 'sent')
          .eq('is_deleted_by_sender', true)
          .order('deleted_by_sender_at', { ascending: false });

        if (sentError) throw sentError;

        // Combina os dois arrays removendo duplicatas
        const sentEmailsFormatted = (sentDeletedEmails || []).map(email => ({
          ...email,
          recipient_data: { is_read: true, is_starred: false, folder: 'trash' as const, labels: [] }
        })) as InternalEmail[];

        const combinedEmails = [...trashEmails];
        for (const sentEmail of sentEmailsFormatted) {
          if (!combinedEmails.find(e => e.id === sentEmail.id)) {
            combinedEmails.push(sentEmail);
          }
        }

        // Ordena por data mais recente
        return combinedEmails.sort((a, b) => {
          const dateA = new Date(a.sent_at || a.created_at).getTime();
          const dateB = new Date(b.sent_at || b.created_at).getTime();
          return dateB - dateA;
        });
      } else {
        // Inbox, starred, archive - busca pelos recipients
        const { data: recipientEmails, error: recError } = await supabase
          .from('internal_email_recipients')
          .select('email_id, is_read, is_starred, folder, labels')
          .eq('user_id', user)
          .eq('is_deleted', false)
          .eq('folder', folder === 'starred' ? 'inbox' : folder === 'archive' ? 'archive' : 'inbox');

        if (recError) throw recError;

        // Filtra starred se necessário
        let emailIds = recipientEmails?.map(r => r.email_id) || [];
        if (folder === 'starred') {
          emailIds = recipientEmails?.filter(r => r.is_starred).map(r => r.email_id) || [];
        }

        if (emailIds.length === 0) return [];

        const { data, error } = await supabase
          .from('internal_emails')
          .select(`
            *,
            sender:profiles!internal_emails_sender_id_fkey(id, full_name, avatar_url)
          `)
          .in('id', emailIds)
          .eq('status', 'sent')
          .order('sent_at', { ascending: false });

        if (error) throw error;

        // Adiciona dados do recipient
        return (data || []).map(email => {
          const recipientData = recipientEmails?.find(r => r.email_id === email.id);
          return {
            ...email,
            recipient_data: recipientData ? {
              is_read: recipientData.is_read,
              is_starred: recipientData.is_starred,
              folder: recipientData.folder,
              labels: recipientData.labels || []
            } : undefined
          };
        }) as InternalEmail[];
      }

      if (search) {
        query = query.or(`subject.ilike.%${search}%,body.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as InternalEmail[];
    },
    enabled: !!user
  });
}

// Hook para buscar um e-mail específico com detalhes completos
export function useInternalEmail(emailId: string | null) {
  return useQuery({
    queryKey: ['internal-email', emailId],
    queryFn: async () => {
      if (!emailId) return null;

      // Busca o e-mail
      const { data: email, error } = await supabase
        .from('internal_emails')
        .select(`
          *,
          sender:profiles!internal_emails_sender_id_fkey(id, full_name, avatar_url)
        `)
        .eq('id', emailId)
        .single();

      if (error) throw error;

      // Busca recipients
      const { data: recipients } = await supabase
        .from('internal_email_recipients')
        .select(`
          *,
          user:profiles!internal_email_recipients_user_id_fkey(id, full_name, avatar_url)
        `)
        .eq('email_id', emailId);

      // Busca attachments
      const { data: attachments } = await supabase
        .from('internal_email_attachments')
        .select('*')
        .eq('email_id', emailId);

      // Busca ordem/orçamento se vinculado
      let order = null;
      let quote = null;

      if (email.order_id) {
        const { data } = await supabase
          .from('orders')
          .select('id, order_number')
          .eq('id', email.order_id)
          .single();
        order = data;
      }

      if (email.quote_id) {
        const { data } = await supabase
          .from('quotes')
          .select('id, quote_number')
          .eq('id', email.quote_id)
          .single();
        quote = data;
      }

      return {
        ...email,
        recipients: recipients || [],
        attachments: attachments || [],
        order,
        quote
      } as InternalEmail;
    },
    enabled: !!emailId
  });
}

// Hook para contagem de não lidos
export function useInternalEmailUnreadCount() {
  const { data: user } = useCurrentUserId();

  return useQuery({
    queryKey: ['internal-email-unread-count', user],
    queryFn: async () => {
      if (!user) return 0;

      const { count, error } = await supabase
        .from('internal_email_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user)
        .eq('is_read', false)
        .eq('is_deleted', false)
        .eq('folder', 'inbox');

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000
  });
}

// Hook para contagem por pasta
export function useInternalEmailFolderCounts() {
  const { data: user } = useCurrentUserId();

  return useQuery({
    queryKey: ['internal-email-folder-counts', user],
    queryFn: async () => {
      if (!user) return { inbox: 0, inbox_unread: 0, sent: 0, drafts: 0, starred: 0, archive: 0, trash: 0 };

      // Inbox count
      const { count: inboxCount } = await supabase
        .from('internal_email_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user)
        .eq('folder', 'inbox')
        .eq('is_deleted', false);

      // Inbox unread count
      const { count: inboxUnreadCount } = await supabase
        .from('internal_email_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user)
        .eq('folder', 'inbox')
        .eq('is_deleted', false)
        .eq('is_read', false);

      // Sent count (excluindo deletados pelo remetente)
      const { count: sentCount } = await supabase
        .from('internal_emails')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', user)
        .eq('status', 'sent')
        .or('is_deleted_by_sender.is.null,is_deleted_by_sender.eq.false');

      // Drafts count
      const { count: draftsCount } = await supabase
        .from('internal_emails')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', user)
        .eq('status', 'draft');

      // Starred count
      const { count: starredCount } = await supabase
        .from('internal_email_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user)
        .eq('is_starred', true)
        .eq('is_deleted', false);

      // Archive count
      const { count: archiveCount } = await supabase
        .from('internal_email_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user)
        .eq('folder', 'archive')
        .eq('is_deleted', false);

      // Trash count (recipients deletados + enviados deletados pelo remetente)
      const { count: trashRecipientCount } = await supabase
        .from('internal_email_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user)
        .eq('is_deleted', true);

      // Sent emails deleted by sender
      const { count: trashSentCount } = await supabase
        .from('internal_emails')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', user)
        .eq('status', 'sent')
        .eq('is_deleted_by_sender', true);

      const trashCount = (trashRecipientCount || 0) + (trashSentCount || 0);

      return {
        inbox: inboxCount || 0,
        inbox_unread: inboxUnreadCount || 0,
        sent: sentCount || 0,
        drafts: draftsCount || 0,
        starred: starredCount || 0,
        archive: archiveCount || 0,
        trash: trashCount || 0
      };
    },
    enabled: !!user
  });
}

// Hook para enviar e-mail
export function useSendInternalEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      subject: string;
      body: string;
      body_html?: string;
      priority?: 'low' | 'normal' | 'high';
      category?: string;
      recipients_to: string[];
      recipients_cc?: string[];
      shared_box_id?: string;
      order_id?: string;
      quote_id?: string;
      parent_email_id?: string;
      attachments?: { file_name: string; file_url: string; file_size?: number; mime_type?: string }[];
      status?: 'draft' | 'sent';
    }) => {
      console.log('[useSendInternalEmail] Iniciando envio:', data);
      
      // Usar helper de autenticação robusta
      let user;
      try {
        user = await getAuthenticatedUser();
      } catch (authError) {
        console.error('[useSendInternalEmail] Erro ao obter usuário:', authError);
        throw new Error('Erro de conexão. Verifique sua internet e tente novamente.');
      }
      
      if (!user) {
        throw new Error('Sessão expirada. Por favor, recarregue a página e tente novamente.');
      }

      console.log('[useSendInternalEmail] Usuário:', user.id);

      // Criar o e-mail
      const { data: email, error: emailError } = await supabase
        .from('internal_emails')
        .insert({
          sender_id: user.id,
          subject: data.subject,
          body: data.body,
          body_html: data.body_html,
          priority: data.priority || 'normal',
          category: data.category || 'general',
          order_id: data.order_id,
          quote_id: data.quote_id,
          parent_email_id: data.parent_email_id,
          status: data.status || 'sent',
          sent_at: data.status === 'draft' ? null : new Date().toISOString(),
          // Campos de caixa compartilhada
          shared_box_id: data.shared_box_id || null,
          workflow_status: data.shared_box_id ? 'pending' : 'pending'
        })
        .select()
        .single();

      if (emailError) {
        console.error('[useSendInternalEmail] Erro ao criar e-mail:', emailError);
        throw new Error(`Erro ao criar e-mail: ${emailError.message}`);
      }

      console.log('[useSendInternalEmail] E-mail criado:', email.id);

      // Criar recipients "to" - apenas se não for para caixa compartilhada
      if (data.recipients_to.length > 0) {
        console.log('[useSendInternalEmail] Criando recipients TO:', data.recipients_to);
        const { error: toError } = await supabase
          .from('internal_email_recipients')
          .insert(
            data.recipients_to.map(userId => ({
              email_id: email.id,
              user_id: userId,
              recipient_type: 'to' as const
            }))
          );
        if (toError) {
          console.error('[useSendInternalEmail] Erro ao criar recipients TO:', toError);
          throw new Error(`Erro ao adicionar destinatários: ${toError.message}`);
        }
      }

      // Criar recipients "cc"
      if (data.recipients_cc && data.recipients_cc.length > 0) {
        console.log('[useSendInternalEmail] Criando recipients CC:', data.recipients_cc);
        const { error: ccError } = await supabase
          .from('internal_email_recipients')
          .insert(
            data.recipients_cc.map(userId => ({
              email_id: email.id,
              user_id: userId,
              recipient_type: 'cc' as const
            }))
          );
        if (ccError) {
          console.error('[useSendInternalEmail] Erro ao criar recipients CC:', ccError);
          throw new Error(`Erro ao adicionar destinatários em cópia: ${ccError.message}`);
        }
      }

      // Criar attachments
      if (data.attachments && data.attachments.length > 0) {
        console.log('[useSendInternalEmail] Criando attachments:', data.attachments.length);
        const { error: attachError } = await supabase
          .from('internal_email_attachments')
          .insert(
            data.attachments.map(att => ({
              email_id: email.id,
              file_name: att.file_name,
              file_url: att.file_url,
              file_size: att.file_size,
              mime_type: att.mime_type
            }))
          );
        if (attachError) {
          console.error('[useSendInternalEmail] Erro ao criar attachments:', attachError);
          throw new Error(`Erro ao anexar arquivos: ${attachError.message}`);
        }
      }

      console.log('[useSendInternalEmail] E-mail enviado com sucesso!');
      return email;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-emails'] });
      queryClient.invalidateQueries({ queryKey: ['internal-email-folder-counts'] });
      queryClient.invalidateQueries({ queryKey: ['shared-box-emails'] });
      queryClient.invalidateQueries({ queryKey: ['all-shared-boxes-counts'] });
    }
  });
}

// Hook para marcar como lido
export function useMarkEmailAsRead() {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUserId();

  return useMutation({
    mutationFn: async (emailId: string) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('internal_email_recipients')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('email_id', emailId)
        .eq('user_id', user);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-emails'] });
      queryClient.invalidateQueries({ queryKey: ['internal-email-unread-count'] });
    }
  });
}

// Hook para alternar favorito
export function useToggleEmailStar() {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUserId();

  return useMutation({
    mutationFn: async ({ emailId, isStarred }: { emailId: string; isStarred: boolean }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('internal_email_recipients')
        .update({ is_starred: isStarred })
        .eq('email_id', emailId)
        .eq('user_id', user);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-emails'] });
      queryClient.invalidateQueries({ queryKey: ['internal-email-folder-counts'] });
    }
  });
}

// Hook para mover para lixeira
export function useMoveEmailToTrash() {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUserId();

  return useMutation({
    mutationFn: async (emailId: string) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('internal_email_recipients')
        .update({ is_deleted: true, deleted_at: new Date().toISOString(), folder: 'trash' })
        .eq('email_id', emailId)
        .eq('user_id', user);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-emails'] });
      queryClient.invalidateQueries({ queryKey: ['internal-email-folder-counts'] });
    }
  });
}

// Hook para arquivar
export function useArchiveEmail() {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUserId();

  return useMutation({
    mutationFn: async (emailId: string) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('internal_email_recipients')
        .update({ is_archived: true, folder: 'archive' })
        .eq('email_id', emailId)
        .eq('user_id', user);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-emails'] });
      queryClient.invalidateQueries({ queryKey: ['internal-email-folder-counts'] });
    }
  });
}

// Hook para buscar labels
export function useInternalEmailLabels() {
  return useQuery({
    queryKey: ['internal-email-labels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internal_email_labels')
        .select('*')
        .order('is_system', { ascending: false })
        .order('name');

      if (error) throw error;
      return data as EmailLabel[];
    }
  });
}

// Hook para buscar membros da equipe (para seletor de destinatários)
// Aplica filtro baseado nas regras de visibilidade
export function useEmailRecipientOptions() {
  const { data: user } = useCurrentUserId();

  return useQuery({
    queryKey: ['email-recipient-options', user],
    queryFn: async () => {
      if (!user) return [];

      // Busca o role do usuário atual
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user)
        .single();

      const currentRole = currentProfile?.role;

      // Admin e Supervisor têm acesso total
      const isAdminOrSupervisor = ['admin', 'supervisor'].includes(currentRole || '');

      // Busca todos os profiles
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, department_id')
        .eq('is_active', true)
        .neq('id', user)
        .order('full_name');

      if (error) throw error;

      // Se é admin/supervisor, retorna todos
      if (isAdminOrSupervisor) {
        return profiles;
      }

      // Busca as regras de visibilidade para o role atual
      const { data: rules } = await supabase
        .from('email_visibility_rules')
        .select('target_role')
        .eq('source_role', currentRole || '')
        .eq('is_allowed', true)
        .not('target_role', 'is', null);

      // Se não há regras, também bloqueia (por segurança)
      const allowedRoles = rules?.map(r => r.target_role) || [];
      
      // Admin e Supervisor sempre podem receber (são destinatários válidos)
      allowedRoles.push('admin', 'supervisor');

      // Filtra profiles baseado nas regras
      return profiles?.filter(p => allowedRoles.includes(p.role)) || [];
    },
    enabled: !!user
  });
}

// Hook para upload de anexo
export function useUploadEmailAttachment() {
  return useMutation({
    mutationFn: async (file: File) => {
      // Usar helper de autenticação robusta (getSession primeiro, getUser como fallback)
      const user = await getAuthenticatedUser();
      if (!user) {
        throw new Error('Sessão expirada. Por favor, recarregue a página e tente novamente.');
      }

      console.log('[useUploadEmailAttachment] Iniciando upload:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        userId: user.id
      });
      
      const fileExt = file.name.split('.').pop();
      // Usar caminho com ID do usuário para organização e RLS
      const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
      
      console.log('[useUploadEmailAttachment] Caminho do arquivo:', fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('internal-email-attachments')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('[useUploadEmailAttachment] Erro no upload:', {
          error: uploadError,
          message: uploadError.message,
          statusCode: (uploadError as any).statusCode
        });
        throw new Error(`Erro ao fazer upload: ${uploadError.message}`);
      }

      console.log('[useUploadEmailAttachment] Upload concluído:', uploadData);

      const { data: urlData } = supabase.storage
        .from('internal-email-attachments')
        .getPublicUrl(fileName);

      console.log('[useUploadEmailAttachment] URL pública:', urlData.publicUrl);

      return {
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type
      };
    }
  });
}

// Hook para realtime - escuta INSERT, UPDATE e DELETE
export function useInternalEmailRealtime() {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUserId();

  useEffect(() => {
    if (!user) return;

    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ['internal-emails'] });
      queryClient.invalidateQueries({ queryKey: ['internal-email-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['internal-email-folder-counts'] });
      queryClient.invalidateQueries({ queryKey: ['shared-box-emails'] });
      queryClient.invalidateQueries({ queryKey: ['all-shared-boxes-counts'] });
      queryClient.invalidateQueries({ queryKey: ['internal-email'] });
    };

    // Canal para recipients - simplificado para invalidar em qualquer mudança
    const recipientsChannel = supabase
      .channel('internal-email-recipients-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internal_email_recipients' },
        () => invalidateAll()
      )
      .subscribe();

    // Canal para emails (atualizações gerais, incluindo caixas compartilhadas)
    const emailsChannel = supabase
      .channel('internal-emails-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'internal_emails' },
        () => invalidateAll()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'internal_emails' },
        () => invalidateAll()
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'internal_emails' },
        () => invalidateAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(recipientsChannel);
      supabase.removeChannel(emailsChannel);
    };
  }, [user, queryClient]);
}

// Helper hook para obter user id
function useCurrentUserId() {
  return useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.id || null;
    },
    staleTime: Infinity
  });
}

// Hook para deletar rascunho
export function useDeleteDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase
        .from('internal_emails')
        .delete()
        .eq('id', emailId)
        .eq('status', 'draft');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-emails'] });
      queryClient.invalidateQueries({ queryKey: ['internal-email-folder-counts'] });
    }
  });
}
