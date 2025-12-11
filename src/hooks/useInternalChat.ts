import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Types
export interface InternalChatThread {
  id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_sender_id: string | null;
  other_user: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    is_online: boolean | null;
    department_id: string | null;
    department_name?: string | null;
    department_color?: string | null;
  };
  unread_count: number;
}

export interface ReplyMessage {
  id: string;
  content: string | null;
  message_type: string;
  sender_id: string;
  sender: {
    id: string;
    full_name: string | null;
  } | null;
}

export interface InternalChatMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  media_url: string | null;
  media_name: string | null;
  media_mime_type: string | null;
  reply_to_message_id: string | null;
  reply_to_message?: ReplyMessage | null;
  is_deleted: boolean;
  created_at: string;
  sender: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface TeamMember {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_online: boolean | null;
  is_available: boolean | null;
  department_id: string | null;
  department_name?: string | null;
  department_color?: string | null;
}

// Hook para buscar threads do usuário - OTIMIZADO com RPC
export function useInternalChatThreads() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['internal-chat-threads', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_internal_chat_threads', {
        p_user_id: user!.id
      });

      if (error) throw error;

      // Map the RPC result to the expected format
      return (data || []).map((row: any) => ({
        id: row.thread_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_message_at: row.last_message_at,
        last_message_preview: row.last_message_preview,
        last_message_sender_id: row.last_message_sender_id,
        other_user: {
          id: row.other_user_id,
          full_name: row.other_user_name,
          avatar_url: row.other_user_avatar,
          is_online: row.other_user_online,
          department_id: row.other_user_department_id,
          department_name: row.other_user_department_name,
          department_color: row.other_user_department_color
        },
        unread_count: row.unread_count
      })) as InternalChatThread[];
    },
    staleTime: 30000,
    refetchInterval: 60000 // Reduzido de 30s para 60s, realtime vai atualizar
  });
}

// Hook para buscar mensagens de uma thread
export function useInternalChatMessages(threadId: string | null) {
  return useQuery({
    queryKey: ['internal-chat-messages', threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internal_chat_messages')
        .select(`
          *,
          sender:profiles!internal_chat_messages_sender_id_fkey(id, full_name, avatar_url)
        `)
        .eq('thread_id', threadId!)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Buscar reply messages em batch
      const messagesWithReplies = data || [];
      const replyIds = messagesWithReplies
        .filter(m => m.reply_to_message_id)
        .map(m => m.reply_to_message_id);

      let replyMap = new Map();
      if (replyIds.length > 0) {
        const { data: replies } = await supabase
          .from('internal_chat_messages')
          .select(`
            id, content, message_type, sender_id,
            sender:profiles!internal_chat_messages_sender_id_fkey(id, full_name)
          `)
          .in('id', replyIds);
        
        if (replies) {
          replyMap = new Map(replies.map(r => [r.id, r]));
        }
      }

      return messagesWithReplies.map(msg => ({
        ...msg,
        reply_to_message: msg.reply_to_message_id ? replyMap.get(msg.reply_to_message_id) : null
      })) as unknown as InternalChatMessage[];
    },
    staleTime: 10000
  });
}

// Hook para buscar total de não lidas
export function useInternalChatUnreadCount() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['internal-chat-unread-count', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_internal_chat_unread_count', {
        p_user_id: user!.id
      });
      if (error) throw error;
      return data as number;
    },
    staleTime: 30000,
    refetchInterval: 30000 // Aumentado de 10s para 30s
  });
}

// Hook para buscar todos os membros da equipe - OTIMIZADO
export function useTeamMembers() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['team-members-for-chat'],
    enabled: !!user?.id,
    staleTime: 60000, // Cache por 1 minuto
    queryFn: async () => {
      // Query única com JOIN
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, full_name, avatar_url, is_online, is_available, department_id,
          departments:department_id(name, color)
        `)
        .eq('is_active', true)
        .neq('id', user!.id)
        .order('full_name');

      if (error) throw error;

      return (data || []).map(p => ({
        id: p.id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        is_online: p.is_online,
        is_available: p.is_available,
        department_id: p.department_id,
        department_name: (p.departments as any)?.name || null,
        department_color: (p.departments as any)?.color || null
      })) as TeamMember[];
    }
  });
}

// Hook para enviar mensagem
export function useSendInternalMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      threadId, 
      content, 
      messageType = 'text',
      mediaUrl,
      mediaName,
      mediaMimeType,
      replyToMessageId
    }: {
      threadId: string;
      content?: string;
      messageType?: string;
      mediaUrl?: string;
      mediaName?: string;
      mediaMimeType?: string;
      replyToMessageId?: string;
    }) => {
      const { data, error } = await supabase
        .from('internal_chat_messages')
        .insert({
          thread_id: threadId,
          sender_id: user!.id,
          content,
          message_type: messageType,
          media_url: mediaUrl,
          media_name: mediaName,
          media_mime_type: mediaMimeType,
          reply_to_message_id: replyToMessageId
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['internal-chat-messages', variables.threadId] });
      queryClient.invalidateQueries({ queryKey: ['internal-chat-threads'] });
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
    }
  });
}

// Hook para iniciar/encontrar conversa
export function useStartInternalChat() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (otherUserId: string) => {
      const { data, error } = await supabase.rpc('find_or_create_direct_thread', {
        p_user_id: user!.id,
        p_other_user_id: otherUserId
      });

      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-chat-threads'] });
    }
  });
}

// Hook para marcar thread como lida
export function useMarkThreadAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await supabase
        .from('internal_chat_participants')
        .update({ 
          unread_count: 0,
          last_read_at: new Date().toISOString()
        })
        .eq('thread_id', threadId)
        .eq('user_id', user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-chat-threads'] });
      queryClient.invalidateQueries({ queryKey: ['internal-chat-unread-count'] });
    }
  });
}

// Hook para realtime de mensagens - OTIMIZADO
export function useInternalChatRealtime(threadId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.5;
  }, []);

  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const messagesChannel = supabase
      .channel('internal-chat-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_chat_messages'
        },
        (payload) => {
          const newMessage = payload.new as any;
          
          // Invalidar apenas as queries necessárias
          queryClient.invalidateQueries({ 
            queryKey: ['internal-chat-messages', newMessage.thread_id] 
          });
          queryClient.invalidateQueries({ queryKey: ['internal-chat-threads'] });

          if (newMessage.sender_id !== user.id) {
            playNotificationSound();
            queryClient.invalidateQueries({ queryKey: ['internal-chat-unread-count'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [user?.id, queryClient, playNotificationSound]);
}

// Hook para upload de mídia
export function useUploadInternalChatMedia() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user!.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('internal-chat-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('internal-chat-attachments')
        .getPublicUrl(fileName);

      return {
        url: urlData.publicUrl,
        name: file.name,
        mimeType: file.type
      };
    },
    onError: () => {
      toast.error('Erro ao fazer upload do arquivo');
    }
  });
}
