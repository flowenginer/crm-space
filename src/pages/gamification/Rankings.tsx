import { useState } from "react";
import { Trophy, Medal, TrendingUp, Zap, Target, DollarSign, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useGamificationRankings, RankingType } from "@/hooks/useGamificationRankings";
import { SeasonHeader } from "@/components/gamification/SeasonHeader";

type PeriodFilter = 'daily' | 'weekly' | 'monthly';

export default function Rankings() {
  const [period, setPeriod] = useState<PeriodFilter>('monthly');
  const [rankingType, setRankingType] = useState<RankingType>('general');
  const { rankings, isLoading } = useGamificationRankings(period, rankingType);

  const getRankingIcon = (position: number) => {
    switch (position) {
      case 1: return "🥇";
      case 2: return "🥈";
      case 3: return "🥉";
      default: return `#${position}`;
    }
  };

  const getPositionStyle = (position: number) => {
    switch (position) {
      case 1: return "bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border-yellow-500/50";
      case 2: return "bg-gradient-to-r from-gray-400/20 to-gray-500/10 border-gray-400/50";
      case 3: return "bg-gradient-to-r from-amber-600/20 to-amber-700/10 border-amber-600/50";
      default: return "bg-card border-border";
    }
  };

  const getRankingTitle = () => {
    switch (rankingType) {
      case 'general': return 'Geral';
      case 'sales': return 'Vendas';
      case 'speed': return 'Velocidade';
      case 'ticket': return 'Ticket Médio';
      case 'conversion': return 'Conversão';
      case 'attendance': return 'Atendimento';
      default: return 'Geral';
    }
  };

  const formatResponseTime = (seconds: number) => {
    if (seconds === 0) return '—';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}min`;
    }
    return `${minutes}min ${secs}s`;
  };

  const renderMetricValue = (racer: typeof rankings[0]) => {
    switch (rankingType) {
      case 'speed':
        return (
          <div className="text-right">
            <div className="text-xl font-bold text-racing-accent">
              {formatResponseTime(racer.avg_response_time_seconds)}
            </div>
            <div className="text-sm text-muted-foreground">
              tempo médio
            </div>
          </div>
        );
      case 'ticket':
        return (
          <div className="text-right">
            <div className="text-xl font-bold text-racing-accent">
              R$ {racer.avg_ticket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-muted-foreground">
              ticket médio
            </div>
          </div>
        );
      case 'conversion':
        return (
          <div className="text-right">
            <div className="text-xl font-bold text-racing-accent">
              {racer.conversion_rate.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">
              {racer.total_deals}/{racer.total_leads} leads
            </div>
          </div>
        );
      default: // general, sales, attendance
        return (
          <div className="text-right">
            <div className="text-xl font-bold text-racing-accent">
              R$ {racer.total_sales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-muted-foreground">
              {racer.total_deals} vendas
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-racing-bg">
      <SeasonHeader period={period} onPeriodChange={setPeriod} />

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Tabs de tipo de ranking */}
        <Tabs value={rankingType} onValueChange={(v) => setRankingType(v as RankingType)}>
          <TabsList className="bg-racing-card border border-racing-border grid grid-cols-3 lg:grid-cols-6 w-full">
            <TabsTrigger value="general" className="data-[state=active]:bg-racing-primary data-[state=active]:text-white">
              <Trophy className="w-4 h-4 mr-2" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="sales" className="data-[state=active]:bg-racing-primary data-[state=active]:text-white">
              <DollarSign className="w-4 h-4 mr-2" />
              Vendas
            </TabsTrigger>
            <TabsTrigger value="speed" className="data-[state=active]:bg-racing-primary data-[state=active]:text-white">
              <Zap className="w-4 h-4 mr-2" />
              Velocidade
            </TabsTrigger>
            <TabsTrigger value="ticket" className="data-[state=active]:bg-racing-primary data-[state=active]:text-white">
              <Target className="w-4 h-4 mr-2" />
              Ticket
            </TabsTrigger>
            <TabsTrigger value="conversion" className="data-[state=active]:bg-racing-primary data-[state=active]:text-white">
              <TrendingUp className="w-4 h-4 mr-2" />
              Conversão
            </TabsTrigger>
            <TabsTrigger value="attendance" className="data-[state=active]:bg-racing-primary data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-2" />
              Atendimento
            </TabsTrigger>
          </TabsList>

          <TabsContent value={rankingType} className="mt-6">
            <Card className="bg-racing-card border-racing-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Trophy className="w-5 h-5 text-racing-accent" />
                  Ranking {getRankingTitle()}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-16 bg-muted/20 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : rankings.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum dado de ranking disponível ainda.</p>
                    <p className="text-sm">Os rankings serão calculados conforme as vendas acontecem.</p>
                  </div>
                ) : (
                  rankings.map((racer) => (
                    <div
                      key={racer.user_id}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-all hover:scale-[1.01] ${getPositionStyle(racer.position)}`}
                    >
                      <div className="text-2xl font-bold w-12 text-center">
                        {getRankingIcon(racer.position)}
                      </div>
                      <Avatar className="h-12 w-12 border-2 border-racing-accent">
                        <AvatarImage src={racer.avatar_url || ''} />
                        <AvatarFallback className="bg-racing-primary text-white">
                          {racer.display_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-semibold text-white">{racer.display_name || 'Usuário'}</div>
                        <div className="text-sm text-muted-foreground">
                          Nível: <Badge variant="outline" className="ml-1">{racer.current_level}</Badge>
                        </div>
                      </div>
                      {renderMetricValue(racer)}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
