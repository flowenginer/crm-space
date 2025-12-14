import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useBulkEmailActions() {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const getCurrentUserId = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id;
  };

  const invalidateAndRefetch = async () => {
    await queryClient.invalidateQueries({ queryKey: ['internal-emails'] });
    await queryClient.invalidateQueries({ queryKey: ['internal-email-unread-count'] });
    await queryClient.invalidateQueries({ queryKey: ['internal-email-folder-counts'] });
    await queryClient.refetchQueries({ queryKey: ['internal-emails'] });
  };

  const optimisticRemove = (emailIds: string[]) => {
    // Atualização otimista - remove e-mails da cache imediatamente
    queryClient.setQueriesData({ queryKey: ['internal-emails'] }, (oldData: any) => {
      if (!oldData || !Array.isArray(oldData)) return oldData;
      return oldData.filter((email: any) => !emailIds.includes(email.id));
    });
  };

  const markAsRead = async (emailIds: string[]) => {
    setIsLoading(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('internal_email_recipients')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('email_id', emailIds)
        .eq('user_id', userId);

      if (error) throw error;
      await invalidateAndRefetch();
    } finally {
      setIsLoading(false);
    }
  };

  const markAsUnread = async (emailIds: string[]) => {
    setIsLoading(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('internal_email_recipients')
        .update({ is_read: false, read_at: null })
        .in('email_id', emailIds)
        .eq('user_id', userId);

      if (error) throw error;
      await invalidateAndRefetch();
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStar = async (emailIds: string[], starred: boolean) => {
    setIsLoading(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('internal_email_recipients')
        .update({ is_starred: starred })
        .in('email_id', emailIds)
        .eq('user_id', userId);

      if (error) throw error;
      await invalidateAndRefetch();
    } finally {
      setIsLoading(false);
    }
  };

  const archive = async (emailIds: string[]) => {
    setIsLoading(true);
    optimisticRemove(emailIds);
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('internal_email_recipients')
        .update({ is_archived: true, folder: 'archive' })
        .in('email_id', emailIds)
        .eq('user_id', userId);

      if (error) throw error;
      await invalidateAndRefetch();
    } finally {
      setIsLoading(false);
    }
  };

  const moveToTrash = async (emailIds: string[], isSentFolder: boolean = false) => {
    setIsLoading(true);
    optimisticRemove(emailIds);
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Usuário não autenticado');

      if (isSentFolder) {
        // Para pasta "Enviados", marca is_deleted_by_sender na tabela internal_emails
        const { error } = await supabase
          .from('internal_emails')
          .update({ is_deleted_by_sender: true, deleted_by_sender_at: new Date().toISOString() })
          .in('id', emailIds)
          .eq('sender_id', userId);

        if (error) throw error;
      } else {
        // Para outras pastas, marca is_deleted na tabela recipients
        const { error } = await supabase
          .from('internal_email_recipients')
          .update({ is_deleted: true, deleted_at: new Date().toISOString(), folder: 'trash' })
          .in('email_id', emailIds)
          .eq('user_id', userId);

        if (error) throw error;
      }
      await invalidateAndRefetch();
    } finally {
      setIsLoading(false);
    }
  };

  const permanentDelete = async (emailIds: string[]) => {
    setIsLoading(true);
    optimisticRemove(emailIds);
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('internal_email_recipients')
        .delete()
        .in('email_id', emailIds)
        .eq('user_id', userId);

      if (error) throw error;
      await invalidateAndRefetch();
    } finally {
      setIsLoading(false);
    }
  };

  return {
    markAsRead,
    markAsUnread,
    toggleStar,
    archive,
    moveToTrash,
    permanentDelete,
    isLoading,
    optimisticRemove
  };
}
