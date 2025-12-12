import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  useSellerMetrics, 
  useSellerGoalProgress, 
  useSellerPendingOrders, 
  useSellerOpportunities,
  useSellerPipeline,
  useSellers 
} from '@/hooks/useSellerMetrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Users,
  FileText,
  Palette,
  BookOpen,
  UserCheck,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const stageIcons: Record<string, React.ReactNode> = {
  '06 - Aguardando pagamento': <Clock className="h-5 w-5" />,
  '05 - Orçamento': <FileText className="h-5 w-5" />,
  '04 - Layout': <Palette className="h-5 w-5" />,
  '03 - Catálogo': <BookOpen className="h-5 w-5" />,
  '02 - Pré-venda': <UserCheck className="h-5 w-5" />,
};

const stageColors: Record<string, string> = {
  'warning': 'bg-warning/10 text-warning',
  'primary': 'bg-primary/10 text-primary',
  'blue': 'bg-blue-500/10 text-blue-500',
  'purple': 'bg-purple-500/10 text-purple-500',
  'muted': 'bg-muted text-muted-foreground',
};

export default function SellerDashboard() {
  const { user, profile } = useAuth();
  const isAdminOrSupervisor = profile?.role === 'admin' || profile?.role === 'supervisor';
  
  const [selectedSellerId, setSelectedSellerId] = useState<string>(user?.id || '');
  const activeSellerId = selectedSellerId || user?.id;

  const { data: sellers = [], isLoading: loadingSellers } = useSellers();
  const { data: metrics, isLoading: loadingMetrics } = useSellerMetrics(activeSellerId);
  const { data: goals, isLoading: loadingGoals } = useSellerGoalProgress(activeSellerId);
  const { data: pendingOrders = [], isLoading: loadingPending } = useSellerPendingOrders(activeSellerId);
  const { data: opportunities = [], isLoading: loadingOpportunities } = useSellerOpportunities(activeSellerId);
  const { data: pipeline = [], isLoading: loadingPipeline } = useSellerPipeline(activeSellerId);

  const isLoading = loadingMetrics || loadingGoals;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentMonth = format(new Date(), 'MMMM yyyy', { locale: ptBR });
  const selectedSellerName = sellers.find(s => s.id === activeSellerId)?.full_name || 'Vendedor';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard do Vendedor</h1>
          <p className="text-muted-foreground">Resultados de {currentMonth}</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Seller Filter - only for admin/supervisor */}
          {isAdminOrSupervisor && (
            <Select 
              value={selectedSellerId || user?.id || ''} 
              onValueChange={setSelectedSellerId}
            >
              <SelectTrigger className="w-[200px]">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Selecionar vendedor" />
              </SelectTrigger>
              <SelectContent>
                {sellers.map((seller) => (
                  <SelectItem key={seller.id} value={seller.id}>
                    {seller.full_name || 'Sem nome'}
                    {seller.id === user?.id && ' (você)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <Badge variant="outline" className="gap-2">
            <Calendar size={14} />
            {goals?.daysRemaining || 0} dias restantes
          </Badge>
        </div>
      </div>

      {/* Selected Seller Badge */}
      {isAdminOrSupervisor && selectedSellerId && selectedSellerId !== user?.id && (
        <div className="bg-muted/50 border border-border rounded-lg p-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Visualizando dados de: <strong className="text-foreground">{selectedSellerName}</strong>
          </span>
        </div>
      )}

      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conversões no Mês</p>
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

      {/* Pipeline Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Pipeline de Vendas
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {loadingPipeline ? (
            <div className="col-span-full flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            pipeline.map((stage) => (
              <Card key={stage.status} className="relative overflow-hidden">
                <CardContent className="pt-4 pb-3">
                  <div className={`inline-flex p-2 rounded-lg mb-2 ${stageColors[stage.color] || stageColors.muted}`}>
                    {stageIcons[stage.status] || <Users className="h-5 w-5" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{stage.label}</p>
                  <p className="text-xl font-bold">{stage.count}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(stage.value)}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
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
          {/* Current Revenue Summary */}
          {goals && goals.totalRevenue > 0 && (
            <div className="p-4 bg-success/10 border border-success/20 rounded-xl mb-4">
              <p className="text-sm text-muted-foreground">Faturamento atual do mês</p>
              <p className="text-2xl font-bold text-success">{formatCurrency(goals.totalRevenue)}</p>
            </div>
          )}

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
        {/* Pending Payment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Aguardando Pagamento
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
                <p>Nenhum cliente aguardando pagamento</p>
              </div>
            ) : (
              <>
                <ScrollArea className="h-[280px]">
                  <div className="space-y-3">
                    {pendingOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3 bg-warning/5 border border-warning/20 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{order.contact_name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone size={10} />
                            {order.contact_phone}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-warning">{formatCurrency(order.total)}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="mt-4 p-3 bg-warning/10 rounded-xl">
                  <p className="text-sm font-medium">
                    Total aguardando: {formatCurrency(pendingOrders.reduce((sum, o) => sum + o.total, 0))}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Opportunities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-success" />
              Oportunidades Quentes
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
                <p className="text-sm">Contatos em orçamento ou layout aparecerão aqui</p>
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
