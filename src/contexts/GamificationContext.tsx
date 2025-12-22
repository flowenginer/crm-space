import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BadgeUnlockNotification } from '@/components/gamification/BadgeUnlockNotification';
import { PointsPopup } from '@/components/gamification/PointsPopup';
import { ConfettiEffect } from '@/components/gamification/ConfettiEffect';
import { useGamificationSounds } from '@/hooks/useGamificationSounds';

interface BadgeNotification {
  name: string;
  icon: string;
  description: string;
}

interface PointsNotification {
  points: number;
  description?: string;
}

interface GamificationContextType {
  showBadge: (badge: BadgeNotification) => void;
  showPoints: (points: number, description?: string) => void;
  showConfetti: () => void;
  showOvertake: (position: number) => void;
}

const GamificationContext = createContext<GamificationContextType | null>(null);

export function useGamificationNotifications() {
  const ctx = useContext(GamificationContext);
  if (!ctx) {
    throw new Error('useGamificationNotifications must be used within GamificationProvider');
  }
  return ctx;
}

interface GamificationProviderProps {
  children: ReactNode;
}

export function GamificationProvider({ children }: GamificationProviderProps) {
  const [currentBadge, setCurrentBadge] = useState<BadgeNotification | null>(null);
  const [currentPoints, setCurrentPoints] = useState<PointsNotification | null>(null);
  const [showConfettiEffect, setShowConfettiEffect] = useState(false);
  const { playOvertake, playPolePosition } = useGamificationSounds();

  const showBadge = useCallback((badge: BadgeNotification) => {
    setCurrentBadge(badge);
  }, []);

  const showPoints = useCallback((points: number, description?: string) => {
    setCurrentPoints({ points, description });
  }, []);

  const showConfetti = useCallback(() => {
    setShowConfettiEffect(true);
    playPolePosition();
  }, [playPolePosition]);

  const showOvertake = useCallback((position: number) => {
    playOvertake();
    if (position === 1) {
      setShowConfettiEffect(true);
      playPolePosition();
    }
  }, [playOvertake, playPolePosition]);

  // Listen for realtime badge unlocks
  useEffect(() => {
    const setupRealtimeBadges = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('gamification-badges-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'gamification_badges',
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            // Fetch badge details
            const { data: badgeDef } = await supabase
              .from('gamification_badge_definitions')
              .select('*')
              .eq('code', payload.new.badge_code)
              .single();

            if (badgeDef) {
              showBadge({
                name: badgeDef.name,
                icon: badgeDef.icon || '🏆',
                description: badgeDef.description || '',
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupRealtimeBadges();
  }, [showBadge]);

  // Listen for realtime points
  useEffect(() => {
    const setupRealtimePoints = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('gamification-points-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'gamification_points',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newPoints = payload.new as { points: number; description?: string };
            showPoints(newPoints.points, newPoints.description);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupRealtimePoints();
  }, [showPoints]);

  return (
    <GamificationContext.Provider value={{ showBadge, showPoints, showConfetti, showOvertake }}>
      {children}
      
      <BadgeUnlockNotification 
        badge={currentBadge} 
        onClose={() => setCurrentBadge(null)} 
      />
      
      <PointsPopup 
        points={currentPoints?.points ?? null}
        description={currentPoints?.description}
        onComplete={() => setCurrentPoints(null)} 
      />
      
      <ConfettiEffect 
        isActive={showConfettiEffect} 
        onComplete={() => setShowConfettiEffect(false)} 
      />
    </GamificationContext.Provider>
  );
}
