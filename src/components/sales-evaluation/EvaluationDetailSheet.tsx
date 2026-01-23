import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  MessageCircle, 
  Bot, 
  Phone, 
  Calendar, 
  Target, 
  TrendingUp,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Eye,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EvaluationDetail } from '@/hooks/useSalesEvaluations';
import { ConversationPreviewDialog } from '@/components/conversations/ConversationPreviewDialog';
import { ObjectionContextDialog } from './ObjectionContextDialog';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';

interface EvaluationDetailSheetProps {
  evaluation: EvaluationDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getScoreColor(score: number): string {
  if (score >= 8.5) return 'text-green-600';
  if (score >= 7) return 'text-blue-600';
  if (score >= 5) return 'text-amber-600';
  if (score >= 3) return 'text-orange-600';
  return 'text-red-600';
}

function getScoreBgColor(score: number): string {
  if (score >= 8.5) return 'bg-green-100 border-green-200';
  if (score >= 7) return 'bg-blue-100 border-blue-200';
  if (score >= 5) return 'bg-amber-100 border-amber-200';
  if (score >= 3) return 'bg-orange-100 border-orange-200';
  return 'bg-red-100 border-red-200';
}

const FUNNEL_STAGES = [
  { key: 'etapaCatalogoReferencia', label: 'Catálogo/Referência' },
  { key: 'etapaMockup', label: 'Mockup' },
  { key: 'etapaAprovacaoMockup', label: 'Aprovação Mockup' },
  { key: 'etapaOrcamentoFinal', label: 'Orçamento Final' },
  { key: 'etapaFechamento', label: 'Fechamento' },
] as const;

export function EvaluationDetailSheet({ evaluation, open, onOpenChange }: EvaluationDetailSheetProps) {
  const [conversationPreviewOpen, setConversationPreviewOpen] = useState(false);
  const [selectedObjection, setSelectedObjection] = useState<{
    name: string;
    originalKey: string;
    tratada: boolean;
    nota: number;
    trecho?: string;
  } | null>(null);

  if (!evaluation) return null;

  const communicationData = [
    { metric: 'Clareza', value: evaluation.comunicacaoClareza },
    { metric: 'Cordialidade', value: evaluation.comunicacaoCordialidade },
    { metric: 'Proatividade', value: evaluation.comunicacaoProatividade },
    { metric: 'Conhecimento', value: evaluation.comunicacaoConhecimentoProduto },
  ];

  const criteriaData = [
    { metric: 'Tempo Resp.', value: evaluation.criterioTempoResposta },
    { metric: 'Personalizaç.', value: evaluation.criterioPersonalizacao },
    { metric: 'Urgência', value: evaluation.criterioSensoUrgencia },
    { metric: 'Recuperação', value: evaluation.criterioRecuperacaoFinal },
    { metric: 'Qualificação', value: evaluation.criterioQualificacaoLead },
    { metric: 'Follow-up', value: evaluation.criterioFollowupEstruturado },
  ];

  // Get objections as array
  const objectionsList = Object.entries(evaluation.objecoes || {}).map(([key, data]) => ({
    name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    originalKey: key,
    trecho: data.trecho,
    ...data,
  }));

  const stagesReached = FUNNEL_STAGES.filter(
    stage => evaluation[stage.key] === 1
  ).length;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
          <SheetHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-lg">
                {evaluation.contact?.fullName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1">
                <SheetTitle className="text-lg">{evaluation.contact?.fullName || 'Cliente'}</SheetTitle>
                <SheetDescription className="flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  {evaluation.contact?.phone || '-'}
                </SheetDescription>
              </div>
              <div className={`px-4 py-2 rounded-xl border-2 ${getScoreBgColor(evaluation.overallScore)}`}>
                <span className={`text-2xl font-bold ${getScoreColor(evaluation.overallScore)}`}>
                  {evaluation.overallScore.toFixed(1)}
                </span>
              </div>
            </div>
            {evaluation.conversationDate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <Calendar className="h-4 w-4" />
                {format(new Date(evaluation.conversationDate), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            )}
          </SheetHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-6 pb-6">
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Communication Radar */}
                <Card className="col-span-1">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium">Comunicação</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={communicationData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis 
                            dataKey="metric" 
                            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} 
                          />
                          <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                          <Radar 
                            dataKey="value" 
                            stroke="hsl(var(--primary))" 
                            fill="hsl(var(--primary))" 
                            fillOpacity={0.4} 
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Criteria Radar */}
                <Card className="col-span-1">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium">Critérios Adicionais</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={criteriaData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis 
                            dataKey="metric" 
                            tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} 
                          />
                          <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                          <Radar 
                            dataKey="value" 
                            stroke="hsl(var(--chart-2))" 
                            fill="hsl(var(--chart-2))" 
                            fillOpacity={0.4} 
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Funnel Stages */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Etapas do Funil ({stagesReached}/{FUNNEL_STAGES.length})
                    </span>
                    {/* Real Conversion Badge */}
                    <Badge 
                      variant={evaluation.realConversion ? "default" : "secondary"}
                      className={evaluation.realConversion ? "bg-green-500 hover:bg-green-600" : ""}
                    >
                      {evaluation.realConversion ? "✓ Converteu" : "Não converteu"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex items-center gap-1">
                    {FUNNEL_STAGES.map((stage, index) => {
                      const reached = evaluation[stage.key] === 1;
                      return (
                        <div key={stage.key} className="flex items-center flex-1">
                          <div 
                            className={`flex-1 h-8 rounded-md flex items-center justify-center text-xs font-medium transition-colors ${
                              reached 
                                ? 'bg-green-500 text-white' 
                                : 'bg-muted text-muted-foreground'
                            }`}
                            title={stage.label}
                          >
                            {reached ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          </div>
                          {index < FUNNEL_STAGES.length - 1 && (
                            <ArrowRight className={`h-3 w-3 mx-0.5 ${reached ? 'text-green-500' : 'text-muted-foreground/50'}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                    <span>Catálogo</span>
                    <span>Fechamento</span>
                  </div>
                  
                  {/* AI vs Real Comparison */}
                  <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Previsão da IA:</span>
                    <span className={`font-medium ${
                      evaluation.etapaFechamento === 1 
                        ? (evaluation.realConversion ? 'text-green-600' : 'text-red-500')
                        : (evaluation.realConversion ? 'text-red-500' : 'text-green-600')
                    }`}>
                      {evaluation.etapaFechamento === 1 ? 'Fecharia' : 'Não fecharia'}
                      {' '}
                      ({(evaluation.etapaFechamento === 1) === evaluation.realConversion ? '✓ Acertou' : '✗ Errou'})
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Objections */}
              {objectionsList.length > 0 && (
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Objeções ({evaluation.objecoesTratadas}/{evaluation.objecoesApareceram} tratadas)
                      </span>
                      <Badge variant="outline" className={getScoreColor(evaluation.objecoesNotaMedia)}>
                        Média: {evaluation.objecoesNotaMedia.toFixed(1)}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                <CardContent className="px-4 pb-4">
                    <div className="space-y-1">
                      {objectionsList.map((obj) => (
                        <div 
                          key={obj.name} 
                          className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted/50 p-2 rounded-md transition-colors group"
                          onClick={() => setSelectedObjection({
                            name: obj.name,
                            originalKey: obj.originalKey,
                            tratada: Boolean(obj.tratada),
                            nota: obj.nota,
                            trecho: obj.trecho,
                          })}
                        >
                          <span className="flex items-center gap-2">
                            {obj.tratada ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            {obj.name}
                            <Search className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                          <Badge variant="outline" className={obj.nota > 0 ? getScoreColor(obj.nota) : ''}>
                            {obj.nota > 0 ? obj.nota.toFixed(1) : '-'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                      <Search className="h-3 w-3" />
                      Clique em uma objeção para ver o contexto na conversa
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* AI Feedback */}
              {evaluation.feedback && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Bot className="h-4 w-4 text-primary" />
                      Feedback da IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {evaluation.feedback}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>

          <Separator className="my-4" />

          {/* Footer Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button onClick={() => setConversationPreviewOpen(true)} className="gap-2">
              <Eye className="h-4 w-4" />
              Ver Conversa
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConversationPreviewDialog
        conversationId={evaluation.conversationId}
        isOpen={conversationPreviewOpen}
        onClose={() => setConversationPreviewOpen(false)}
      />

      <ObjectionContextDialog
        open={!!selectedObjection}
        onOpenChange={(open) => !open && setSelectedObjection(null)}
        objection={selectedObjection}
      />
    </>
  );
}
