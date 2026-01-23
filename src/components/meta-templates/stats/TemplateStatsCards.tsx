import { 
  Send, 
  DollarSign, 
  TrendingUp, 
  User 
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
      title: 'Custo Estimado',
      value: isLoading ? '-' : `R$ ${summary.estimatedCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Categoria Mais Usada',
      value: isLoading ? '-' : summary.topCategory,
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Top Enviador',
      value: isLoading ? '-' : summary.topSender,
      icon: User,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{card.title}</p>
                <p className="text-lg font-semibold truncate">{card.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
