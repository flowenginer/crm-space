import { ArrowRight, CheckCircle2, AlertCircle, Users, FileCheck, ShoppingCart, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { SegmentJourneyData } from '@/hooks/useMetaSegmentJourney';
import { cn } from '@/lib/utils';

interface SegmentJourneyChartProps {
  data: SegmentJourneyData[];
  isLoading?: boolean;
}

export function SegmentJourneyChart({ data, isLoading }: SegmentJourneyChartProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p>Nenhum dado de jornada encontrado no período selecionado</p>
        <p className="text-sm mt-1">Certifique-se de que os nomes das campanhas contêm nomes de segmentos cadastrados</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {data.map((journey) => (
        <div
          key={journey.campaignSegment}
          className="bg-muted/30 rounded-xl p-6 border border-border/50"
        >
          {/* Header com nome do segmento da campanha */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <h4 className="text-lg font-semibold text-foreground">
                {journey.campaignSegment}
              </h4>
              <span className="text-sm text-muted-foreground">
                ({journey.totalLeads} leads)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {journey.matchRate >= 50 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              <span className={cn(
                "text-sm font-medium",
                journey.matchRate >= 50 ? "text-emerald-500" : "text-amber-500"
              )}>
                {journey.matchRate.toFixed(0)}% match
              </span>
            </div>
          </div>

          {/* Barra de progresso do match */}
          <div className="mb-6">
            <Progress 
              value={journey.matchRate} 
              className={cn(
                "h-2",
                journey.matchRate >= 50 ? "[&>div]:bg-emerald-500" : "[&>div]:bg-amber-500"
              )}
            />
          </div>

          {/* Flow visual */}
          <div className="space-y-3">
            {journey.breakdown.map((item, index) => (
              <div
                key={`${journey.campaignSegment}-${item.assignedSegment}-${index}`}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg transition-all",
                  item.isMatch 
                    ? "bg-emerald-500/10 border border-emerald-500/30" 
                    : "bg-background/50 border border-border/30"
                )}
              >
                {/* Coluna 1: Campanha */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      item.isMatch ? "bg-emerald-500" : "bg-muted-foreground"
                    )} />
                    <span className="text-sm font-medium text-foreground truncate">
                      Campanha: {journey.campaignSegment}
                    </span>
                  </div>
                </div>

                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

                {/* Coluna 2: Segmento marcado */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {item.isMatch ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                    )}
                    <span className={cn(
                      "text-sm font-medium truncate",
                      item.isMatch ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                    )}>
                      {item.assignedSegment}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      ({item.count} leads - {((item.count / journey.totalLeads) * 100).toFixed(0)}%)
                    </span>
                  </div>
                </div>

                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

                {/* Coluna 3: Em Layout */}
                <div className="flex items-center gap-3 min-w-[140px]">
                  <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1.5 rounded-lg">
                    <FileCheck className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {item.layoutCount}
                    </span>
                    <span className="text-xs text-muted-foreground">Layout</span>
                  </div>
                </div>

                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

                {/* Coluna 4: Pedido Fechado */}
                <div className="flex items-center gap-3 min-w-[160px]">
                  <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-lg">
                    <ShoppingCart className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      {item.pedidoFechadoCount}
                    </span>
                    <span className="text-xs text-muted-foreground">Fechado</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Legenda */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>Segmento correto (match)</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Segmento diferente</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
