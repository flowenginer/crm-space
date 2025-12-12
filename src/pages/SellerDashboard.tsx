import { useAuth } from '@/hooks/useAuth';
import { useSellerMetrics, useSellerGoalProgress, useSellerPendingOrders, useSellerOpportunities } from '@/hooks/useSellerMetrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ShoppingCart,
  DollarSign,
  Target,
  TrendingUp,
  Clock,
  AlertCircle,
  Sparkles,
  Calendar,
  Phone,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SellerDashboard() {
  const { user } = useAuth();
  const sellerId = user?.id;

  const { data: metrics, isLoading: loadingMetrics } = useSellerMetrics(sellerId);
  const { data: goals, isLoading: loadingGoals } = useSellerGoalProgress(sellerId);
  const { data: pendingOrders = [], isLoading: loadingPending } = useSellerPendingOrders(sellerId);
  const { data: opportunities = [], isLoading: loadingOpportunities } = useSellerOpportunities(sellerId);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const isLoading = loadingMetrics || loadingGoals;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentMonth = format(new Date(), 'MMMM yyyy', { locale: ptBR });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard do Vendedor</h1>
          <p className="text-muted-foreground">Resultados de {currentMonth}</p>
        </div>
        <Badge variant="outline" className="gap-2">
          <Calendar size={14} />
          {goals?.daysRemaining || 0} dias restantes
        </Badge>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pedidos no Mês</p>
                <p className="text-2xl font-bold">{metrics?.totalOrders || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-success/10">
                <DollarSign className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Faturamento</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics?.totalRevenue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <TrendingUp className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics?.averageTicket || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-500/10">
                <Sparkles className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Comissão</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics?.commission || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Progresso das Metas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Target 1 */}
          {goals?.target1.value > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                    Meta 1
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(goals.target1.value)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium">{goals.target1.progress.toFixed(1)}%</span>
                  {goals.target1.remaining > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (faltam {formatCurrency(goals.target1.remaining)})
                    </span>
                  )}
                </div>
              </div>
              <Progress value={goals.target1.progress} className="h-3" />
              {goals.target1.bonus > 0 && (
                <p className="text-xs text-success">
                  Bônus: {formatCurrency(goals.target1.bonus)}
                </p>
              )}
            </div>
          )}

          {/* Target 2 */}
          {goals?.target2.value > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30">
                    Meta 2
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(goals.target2.value)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium">{goals.target2.progress.toFixed(1)}%</span>
                  {goals.target2.remaining > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (faltam {formatCurrency(goals.target2.remaining)})
                    </span>
                  )}
                </div>
              </div>
              <Progress value={goals.target2.progress} className="h-3" />
              {goals.target2.bonus > 0 && (
                <p className="text-xs text-success">
                  Bônus: {formatCurrency(goals.target2.bonus)}
                </p>
              )}
            </div>
          )}

          {/* Target 3 */}
          {goals?.target3.value > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
                    Meta 3
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(goals.target3.value)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium">{goals.target3.progress.toFixed(1)}%</span>
                  {goals.target3.remaining > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (faltam {formatCurrency(goals.target3.remaining)})
                    </span>
                  )}
                </div>
              </div>
              <Progress value={goals.target3.progress} className="h-3" />
              {goals.target3.bonus > 0 && (
                <p className="text-xs text-success">
                  Bônus: {formatCurrency(goals.target3.bonus)}
                </p>
              )}
            </div>
          )}

          {/* Daily target hint */}
          {goals && goals.dailyTarget > 0 && (
            <div className="p-4 bg-muted rounded-xl">
              <p className="text-sm text-muted-foreground">
                Para atingir a <strong>Meta 1</strong>, você precisa vender{' '}
                <strong className="text-primary">{formatCurrency(goals.dailyTarget)}</strong>{' '}
                por dia nos próximos <strong>{goals.daysRemaining} dias</strong>.
              </p>
            </div>
          )}

          {/* No goals configured */}
          {(!goals?.target1.value && !goals?.target2.value && !goals?.target3.value) && (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma meta configurada</p>
              <p className="text-sm">Peça ao administrador para configurar suas metas</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Pedidos Aguardando Pagamento
              {pendingOrders.length > 0 && (
                <Badge variant="secondary">{pendingOrders.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : pendingOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum pedido pendente</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {pendingOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">#{order.order_number}</p>
                        <p className="text-sm text-muted-foreground">{order.contact_name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone size={10} />
                          {order.contact_phone}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{formatCurrency(order.total)}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Opportunities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-success" />
              Oportunidades
              {opportunities.length > 0 && (
                <Badge variant="secondary">{opportunities.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOpportunities ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : opportunities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma oportunidade identificada</p>
              </div>
            ) : (
              <>
                <ScrollArea className="h-[250px]">
                  <div className="space-y-3">
                    {opportunities.map((opp) => (
                      <div
                        key={opp.contact_id}
                        className="flex items-center justify-between p-3 bg-success/5 border border-success/20 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{opp.contact_name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone size={10} />
                            {opp.contact_phone}
                          </p>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {opp.lead_status}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-success">{formatCurrency(opp.negotiated_value)}</p>
                          <Button size="sm" variant="ghost" className="text-xs mt-1">
                            Contatar <ArrowRight size={12} className="ml-1" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Summary */}
                <div className="mt-4 p-4 bg-success/10 rounded-xl">
                  <p className="text-sm">
                    Se você fechar essas oportunidades, pode adicionar{' '}
                    <strong className="text-success">
                      {formatCurrency(opportunities.reduce((sum, o) => sum + o.negotiated_value, 0))}
                    </strong>{' '}
                    ao seu faturamento!
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
