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
        className="relative flex flex-col items-center"
        style={{ order: position === 1 ? 2 : position === 2 ? 1 : 3 }}
      >
        {/* Trophy for 1st place */}
        {position === 1 && (
          <div className="absolute -top-16 animate-bounce z-10">
            <Trophy className="w-12 h-12 text-yellow-500" />
          </div>
        )}

        {/* Podium card - DOBRO DA LARGURA */}
        <div 
          className={`
            relative w-40 md:w-52 lg:w-60 rounded-xl border-2 ${style.border} ${style.glow}
            bg-gradient-to-b ${style.bg} backdrop-blur-sm
            flex flex-col items-center justify-center p-4 md:p-6
            transition-all duration-300 hover:scale-105
            ${height}
          `}
        >
          {/* Position badge - medalha no canto superior */}
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-4xl">
            {style.badge}
          </div>

          {/* Avatar */}
          <Avatar className={`h-16 w-16 md:h-20 md:w-20 border-4 ${style.border} mt-2`}>
            <AvatarImage src={racer?.avatar_url || ''} />
            <AvatarFallback 
              className="bg-racing-primary text-white text-xl font-bold"
              style={{ backgroundColor: racer?.car_color }}
            >
              {racer?.display_name?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>

          {/* Name */}
          <div className="mt-3 font-bold text-white text-base md:text-lg text-center truncate max-w-full px-2">
            {racer?.display_name || 'Vazio'}
          </div>

          {/* Value */}
          <div className="mt-2 text-racing-accent font-bold text-lg md:text-xl">
            R$ {racer?.total_sales?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
          </div>

          {/* Sales count */}
          <div className="mt-1 text-muted-foreground text-sm">
            {racer?.total_deals || 0} vendas
          </div>
        </div>

        {/* Position number - FORA DO CONTAINER, NA PARTE INFERIOR */}
        <div className={`
          mt-3 text-4xl md:text-5xl font-black
          ${position === 1 ? 'text-yellow-500' : position === 2 ? 'text-gray-400' : 'text-amber-600'}
        `}>
          {position}º
        </div>
      </div>
    );
  };

  return (
    <div className="py-12">
      <div className="flex items-end justify-center gap-4 md:gap-6">
        <PodiumPlace racer={second} position={2} height="min-h-[220px]" />
        <PodiumPlace racer={first} position={1} height="min-h-[260px]" />
        <PodiumPlace racer={third} position={3} height="min-h-[200px]" />
      </div>
    </div>
  );
}
