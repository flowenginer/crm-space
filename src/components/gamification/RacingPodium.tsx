import { Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { RacerRanking } from "@/hooks/useGamificationRankings";

interface RacingPodiumProps {
  topThree: RacerRanking[];
  isLoading: boolean;
}

export function RacingPodium({ topThree, isLoading }: RacingPodiumProps) {
  if (isLoading) {
    return (
      <div className="flex items-end justify-center gap-4 py-8">
        <Skeleton className="w-32 h-48 rounded-lg" />
        <Skeleton className="w-40 h-56 rounded-lg" />
        <Skeleton className="w-32 h-44 rounded-lg" />
      </div>
    );
  }

  const [first, second, third] = [
    topThree[0],
    topThree[1],
    topThree[2],
  ];

  const PodiumPlace = ({ 
    racer, 
    position, 
    height 
  }: { 
    racer?: RacerRanking; 
    position: 1 | 2 | 3;
    height: string;
  }) => {
    const positionStyles = {
      1: {
        bg: 'from-yellow-500/30 via-yellow-600/20 to-yellow-700/10',
        border: 'border-yellow-500',
        badge: '🥇',
        glow: 'shadow-[0_0_30px_rgba(234,179,8,0.4)]',
      },
      2: {
        bg: 'from-gray-400/30 via-gray-500/20 to-gray-600/10',
        border: 'border-gray-400',
        badge: '🥈',
        glow: '',
      },
      3: {
        bg: 'from-amber-600/30 via-amber-700/20 to-amber-800/10',
        border: 'border-amber-600',
        badge: '🥉',
        glow: '',
      },
    };

    const style = positionStyles[position];

    return (
      <div 
        className={`relative flex flex-col items-center ${height}`}
        style={{ order: position === 1 ? 2 : position === 2 ? 1 : 3 }}
      >
        {/* Trophy for 1st place */}
        {position === 1 && (
          <div className="absolute -top-12 animate-bounce">
            <Trophy className="w-10 h-10 text-yellow-500" />
          </div>
        )}

        {/* Podium card */}
        <div 
          className={`
            relative w-28 md:w-36 rounded-t-xl border-2 ${style.border} ${style.glow}
            bg-gradient-to-b ${style.bg} backdrop-blur-sm
            flex flex-col items-center justify-start pt-4 px-3
            transition-all duration-300 hover:scale-105
            ${height}
          `}
        >
          {/* Position badge */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-3xl">
            {style.badge}
          </div>

          {/* Avatar */}
          <Avatar className={`h-16 w-16 md:h-20 md:w-20 border-4 ${style.border} mt-4`}>
            <AvatarImage src={racer?.avatar_url || ''} />
            <AvatarFallback 
              className="bg-racing-primary text-white text-xl font-bold"
              style={{ backgroundColor: racer?.car_color }}
            >
              {racer?.display_name?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>

          {/* Name */}
          <div className="mt-3 text-center">
            <div className="font-bold text-white text-sm md:text-base truncate max-w-full">
              {position === 1 && '⭐ '}
              {racer?.display_name || 'Vazio'}
              {position === 1 && ' ⭐'}
            </div>
            <div className="text-racing-accent font-semibold text-lg mt-1">
              {racer?.total_points?.toLocaleString() || 0} pts
            </div>
            <div className="text-muted-foreground text-xs mt-1">
              R$ {racer?.total_sales?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
            </div>
          </div>

          {/* Position number at bottom */}
          <div className={`
            absolute bottom-2 text-4xl font-black
            ${position === 1 ? 'text-yellow-500' : position === 2 ? 'text-gray-400' : 'text-amber-600'}
          `}>
            {position}º
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="py-8">
      <div className="flex items-end justify-center gap-2 md:gap-4">
        <PodiumPlace racer={second} position={2} height="h-48" />
        <PodiumPlace racer={first} position={1} height="h-56" />
        <PodiumPlace racer={third} position={3} height="h-44" />
      </div>
    </div>
  );
}
