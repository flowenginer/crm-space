import { Loader2, Trophy, Medal, Award } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AgentPerformance } from '@/hooks/useDashboardAdvanced';

interface AgentPerformanceTableProps {
  data: AgentPerformance[];
  isLoading?: boolean;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  return `${Math.round(seconds / 3600)}h`;
}

function getRankIcon(position: number) {
  if (position === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (position === 1) return <Medal className="h-5 w-5 text-gray-400" />;
  if (position === 2) return <Award className="h-5 w-5 text-amber-600" />;
  return <span className="text-muted-foreground font-medium">{position + 1}º</span>;
}

export function AgentPerformanceTable({ data, isLoading }: AgentPerformanceTableProps) {
  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <h3 className="text-lg font-semibold text-foreground mb-4">Ranking de Vendedores</h3>
        <div className="h-[250px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
      <h3 className="text-lg font-semibold text-foreground mb-4">Ranking de Vendedores</h3>
      
      {data.length === 0 ? (
        <div className="h-[250px] flex items-center justify-center text-muted-foreground">
          <p>Nenhum vendedor encontrado</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">#</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Conversões</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
                <TableHead className="text-right">T. Resposta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 5).map((agent, index) => (
                <TableRow key={agent.id} className="group">
                  <TableCell className="font-medium">
                    <div className="flex items-center justify-center w-8 h-8">
                      {getRankIcon(index)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={agent.avatar} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {agent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{agent.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{agent.leadsAssigned}</TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold text-success">{agent.conversions}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={(agent.conversionRate ?? 0) >= 10 ? 'text-success' : 'text-muted-foreground'}>
                      {(agent.conversionRate ?? 0).toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatTime(agent.avgResponseTime)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
