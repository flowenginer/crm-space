import { useState, useMemo } from "react";
import { DollarSign, Zap, Target, TrendingUp } from "lucide-react";
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

  // Calcular métricas dinâmicas baseado nos dados reais
  const metrics = useMemo(() => {
    if (rankings.length === 0) {
      return {
        topSeller: { value: 'R$ 0,00', leader: '-' },
        avgTicket: { value: 'R$ 0,00', leader: '-' },
        totalDeals: { value: '0', leader: '-' },
        totalRevenue: { value: 'R$ 0,00', leader: '-' },
      };
    }

    // Líder em vendas (primeiro do ranking já é o líder)
    const topSeller = rankings[0];
    
    // Ticket médio (quem tem maior valor por venda)
    const rankingWithTicket = rankings
      .filter(r => r.total_deals > 0)
      .map(r => ({ ...r, avgTicket: r.total_sales / r.total_deals }))
      .sort((a, b) => b.avgTicket - a.avgTicket);
    
    const bestTicketSeller = rankingWithTicket[0];
    
    // Total de vendas (soma de todos)
    const totalRevenue = rankings.reduce((sum, r) => sum + r.total_sales, 0);
    const totalDeals = rankings.reduce((sum, r) => sum + r.total_deals, 0);

    return {
      topSeller: {
        value: `R$ ${topSeller.total_sales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        leader: topSeller.display_name || '-',
      },
      avgTicket: {
        value: bestTicketSeller ? `R$ ${bestTicketSeller.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00',
        leader: bestTicketSeller?.display_name || '-',
      },
      totalDeals: {
        value: totalDeals.toString(),
        leader: `${rankings.length} vendedores`,
      },
      totalRevenue: {
        value: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        leader: 'Time',
      },
    };
  }, [rankings]);

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
            title="Líder de Vendas"
            icon={DollarSign}
            value={metrics.topSeller.value}
            leader={metrics.topSeller.leader}
            color="text-green-500"
          />
          <RankingCard
            title="Total Vendas"
            icon={Zap}
            value={metrics.totalDeals.value}
            leader={metrics.totalDeals.leader}
            color="text-yellow-500"
          />
          <RankingCard
            title="Ticket Médio"
            icon={Target}
            value={metrics.avgTicket.value}
            leader={metrics.avgTicket.leader}
            color="text-blue-500"
          />
          <RankingCard
            title="Faturamento Total"
            icon={TrendingUp}
            value={metrics.totalRevenue.value}
            leader={metrics.totalRevenue.leader}
            color="text-purple-500"
          />
        </div>
      </div>
    </div>
  );
}
