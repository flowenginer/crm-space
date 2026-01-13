import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Trophy, Medal, Award } from 'lucide-react';
import { AgentRanking } from '@/hooks/useSalesEvaluations';
import { cn } from '@/lib/utils';

interface AgentRankingTableProps {
  agents: AgentRanking[] | undefined;
  isLoading: boolean;
  onSelectAgent: (agentId: string) => void;
}

const classificationConfig = {
  excellent: { label: 'Excelente', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  good: { label: 'Bom', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  regular: { label: 'Regular', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  weak: { label: 'Fraco', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  critical: { label: 'Crítico', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

function RankBadge({ position }: { position: number }) {
  if (position === 1) {
    return <Trophy className="h-5 w-5 text-yellow-500" />;
  }
  if (position === 2) {
    return <Medal className="h-5 w-5 text-gray-400" />;
  }
  if (position === 3) {
    return <Award className="h-5 w-5 text-amber-600" />;
  }
  return <span className="text-muted-foreground font-medium">{position}º</span>;
}

export function AgentRankingTable({ agents, isLoading, onSelectAgent }: AgentRankingTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Ranking de Vendedores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!agents || agents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Ranking de Vendedores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Nenhuma avaliação encontrada no período
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Ranking de Vendedores
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Pos.</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-center">Avaliações</TableHead>
              <TableHead className="text-center">Score Médio</TableHead>
              <TableHead className="text-center">Fechamento</TableHead>
              <TableHead className="text-center">Condução</TableHead>
              <TableHead className="text-center">Objeções</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent, index) => (
              <TableRow 
                key={agent.id} 
                className={cn(
                  "cursor-pointer hover:bg-muted/50 transition-colors",
                  index < 3 && "bg-gradient-to-r from-transparent to-transparent hover:from-yellow-50/50 dark:hover:from-yellow-900/10"
                )}
                onClick={() => onSelectAgent(agent.id)}
              >
                <TableCell>
                  <div className="flex items-center justify-center">
                    <RankBadge position={index + 1} />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={agent.avatarUrl || undefined} />
                      <AvatarFallback>
                        {agent.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{agent.fullName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">{agent.evaluations}</TableCell>
                <TableCell className="text-center">
                  <span className={cn(
                    "font-semibold",
                    agent.avgScore >= 7 ? "text-green-600 dark:text-green-400" :
                    agent.avgScore >= 5 ? "text-yellow-600 dark:text-yellow-400" :
                    "text-red-600 dark:text-red-400"
                  )}>
                    {agent.avgScore.toFixed(1)}
                  </span>
                </TableCell>
                <TableCell className="text-center">{agent.closingRate}%</TableCell>
                <TableCell className="text-center">{agent.avgConduction.toFixed(1)}</TableCell>
                <TableCell className="text-center">{agent.avgObjectionScore.toFixed(1)}</TableCell>
                <TableCell className="text-center">
                  <Badge className={classificationConfig[agent.classification].className}>
                    {classificationConfig[agent.classification].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAgent(agent.id);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
