import { 
  Send, 
  DollarSign, 
  TrendingUp, 
  User,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { TemplateStatsSummary } from '@/hooks/useTemplateStats';

interface TemplateStatsCardsProps {
  summary: TemplateStatsSummary;
  isLoading?: boolean;
}

export function TemplateStatsCards({ summary, isLoading }: TemplateStatsCardsProps) {
  const cards = [
    {
      title: 'Total Enviados',
      value: isLoading ? '-' : summary.totalSent.toLocaleString('pt-BR'),
      icon: Send,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Fora da Janela 24h',
      value: isLoading ? '-' : summary.outsideWindowCount.toLocaleString('pt-BR'),
      subtitle: isLoading ? '' : `${summary.outsideWindowPercentage.toFixed(1)}% do total`,
      icon: Clock,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'Dentro da Janela',
      value: isLoading ? '-' : summary.insideWindowCount.toLocaleString('pt-BR'),
      subtitle: 'Sem cobrança',
      icon: CheckCircle,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'Custo Real',
      value: isLoading ? '-' : `R$ ${summary.chargedCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: 'Apenas cobrados',
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Categoria Top',
      value: isLoading ? '-' : summary.topCategory,
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Top Enviador',
      value: isLoading ? '-' : summary.topSender,
      icon: User,
      color: 'text-sky-500',
      bgColor: 'bg-sky-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md ${card.bgColor}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
                <p className="text-xs text-muted-foreground truncate">{card.title}</p>
              </div>
              <div className="flex flex-col">
                <p className="text-lg font-semibold truncate">{card.value}</p>
                {card.subtitle && (
                  <p className="text-xs text-muted-foreground truncate">{card.subtitle}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
