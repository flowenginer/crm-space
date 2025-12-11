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
}

// Hook para buscar threads do usuário
export function useInternalChatThreads() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['internal-chat-threads', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Buscar participações do usuário
      const { data: participations, error: partError } = await supabase
        .from('internal_chat_participants')
        .select(`
          thread_id,
          unread_count,
          last_read_at
        `)
        .eq('user_id', user!.id);

      if (partError) throw partError;
      if (!participations?.length) return [];

      const threadIds = participations.map(p => p.thread_id);

      // Buscar threads
      const { data: threads, error: threadError } = await supabase
        .from('internal_chat_threads')
        .select('*')
        .in('id', threadIds)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (threadError) throw threadError;

      // Para cada thread, buscar o outro participante
      const threadsWithUsers: InternalChatThread[] = [];
      
      for (const thread of threads || []) {
        // Buscar outros participantes
        const { data: otherParticipants } = await supabase
          .from('internal_chat_participants')
          .select('user_id')
          .eq('thread_id', thread.id)
          .neq('user_id', user!.id);

        if (otherParticipants?.length) {
          const otherUserId = otherParticipants[0].user_id;
          
          // Buscar dados do outro usuário
          const { data: otherUser } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, is_online, department_id')
            .eq('id', otherUserId)
            .single();

          // Buscar departamento
          let departmentName = null;
          if (otherUser?.department_id) {
            const { data: dept } = await supabase
              .from('departments')
              .select('name')
              .eq('id', otherUser.department_id)
              .single();
            departmentName = dept?.name;
          }

          const participation = participations.find(p => p.thread_id === thread.id);

          threadsWithUsers.push({
            ...thread,
            other_user: {
              ...otherUser!,
              department_name: departmentName
            },
            unread_count: participation?.unread_count || 0
          });
        }
      }

      return threadsWithUsers;
    },
    refetchInterval: 30000
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

      // Buscar reply messages
      const messagesWithReplies = await Promise.all(
        (data || []).map(async (msg) => {
          if (msg.reply_to_message_id) {
            const { data: replyMsg } = await supabase
              .from('internal_chat_messages')
              .select(`
                id, content, message_type, sender_id,
                sender:profiles!internal_chat_messages_sender_id_fkey(id, full_name)
              `)
              .eq('id', msg.reply_to_message_id)
              .single();
            return { ...msg, reply_to_message: replyMsg };
          }
          return { ...msg, reply_to_message: null };
        })
      );

      return messagesWithReplies as unknown as InternalChatMessage[];
    }
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
    refetchInterval: 10000
  });
}

// Hook para buscar todos os membros da equipe
export function useTeamMembers() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['team-members-for-chat'],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, is_online, is_available, department_id')
        .eq('is_active', true)
        .neq('id', user!.id)
        .order('full_name');

      if (error) throw error;

      // Buscar departamentos
      const deptIds = [...new Set(profiles?.map(p => p.department_id).filter(Boolean))];
      const { data: departments } = await supabase
        .from('departments')
        .select('id, name')
        .in('id', deptIds as string[]);

      const deptMap = new Map(departments?.map(d => [d.id, d.name]));

      return (profiles || []).map(p => ({
        ...p,
        department_name: p.department_id ? deptMap.get(p.department_id) : null
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
    onError: () => {
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

// Hook para realtime de mensagens
export function useInternalChatRealtime(threadId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Criar elemento de áudio para notificação
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

    // Canal para novas mensagens
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
          
          // Invalidar queries
          queryClient.invalidateQueries({ 
            queryKey: ['internal-chat-messages', newMessage.thread_id] 
          });
          queryClient.invalidateQueries({ queryKey: ['internal-chat-threads'] });
          queryClient.invalidateQueries({ queryKey: ['internal-chat-unread-count'] });

          // Se não sou o remetente, tocar som
          if (newMessage.sender_id !== user.id) {
            playNotificationSound();
          }
        }
      )
      .subscribe();

    // Canal para atualizações de participantes (unread count)
    const participantsChannel = supabase
      .channel('internal-chat-participants-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'internal_chat_participants',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['internal-chat-threads'] });
          queryClient.invalidateQueries({ queryKey: ['internal-chat-unread-count'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(participantsChannel);
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
