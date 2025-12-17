import { CheckCircle2, AlertCircle, Users, FileCheck, ShoppingCart, Loader2, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { SegmentJourneyData } from '@/hooks/useMetaSegmentJourney';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

  // Calculate totals
  const totals = data.reduce((acc, journey) => ({
    totalLeads: acc.totalLeads + journey.totalLeads,
    totalMatches: acc.totalMatches + journey.matchCount,
    totalLayout: acc.totalLayout + journey.breakdown.reduce((sum, b) => sum + b.layoutCount, 0),
    totalFechado: acc.totalFechado + journey.breakdown.reduce((sum, b) => sum + b.pedidoFechadoCount, 0),
  }), { totalLeads: 0, totalMatches: 0, totalLayout: 0, totalFechado: 0 });

  const overallMatchRate = totals.totalLeads > 0 ? (totals.totalMatches / totals.totalLeads) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Total Leads</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totals.totalLeads}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium">Taxa Match</span>
            </div>
            <p className="text-2xl font-bold mt-1">{overallMatchRate.toFixed(0)}%</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
              <FileCheck className="h-4 w-4" />
              <span className="text-xs font-medium">Em Layout</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totals.totalLayout}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <ShoppingCart className="h-4 w-4" />
              <span className="text-xs font-medium">Fechados</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totals.totalFechado}</p>
          </CardContent>
        </Card>
      </div>

      {/* Journey Cards */}
      {data.map((journey) => {
        const layoutTotal = journey.breakdown.reduce((sum, b) => sum + b.layoutCount, 0);
        const fechadoTotal = journey.breakdown.reduce((sum, b) => sum + b.pedidoFechadoCount, 0);
        
        return (
          <Card key={journey.campaignSegment} className="overflow-hidden">
            <CardHeader className="pb-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Campanha: {journey.campaignSegment}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {journey.totalLeads} leads capturados
                    </p>
                  </div>
                </div>
                <Badge 
                  variant={journey.matchRate >= 50 ? "default" : "secondary"}
                  className={cn(
                    "text-sm px-3 py-1",
                    journey.matchRate >= 50 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" 
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  )}
                >
                  {journey.matchRate >= 50 ? (
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 mr-1" />
                  )}
                  {journey.matchRate.toFixed(0)}% match
                </Badge>
              </div>
              
              {/* Progress bar */}
              <div className="mt-3">
                <Progress 
                  value={journey.matchRate} 
                  className={cn(
                    "h-1.5",
                    journey.matchRate >= 50 ? "[&>div]:bg-emerald-500" : "[&>div]:bg-amber-500"
                  )}
                />
              </div>
            </CardHeader>
            
            <CardContent className="pt-4">
              {/* Breakdown Table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Segmento Marcado</th>
                      <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Leads</th>
                      <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Layout</th>
                      <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Fechado</th>
                      <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journey.breakdown.map((item, index) => (
                      <tr 
                        key={`${journey.campaignSegment}-${item.assignedSegment}-${index}`}
                        className={cn(
                          "border-t border-border transition-colors",
                          item.isMatch ? "bg-emerald-500/5" : "hover:bg-muted/30"
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              item.isMatch ? "bg-emerald-500" : "bg-muted-foreground"
                            )} />
                            <span className={cn(
                              "font-medium",
                              item.isMatch ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                            )}>
                              {item.assignedSegment}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-semibold">{item.count}</span>
                          <span className="text-muted-foreground text-xs ml-1">
                            ({((item.count / journey.totalLeads) * 100).toFixed(0)}%)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30">
                            {item.layoutCount}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                            {item.pedidoFechadoCount}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.isMatch ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Match
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Diferente
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 border-t border-border font-medium">
                      <td className="px-4 py-2.5">Total</td>
                      <td className="px-4 py-2.5 text-center">{journey.totalLeads}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30">
                          {layoutTotal}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                          {fechadoTotal}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={cn(
                          "text-sm font-medium",
                          journey.matchRate >= 50 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                        )}>
                          {journey.matchCount} matches
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
