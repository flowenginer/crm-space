import { Flag } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { RacerRanking } from "@/hooks/useGamificationRankings";

interface RaceTrackProps {
  racers: RacerRanking[];
  isLoading: boolean;
}

export function RaceTrack({ racers, isLoading }: RaceTrackProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-4 bg-racing-card rounded-xl border border-racing-border">
        <div className="flex items-center gap-2 mb-4">
          <Flag className="w-5 h-5 text-racing-accent" />
          <span className="font-semibold text-white">Pista de Corrida</span>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const maxPoints = Math.max(...racers.map(r => r.total_points), 1);

  return (
    <div className="p-4 md:p-6 bg-racing-card rounded-xl border border-racing-border">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏎️</span>
          <span className="font-bold text-white text-lg">PISTA DE CORRIDA</span>
          <span className="text-2xl">🏎️</span>
        </div>
      </div>

      {/* Track lines */}
      <div className="space-y-3">
        {racers.map((racer, index) => {
          const progress = (racer.total_points / maxPoints) * 100;
          
          return (
            <div key={racer.user_id} className="relative">
              {/* Track background */}
              <div className="h-12 bg-racing-bg rounded-lg relative overflow-hidden border border-racing-border/50">
                {/* Track markings */}
                <div className="absolute inset-0 flex items-center">
                  {[...Array(20)].map((_, i) => (
                    <div 
                      key={i} 
                      className="flex-1 h-full border-r border-dashed border-racing-border/30"
                    />
                  ))}
                </div>

                {/* Progress bar (the "car path") */}
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-racing-primary/50 to-racing-primary/20 transition-all duration-1000 ease-out"
                  style={{ 
                    width: `${Math.max(progress, 5)}%`,
                    backgroundColor: `${racer.car_color}40`,
                  }}
                />

                {/* Car/Avatar */}
                <div 
                  className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out flex items-center gap-2"
                  style={{ left: `${Math.max(progress - 3, 2)}%` }}
                >
                  <Avatar className="h-8 w-8 border-2" style={{ borderColor: racer.car_color }}>
                    <AvatarImage src={racer.avatar_url || ''} />
                    <AvatarFallback 
                      className="text-white text-xs font-bold"
                      style={{ backgroundColor: racer.car_color }}
                    >
                      {racer.display_name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Finish line */}
                <div className="absolute right-0 inset-y-0 w-8 flex items-center justify-center">
                  <div className="grid grid-cols-2 gap-0.5 w-6 h-full py-1">
                    {[...Array(12)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`${i % 2 === (Math.floor(i / 2) % 2) ? 'bg-white' : 'bg-black'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Racer info */}
              <div className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center gap-2 text-right">
                <div>
                  <span className="text-white font-medium text-sm">{racer.display_name}</span>
                  <span className="text-racing-accent font-bold ml-2">{racer.total_points.toLocaleString()} pts</span>
                </div>
              </div>

              {/* Position indicator */}
              <div className="absolute left-2 top-1/2 -translate-y-1/2 font-bold text-lg">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
              </div>
            </div>
          );
        })}

        {racers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <span className="text-4xl mb-4 block">🏎️</span>
            <p>Nenhum corredor na pista ainda.</p>
            <p className="text-sm">Os vendedores aparecerão aqui conforme acumularem pontos.</p>
          </div>
        )}
      </div>
    </div>
  );
}
