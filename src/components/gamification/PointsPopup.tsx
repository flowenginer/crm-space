import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useGamificationSounds } from '@/hooks/useGamificationSounds';

interface PointsPopupProps {
  points: number | null;
  description?: string;
  onComplete: () => void;
}

export function PointsPopup({ points, description, onComplete }: PointsPopupProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { playPoints } = useGamificationSounds();

  useEffect(() => {
    if (points !== null && points > 0) {
      setIsVisible(true);
      playPoints();

      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onComplete, 300);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [points, onComplete, playPoints]);

  if (points === null || points <= 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 transition-all duration-300',
        isVisible 
          ? 'translate-y-0 opacity-100 scale-100' 
          : 'translate-y-4 opacity-0 scale-95'
      )}
    >
      <div className="bg-racing-card border border-racing-accent/50 rounded-xl p-4 shadow-lg shadow-racing-accent/20">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="text-3xl animate-bounce-subtle">⚡</span>
          </div>
          <div>
            <p className="text-racing-accent font-bold text-xl">+{points} pts</p>
            {description && (
              <p className="text-muted-foreground text-sm">{description}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
