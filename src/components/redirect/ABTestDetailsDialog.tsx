import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Trophy, 
  Eye, 
  Users, 
  TrendingUp,
  ExternalLink,
  Play,
  Pause,
  Award
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ABTest } from '@/hooks/useABTests';
import { useDeclareWinner, useUpdateABTest } from '@/hooks/useABTests';

interface ABTestDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  test: ABTest | null;
}

export function ABTestDetailsDialog({ open, onOpenChange, test }: ABTestDetailsDialogProps) {
  const [declareWinnerDialog, setDeclareWinnerDialog] = useState<string | null>(null);
  const declareWinner = useDeclareWinner();
  const updateABTest = useUpdateABTest();

  if (!test) return null;

  const baseUrl = window.location.origin;
  
  // Calculate totals
  const totalViews = test.variants?.reduce((sum, v) => sum + (v.views_count || 0), 0) || 0;
  const totalLeads = test.variants?.reduce((sum, v) => sum + (v.leads_count || 0), 0) || 0;
  const overallConversion = totalViews > 0 ? ((totalLeads / totalViews) * 100) : 0;

  // Find winner variant
  const winnerVariant = test.winner_variant_id 
    ? test.variants?.find(v => v.id === test.winner_variant_id)
    : null;

  // Sort variants by conversion rate
  const sortedVariants = [...(test.variants || [])].sort((a, b) => {
    const rateA = a.views_count > 0 ? (a.leads_count / a.views_count) : 0;
    const rateB = b.views_count > 0 ? (b.leads_count / b.views_count) : 0;
    return rateB - rateA;
  });

  const handleDeclareWinner = async (variantId: string) => {
    await declareWinner.mutateAsync({ testId: test.id, variantId });
    setDeclareWinnerDialog(null);
  };

  const handleToggleStatus = async () => {
    const newStatus = test.status === 'running' ? 'paused' : 'running';
    await updateABTest.mutateAsync({ id: test.id, status: newStatus });
  };

  const getGoalProgress = () => {
    if (!test.goal_type || !test.goal_value) return null;
    
    if (test.goal_type === 'visits') {
      return {
        current: totalViews,
        target: test.goal_value,
        progress: Math.min((totalViews / test.goal_value) * 100, 100),
        label: 'visitas'
      };
    }
    if (test.goal_type === 'leads') {
      return {
        current: totalLeads,
        target: test.goal_value,
        progress: Math.min((totalLeads / test.goal_value) * 100, 100),
        label: 'leads'
      };
    }
    if (test.goal_type === 'time' && test.end_date) {
      const start = new Date(test.created_at).getTime();
      const end = new Date(test.end_date).getTime();
      const now = Date.now();
      return {
        current: Math.floor((now - start) / (1000 * 60 * 60 * 24)),
        target: Math.floor((end - start) / (1000 * 60 * 60 * 24)),
        progress: Math.min(((now - start) / (end - start)) * 100, 100),
        label: 'dias'
      };
    }
    return null;
  };

  const goalProgress = getGoalProgress();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  {test.name}
                  {test.status === 'completed' && (
                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                      <Trophy className="h-3 w-3 mr-1" />
                      Concluído
                    </Badge>
                  )}
                  {test.status === 'running' && (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                      <Play className="h-3 w-3 mr-1" />
                      Ativo
                    </Badge>
                  )}
                  {test.status === 'paused' && (
                    <Badge variant="secondary">
                      <Pause className="h-3 w-3 mr-1" />
                      Pausado
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  {baseUrl}/ab/{test.slug}
                </DialogDescription>
              </div>
              
              {test.status !== 'completed' && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleToggleStatus}
                  disabled={updateABTest.isPending}
                >
                  {test.status === 'running' ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pausar Teste
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Retomar Teste
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Eye className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
                  <p className="text-2xl font-bold">{totalViews.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Visitas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
                  <p className="text-2xl font-bold">{totalLeads.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Leads</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
                  <p className="text-2xl font-bold">{overallConversion.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Conversão</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Trophy className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
                  <p className="text-2xl font-bold">{test.variants?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Variantes</p>
                </CardContent>
              </Card>
            </div>

            {/* Goal Progress */}
            {goalProgress && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Progresso da Meta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>{goalProgress.current.toLocaleString()} / {goalProgress.target.toLocaleString()} {goalProgress.label}</span>
                    <span className="font-medium">{goalProgress.progress.toFixed(1)}%</span>
                  </div>
                  <Progress value={goalProgress.progress} className="h-3" />
                  {test.auto_winner && test.status !== 'completed' && (
                    <p className="text-xs text-muted-foreground">
                      ⚡ O teste será encerrado automaticamente e o tráfego será redirecionado para o campeão
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Winner Banner */}
            {winnerVariant && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-amber-500/20">
                        <Trophy className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="font-semibold">Campeão: {winnerVariant.campaign?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Taxa de conversão: {winnerVariant.views_count > 0 
                            ? ((winnerVariant.leads_count / winnerVariant.views_count) * 100).toFixed(2)
                            : 0}%
                        </p>
                      </div>
                    </div>
                    {test.auto_winner && (
                      <Badge>100% do tráfego</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Variants Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Desempenho das Variantes</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead className="text-center">Peso</TableHead>
                      <TableHead className="text-center">Visitas</TableHead>
                      <TableHead className="text-center">Leads</TableHead>
                      <TableHead className="text-center">Conversão</TableHead>
                      {test.status !== 'completed' && <TableHead className="text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedVariants.map((variant, index) => {
                      const conversionRate = variant.views_count > 0 
                        ? ((variant.leads_count / variant.views_count) * 100).toFixed(2)
                        : '0.00';
                      const isWinner = winnerVariant?.id === variant.id;
                      const isBest = index === 0 && !winnerVariant;

                      return (
                        <TableRow key={variant.id} className={isWinner ? 'bg-amber-500/5' : ''}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {isWinner && <Trophy className="h-4 w-4 text-amber-500" />}
                              <span className="font-medium">{variant.campaign?.name}</span>
                              {isBest && (
                                <Badge variant="outline" className="text-xs">
                                  Melhor
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">/r/{variant.campaign?.slug}</p>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{variant.weight}%</Badge>
                          </TableCell>
                          <TableCell className="text-center">{variant.views_count.toLocaleString()}</TableCell>
                          <TableCell className="text-center">{variant.leads_count.toLocaleString()}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={isBest || isWinner ? 'default' : 'secondary'}>
                              {conversionRate}%
                            </Badge>
                          </TableCell>
                          {test.status !== 'completed' && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeclareWinnerDialog(variant.id)}
                              >
                                <Award className="h-4 w-4 mr-1" />
                                Declarar Campeão
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Info */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Criado em {format(new Date(test.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
              {test.end_date && (
                <span>
                  Término: {format(new Date(test.end_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Declare Winner Confirmation */}
      <AlertDialog open={!!declareWinnerDialog} onOpenChange={() => setDeclareWinnerDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Declarar Campeão</AlertDialogTitle>
            <AlertDialogDescription>
              Ao declarar um campeão, o teste será encerrado. 
              {test.auto_winner && ' Todo o tráfego será redirecionado para esta campanha.'}
              {' '}Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => declareWinnerDialog && handleDeclareWinner(declareWinnerDialog)}
              disabled={declareWinner.isPending}
            >
              <Trophy className="h-4 w-4 mr-2" />
              Confirmar Campeão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
