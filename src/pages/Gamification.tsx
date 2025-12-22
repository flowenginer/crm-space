import { useState } from "react";
import { Trophy, Flag, Medal, Settings, TrendingUp, Zap, Target, DollarSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useGamificationRankings } from "@/hooks/useGamificationRankings";
import { RacingPodium } from "@/components/gamification/RacingPodium";
import { RaceTrack } from "@/components/gamification/RaceTrack";
import { RankingCard } from "@/components/gamification/RankingCard";
import { SeasonHeader } from "@/components/gamification/SeasonHeader";

type PeriodFilter = 'daily' | 'weekly' | 'monthly';

export default function Gamification() {
  const [period, setPeriod] = useState<PeriodFilter>('monthly');
  const { rankings, isLoading } = useGamificationRankings(period);

  const topThree = rankings.slice(0, 3);
  const allRacers = rankings;

  return (
    <div className="min-h-screen bg-racing-bg">
      {/* Header da Temporada */}
      <SeasonHeader period={period} onPeriodChange={setPeriod} />

      <div className="container mx-auto px-4 py-6 space-y-8">
        {/* Pódio */}
        <RacingPodium topThree={topThree} isLoading={isLoading} />

        {/* Pista de Corrida */}
        <RaceTrack racers={allRacers} isLoading={isLoading} />

        {/* Cards de Rankings Secundários */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <RankingCard
            title="Vendas"
            icon={DollarSign}
            value="R$ 15.200"
            leader="Maria"
            color="text-green-500"
          />
          <RankingCard
            title="Velocidade"
            icon={Zap}
            value="2.3 dias"
            leader="João"
            color="text-yellow-500"
          />
          <RankingCard
            title="Ticket Médio"
            icon={Target}
            value="R$ 1.520"
            leader="Maria"
            color="text-blue-500"
          />
          <RankingCard
            title="Conversão"
            icon={TrendingUp}
            value="68%"
            leader="Pedro"
            color="text-purple-500"
          />
        </div>
      </div>
    </div>
  );
}
