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

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['internal-emails'] });
    queryClient.invalidateQueries({ queryKey: ['internal-email-unread-count'] });
    queryClient.invalidateQueries({ queryKey: ['internal-email-folder-counts'] });
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
      invalidateQueries();
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
      invalidateQueries();
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
      invalidateQueries();
    } finally {
      setIsLoading(false);
    }
  };

  const archive = async (emailIds: string[]) => {
    setIsLoading(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('internal_email_recipients')
        .update({ is_archived: true, folder: 'archive' })
        .in('email_id', emailIds)
        .eq('user_id', userId);

      if (error) throw error;
      invalidateQueries();
    } finally {
      setIsLoading(false);
    }
  };

  const moveToTrash = async (emailIds: string[]) => {
    setIsLoading(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('internal_email_recipients')
        .update({ is_deleted: true, deleted_at: new Date().toISOString(), folder: 'trash' })
        .in('email_id', emailIds)
        .eq('user_id', userId);

      if (error) throw error;
      invalidateQueries();
    } finally {
      setIsLoading(false);
    }
  };

  const permanentDelete = async (emailIds: string[]) => {
    setIsLoading(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('internal_email_recipients')
        .delete()
        .in('email_id', emailIds)
        .eq('user_id', userId);

      if (error) throw error;
      invalidateQueries();
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
    isLoading
  };
}
