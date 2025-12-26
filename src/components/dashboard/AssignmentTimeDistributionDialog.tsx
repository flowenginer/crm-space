import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Clock } from 'lucide-react';
import { formatDuration } from '@/hooks/useLeadJourneyDashboard';

interface DistributionItem {
  range: string;
  count: number;
  percentage: number;
  order: number;
}

interface AssignmentTimeDistributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  distribution: DistributionItem[];
  median: number;
  total: number;
}

const RANGE_COLORS: Record<string, string> = {
  '< 1 min': 'bg-green-500',
  '1-5 min': 'bg-emerald-500',
  '5-15 min': 'bg-blue-500',
  '15-60 min': 'bg-yellow-500',
  '1-24 horas': 'bg-orange-500',
  '> 24 horas': 'bg-red-500',
};

export function AssignmentTimeDistributionDialog({
  open,
  onOpenChange,
  distribution,
  median,
  total,
}: AssignmentTimeDistributionDialogProps) {
  const maxPercentage = Math.max(...distribution.map(d => d.percentage), 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-500" />
            Distribuição: Tempo para Atribuição
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {distribution
            .sort((a, b) => a.order - b.order)
            .map((item) => {
              const barColor = RANGE_COLORS[item.range] || 'bg-primary';
              const normalizedWidth = (item.percentage / maxPercentage) * 100;

              return (
                <div key={item.range} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{item.range}</span>
                    <span className="text-muted-foreground">
                      {(item.count ?? 0).toLocaleString('pt-BR')} ({item.percentage ?? 0}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${normalizedWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}

          <div className="mt-6 pt-4 border-t border-border space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total de atribuições</span>
              <span className="font-semibold text-foreground">{(total ?? 0).toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mediana</span>
              <span className="font-semibold text-purple-600">{formatDuration(median)}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
