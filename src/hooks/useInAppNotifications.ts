import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';

export interface InAppNotification {
  id: string;
  tenant_id: string;
  user_id: string;
  type: 'new_message' | 'assignment' | 'transfer' | 'sla' | 'channel_disconnect' | 'mention' | 'rescue_reply';
  title: string;
  message: string;
  conversation_id: string | null;
  contact_name: string | null;
  metadata: Record<string, unknown>;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

const NOTIFICATION_SOUND_KEY = 'notification_sound_enabled';
const BROWSER_PUSH_PERMISSION_KEY = 'browser_push_asked';

function playNotificationSound() {
  try {
    const enabled = localStorage.getItem(NOTIFICATION_SOUND_KEY) !== 'false';
    if (!enabled) return;

    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch {
    // Audio not available
  }
}

function showBrowserNotification(title: string, body: string, conversationId?: string | null) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: conversationId || 'crm-notification',
      requireInteraction: false,
    });

    notification.onclick = () => {
      window.focus();
      if (conversationId) {
        window.location.href = `/conversations?id=${conversationId}`;
      }
      notification.close();
    };

    setTimeout(() => notification.close(), 8000);
  } catch {
    // Browser notifications not available
  }
}

export function requestBrowserNotificationPermission() {
  if (!('Notification' in window)) return Promise.resolve('denied' as NotificationPermission);
  if (Notification.permission === 'granted') return Promise.resolve('granted' as NotificationPermission);
  if (Notification.permission === 'denied') return Promise.resolve('denied' as NotificationPermission);

  return Notification.requestPermission();
}

export function useInAppNotifications() {
  const { data: currentUser } = useCurrentUser();
  const { data: settings } = useNotificationSettings();
  const queryClient = useQueryClient();
  const lastNotificationRef = useRef<string | null>(null);

  // Fetch unread notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['in-app-notifications', currentUser?.id],
    enabled: !!currentUser?.id,
    staleTime: 30000,
    queryFn: async () => {
      if (!currentUser?.id) return [];

      const { data, error } = await supabase
        .from('in_app_notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }

      return (data || []) as unknown as InAppNotification[];
    },
  });

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase
      .channel(`notifications:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload) => {
          const newNotification = payload.new as InAppNotification;

          // Prevent duplicate alerts
          if (lastNotificationRef.current === newNotification.id) return;
          lastNotificationRef.current = newNotification.id;

          // Invalidate query to refresh list
          queryClient.invalidateQueries({ queryKey: ['in-app-notifications'] });

          // Play sound
          playNotificationSound();

          // Show browser push notification if enabled
          if (settings?.push_enabled !== false) {
            showBrowserNotification(
              newNotification.title,
              newNotification.message,
              newNotification.conversation_id
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, queryClient, settings?.push_enabled]);

  // Ask for browser notification permission on first load
  useEffect(() => {
    if (!currentUser?.id) return;
    const asked = localStorage.getItem(BROWSER_PUSH_PERMISSION_KEY);
    if (!asked && settings?.push_enabled !== false) {
      requestBrowserNotificationPermission().then(() => {
        localStorage.setItem(BROWSER_PUSH_PERMISSION_KEY, 'true');
      });
    }
  }, [currentUser?.id, settings?.push_enabled]);

  const unreadNotifications = notifications.filter(n => !n.read);
  const unreadCount = unreadNotifications.length;

  return {
    notifications,
    unreadNotifications,
    unreadCount,
    isLoading,
  };
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('in_app_notifications')
        .update({ read: true, read_at: new Date().toISOString() } as Record<string, unknown>)
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-app-notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  return useMutation({
    mutationFn: async () => {
      if (!currentUser?.id) return;

      const { error } = await supabase
        .from('in_app_notifications')
        .update({ read: true, read_at: new Date().toISOString() } as Record<string, unknown>)
        .eq('user_id', currentUser.id)
        .eq('read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-app-notifications'] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('in_app_notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-app-notifications'] });
    },
  });
}
