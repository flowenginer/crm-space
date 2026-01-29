import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Shield, MessageSquare, CheckCircle, XCircle, ExternalLink, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ObjectionAnalysis } from '@/hooks/useSalesEvaluations';

interface ObjectionDetailModalProps {
  objection: ObjectionAnalysis | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewConversation?: (conversationId: string) => void;
}

function getScoreColor(score: number): string {
  if (score >= 7) return 'text-green-600 dark:text-green-400';
  if (score >= 5) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= 3) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function getScoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (score >= 7) return 'default';
  if (score >= 5) return 'secondary';
  return 'destructive';
}

function parseTrecho(trecho: string): { cliente: string; vendedor: string } {
  // Format: "Cliente: 'mensagem' | Vendedor: 'resposta'"
  const parts = trecho.split(' | ');
  let cliente = '';
  let vendedor = '';
  
  parts.forEach(part => {
    if (part.startsWith('Cliente:')) {
      cliente = part.replace('Cliente:', '').trim().replace(/^'|'$/g, '');
    } else if (part.startsWith('Vendedor:')) {
      vendedor = part.replace('Vendedor:', '').trim().replace(/^'|'$/g, '');
    }
  });
  
  return { cliente, vendedor };
}

export function ObjectionDetailModal({ 
  objection, 
  open, 
  onOpenChange,
  onViewConversation 
}: ObjectionDetailModalProps) {
  if (!objection) return null;

  const { scoreDistribution, trechos } = objection;
  const totalDistribution = scoreDistribution.bom + scoreDistribution.regular + scoreDistribution.fraco + scoreDistribution.critico;
  const bomPercentage = totalDistribution > 0 ? Math.round((scoreDistribution.bom / totalDistribution) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span>{objection.name}</span>
            </div>
            <Badge variant={getScoreBadgeVariant(objection.avgScore)} className="text-base">
              Nota: {objection.avgScore}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-hidden flex flex-col flex-1">
          {/* Stats Row */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Frequência:</span>
              <span className="font-medium">{objection.frequency}x</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Tratadas:</span>
              <span className="font-medium">{objection.handledRate}%</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">≥7:</span>
              <span className="font-medium text-green-600 dark:text-green-400">{bomPercentage}%</span>
            </div>
          </div>

          {/* Score Distribution */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Distribuição de Notas
            </h4>
            <div className="space-y-1.5">
              <DistributionBar 
                label="Bom (≥7)" 
                count={scoreDistribution.bom} 
                total={totalDistribution}
                color="bg-green-500"
              />
              <DistributionBar 
                label="Regular (5-7)" 
                count={scoreDistribution.regular} 
                total={totalDistribution}
                color="bg-yellow-500"
              />
              <DistributionBar 
                label="Fraco (3-5)" 
                count={scoreDistribution.fraco} 
                total={totalDistribution}
                color="bg-orange-500"
              />
              <DistributionBar 
                label="Crítico (<3)" 
                count={scoreDistribution.critico} 
                total={totalDistribution}
                color="bg-red-500"
              />
            </div>
          </div>

          <Separator />

          {/* Trechos */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4" />
              Exemplos de Trechos ({trechos.length})
            </h4>
            
            {trechos.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Nenhum trecho disponível para esta objeção.
              </div>
            ) : (
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  {trechos.map((item, index) => {
                    const { cliente, vendedor } = parseTrecho(item.trecho);
                    
                    return (
                      <div key={index} className="space-y-2 pb-4 border-b last:border-0">
                        {/* Client message */}
                        {cliente && (
                          <div className="flex justify-start">
                            <div className="max-w-[85%] bg-muted rounded-lg rounded-tl-none p-3">
                              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                👤 Cliente:
                              </div>
                              <p className="text-sm">"{cliente}"</p>
                            </div>
                          </div>
                        )}
                        
                        {/* Seller message */}
                        {vendedor && (
                          <div className="flex justify-end">
                            <div className="max-w-[85%] bg-primary/10 rounded-lg rounded-tr-none p-3">
                              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                🎧 Vendedor:
                              </div>
                              <p className="text-sm">"{vendedor}"</p>
                            </div>
                          </div>
                        )}
                        
                        {/* Metadata */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              {item.tratada ? (
                                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-500" />
                              )}
                              <span>{item.tratada ? 'Tratada' : 'Não tratada'}</span>
                            </div>
                            <span className={getScoreColor(item.nota)}>
                              Nota: {item.nota}
                            </span>
                            {item.conversationDate && (
                              <span>
                                📅 {format(new Date(item.conversationDate), 'dd/MM/yyyy', { locale: ptBR })}
                              </span>
                            )}
                          </div>
                          {onViewConversation && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => onViewConversation(item.evaluationId)}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Ver conversa
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DistributionBar({ 
  label, 
  count, 
  total, 
  color 
}: { 
  label: string; 
  count: number; 
  total: number; 
  color: string;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-muted-foreground">{label}</span>
      <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
        <div 
          className={`h-full ${color} transition-all`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="w-8 text-right font-medium">{count}</span>
    </div>
  );
}
