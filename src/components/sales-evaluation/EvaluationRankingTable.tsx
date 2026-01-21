import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trophy, Medal, Award, Eye, MessageSquare, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAgentEvaluations, EvaluationDetail } from '@/hooks/useSalesEvaluations';

interface EvaluationRankingTableProps {
  agentId: string;
  dateRange: { from: Date; to: Date };
  onSelectEvaluation: (evaluation: EvaluationDetail) => void;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
  return <span className="text-muted-foreground font-medium">{rank}º</span>;
}

function getScoreColor(score: number): string {
  if (score >= 8.5) return 'text-green-600 bg-green-100';
  if (score >= 7) return 'text-blue-600 bg-blue-100';
  if (score >= 5) return 'text-amber-600 bg-amber-100';
  if (score >= 3) return 'text-orange-600 bg-orange-100';
  return 'text-red-600 bg-red-100';
}

export function EvaluationRankingTable({ agentId, dateRange, onSelectEvaluation }: EvaluationRankingTableProps) {
  const { data: evaluations, isLoading } = useAgentEvaluations(agentId, dateRange.from, dateRange.to);

  // Sort by overall score (highest first)
  const sortedEvaluations = evaluations ? [...evaluations].sort((a, b) => b.overallScore - a.overallScore) : [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversas Avaliadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sortedEvaluations || sortedEvaluations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversas Avaliadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma avaliação encontrada para este período</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate average communication score
  const getCommAvg = (e: EvaluationDetail) => 
    (e.comunicacaoClareza + e.comunicacaoCordialidade + e.comunicacaoProatividade + e.comunicacaoConhecimentoProduto) / 4;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Conversas Avaliadas ({sortedEvaluations.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">Pos.</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-center">Score</TableHead>
              <TableHead className="text-center">Fechou?</TableHead>
              <TableHead className="text-center">Objeções</TableHead>
              <TableHead className="text-center">Comunicação</TableHead>
              <TableHead className="w-24">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEvaluations.map((evaluation, index) => {
              const commAvg = getCommAvg(evaluation);
              const previousScore = index > 0 ? sortedEvaluations[index - 1].overallScore : null;
              const scoreDiff = previousScore !== null ? evaluation.overallScore - previousScore : null;
              
              return (
                <TableRow 
                  key={evaluation.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onSelectEvaluation(evaluation)}
                >
                  <TableCell className="text-center">
                    <RankBadge rank={index + 1} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{evaluation.contact?.fullName || 'Cliente'}</span>
                      <span className="text-xs text-muted-foreground">{evaluation.contact?.phone || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {evaluation.conversationDate ? (
                      <span className="text-sm">
                        {format(new Date(evaluation.conversationDate), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={`font-bold ${getScoreColor(evaluation.overallScore)}`}>
                      {evaluation.overallScore.toFixed(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {evaluation.etapaFechamento === 1 ? (
                      <Badge className="bg-green-500 hover:bg-green-600">Sim</Badge>
                    ) : (
                      <Badge variant="secondary">Não</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-medium">{evaluation.objecoesNotaMedia.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">
                        {evaluation.objecoesTratadas}/{evaluation.objecoesApareceram}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={getScoreColor(commAvg)}>
                      {commAvg.toFixed(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvaluation(evaluation);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
