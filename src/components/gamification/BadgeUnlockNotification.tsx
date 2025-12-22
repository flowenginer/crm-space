import { useEffect, useState } from 'react';
import { Trophy, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGamificationSounds } from '@/hooks/useGamificationSounds';

interface BadgeUnlockNotificationProps {
  badge: {
    name: string;
    icon: string;
    description: string;
  } | null;
  onClose: () => void;
}

export function BadgeUnlockNotification({ badge, onClose }: BadgeUnlockNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { playBadgeUnlock } = useGamificationSounds();

  useEffect(() => {
    if (badge) {
      setIsVisible(true);
      playBadgeUnlock();

      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [badge, onClose, playBadgeUnlock]);

  if (!badge) return null;

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-50 max-w-sm transition-all duration-300',
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      )}
    >
      <div className="bg-gradient-to-r from-racing-primary to-racing-accent rounded-xl p-1 shadow-2xl animate-pulse-glow">
        <div className="bg-racing-card rounded-lg p-4 relative">
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            className="absolute top-2 right-2 text-muted-foreground hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-br from-racing-accent/30 to-racing-primary/30 rounded-xl flex items-center justify-center text-4xl animate-bounce-subtle">
                {badge.icon}
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-racing-accent rounded-full flex items-center justify-center">
                <Trophy className="w-3 h-3 text-black" />
              </div>
            </div>

            <div className="flex-1">
              <p className="text-racing-accent text-xs font-semibold uppercase tracking-wider">
                Nova Conquista!
              </p>
              <h3 className="text-white font-bold text-lg">{badge.name}</h3>
              <p className="text-muted-foreground text-sm">{badge.description}</p>
            </div>
          </div>

          <div className="mt-3 h-1 bg-racing-bg rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-racing-accent to-racing-primary animate-progress-fill" />
          </div>
        </div>
      </div>
    </div>
  );
}
