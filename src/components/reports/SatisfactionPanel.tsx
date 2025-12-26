import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Info, Smile, Frown, Meh, TrendingUp, MessageSquare, Users, ThumbsUp, ThumbsDown } from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useReportSatisfaction, SatisfactionMetrics } from '@/hooks/useReportSatisfaction';

interface SatisfactionPanelProps {
  dateRange: { from: Date; to: Date } | undefined;
}

const NPS_COLORS = {
  promoters: '#10B981',
  passives: '#F59E0B',
  detractors: '#EF4444',
};

const CSAT_COLORS = {
  satisfied: '#10B981',
  neutral: '#F59E0B',
  dissatisfied: '#EF4444',
};

function getNpsClassification(score: number): { label: string; color: string } {
  if (score >= 50) return { label: 'Excelente', color: 'text-status-success' };
  if (score >= 0) return { label: 'Bom', color: 'text-status-warning' };
  return { label: 'Precisa melhorar', color: 'text-status-error' };
}

function getCsatClassification(percent: number): { label: string; color: string } {
  if (percent >= 80) return { label: 'Excelente', color: 'text-status-success' };
  if (percent >= 60) return { label: 'Bom', color: 'text-status-warning' };
  return { label: 'Precisa melhorar', color: 'text-status-error' };
}

export function SatisfactionPanel({ dateRange }: SatisfactionPanelProps) {
  const { data, isLoading } = useReportSatisfaction(dateRange);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  const metrics = data?.metrics;
  const hasData = (metrics?.totalSurveys || 0) > 0;
  const npsClass = getNpsClassification(metrics?.npsScore || 0);
  const csatClass = getCsatClassification(metrics?.csatPercent || 0);

  // Pie chart data for NPS
  const npsPieData = [
    { name: 'Promotores', value: metrics?.promoters || 0, color: NPS_COLORS.promoters },
    { name: 'Passivos', value: metrics?.passives || 0, color: NPS_COLORS.passives },
    { name: 'Detratores', value: metrics?.detractors || 0, color: NPS_COLORS.detractors },
  ].filter(d => d.value > 0);

  // Pie chart data for CSAT
  const csatPieData = [
    { name: 'Satisfeitos', value: metrics?.satisfiedCount || 0, color: CSAT_COLORS.satisfied },
    { name: 'Neutros', value: metrics?.neutralCount || 0, color: CSAT_COLORS.neutral },
    { name: 'Insatisfeitos', value: metrics?.dissatisfiedCount || 0, color: CSAT_COLORS.dissatisfied },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground font-medium">NPS Score</span>
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp size={20} className="text-primary" />
            </div>
          </div>
          <div className={`text-3xl font-bold mb-1 ${npsClass.color}`}>
            {metrics?.npsScore || 0}
          </div>
          <div className={`text-sm ${npsClass.color}`}>{npsClass.label}</div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground font-medium">CSAT</span>
            <div className="p-2 bg-status-success/10 rounded-lg">
              <Smile size={20} className="text-status-success" />
            </div>
          </div>
          <div className={`text-3xl font-bold mb-1 ${csatClass.color}`}>
            {metrics?.csatPercent || 0}%
          </div>
          <div className={`text-sm ${csatClass.color}`}>{csatClass.label}</div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground font-medium">Total Pesquisas</span>
            <div className="p-2 bg-status-info/10 rounded-lg">
              <MessageSquare size={20} className="text-status-info" />
            </div>
          </div>
          <div className="text-3xl font-bold text-foreground mb-1">
            {metrics?.totalSurveys || 0}
          </div>
          <div className="text-sm text-muted-foreground">enviadas</div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground font-medium">Taxa de Resposta</span>
            <div className="p-2 bg-accent/10 rounded-lg">
              <Users size={20} className="text-accent" />
            </div>
          </div>
          <div className="text-3xl font-bold text-foreground mb-1">
            {metrics?.responseRate || 0}%
          </div>
          <div className="text-sm text-muted-foreground">
            {metrics?.totalResponses || 0} respostas
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center py-12">
            <div className="p-4 bg-muted rounded-full mb-4">
              <Info size={32} className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhuma pesquisa de satisfação ainda
            </h3>
            <p className="text-muted-foreground max-w-md">
              Quando você enviar pesquisas de satisfação (NPS ou CSAT) para seus clientes, 
              os resultados aparecerão aqui.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-6">
            {/* NPS Distribution */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-6">Distribuição NPS</h3>
              {npsPieData.length > 0 ? (
                <>
                  <div className="flex justify-center">
                    <ResponsiveContainer width={200} height={200}>
                      <PieChart>
                        <Pie
                          data={npsPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {npsPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 mt-4">
                    <div className="flex items-center gap-2">
                      <ThumbsUp size={16} className="text-status-success" />
                      <span className="text-sm">Promotores: {metrics?.promoters}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Meh size={16} className="text-status-warning" />
                      <span className="text-sm">Passivos: {metrics?.passives}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ThumbsDown size={16} className="text-status-error" />
                      <span className="text-sm">Detratores: {metrics?.detractors}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Info size={24} className="mb-2" />
                  <p className="text-sm">Sem dados NPS</p>
                </div>
              )}
            </div>

            {/* CSAT Distribution */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-6">Distribuição CSAT</h3>
              {csatPieData.length > 0 ? (
                <>
                  <div className="flex justify-center">
                    <ResponsiveContainer width={200} height={200}>
                      <PieChart>
                        <Pie
                          data={csatPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {csatPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 mt-4">
                    <div className="flex items-center gap-2">
                      <Smile size={16} className="text-status-success" />
                      <span className="text-sm">Satisfeitos: {metrics?.satisfiedCount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Meh size={16} className="text-status-warning" />
                      <span className="text-sm">Neutros: {metrics?.neutralCount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Frown size={16} className="text-status-error" />
                      <span className="text-sm">Insatisfeitos: {metrics?.dissatisfiedCount}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Info size={24} className="mb-2" />
                  <p className="text-sm">Sem dados CSAT</p>
                </div>
              )}
            </div>
          </div>

          {/* Timeline Chart */}
          {(data?.timeline?.length || 0) > 0 && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-6">Evolução da Satisfação</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data?.timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="nps" 
                    name="NPS" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary))" 
                    fillOpacity={0.3}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="csat" 
                    name="CSAT %" 
                    stroke="#10B981" 
                    fill="#10B981" 
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Agents Table */}
          {(data?.agents?.length || 0) > 0 && (
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">Satisfação por Atendente</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Atendente</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Respostas</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">NPS</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">CSAT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.agents.map((agent) => (
                    <tr key={agent.agent_id} className="hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={agent.avatar_url || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm">
                              {agent.agent_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">{agent.agent_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-foreground">
                        {agent.total_responses}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          agent.nps_score >= 50 ? 'bg-status-success/10 text-status-success' :
                          agent.nps_score >= 0 ? 'bg-status-warning/10 text-status-warning' :
                          'bg-status-error/10 text-status-error'
                        }`}>
                          {agent.nps_score}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          agent.csat_percent >= 80 ? 'bg-status-success/10 text-status-success' :
                          agent.csat_percent >= 60 ? 'bg-status-warning/10 text-status-warning' :
                          'bg-status-error/10 text-status-error'
                        }`}>
                          {agent.csat_percent}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
