import { Loader2, Send, Eye, MessageSquare, CheckCheck } from 'lucide-react';
import type { StepMetrics } from '@/hooks/useMarketingDashboard';

interface CampaignStepFunnelProps {
  steps: StepMetrics[] | undefined;
  isLoading: boolean;
}

export function CampaignStepFunnel({ steps, isLoading }: CampaignStepFunnelProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!steps || steps.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Nenhum dado de steps disponível
      </div>
    );
  }

  const maxSent = Math.max(...steps.map(s => s.sent), 1);

  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div key={index} className="bg-muted/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {index + 1}
            </span>
            <span className="text-sm font-medium text-foreground flex-1 truncate">
              {step.stepMessage}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <MetricBar
              icon={Send}
              label="Enviadas"
              value={step.sent}
              maxValue={maxSent}
              color="from-blue-500 to-blue-600"
            />
            <MetricBar
              icon={CheckCheck}
              label="Entregues"
              value={step.delivered}
              maxValue={maxSent}
              color="from-cyan-500 to-cyan-600"
            />
            <MetricBar
              icon={Eye}
              label="Lidas"
              value={step.read}
              maxValue={maxSent}
              color="from-amber-500 to-amber-600"
            />
            <MetricBar
              icon={MessageSquare}
              label="Responderam"
              value={step.responded}
              maxValue={maxSent}
              color="from-green-500 to-green-600"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface MetricBarProps {
  icon: React.ElementType;
  label: string;
  value: number;
  maxValue: number;
  color: string;
}

function MetricBar({ icon: Icon, label, value, maxValue, color }: MetricBarProps) {
  const percentage = (value / maxValue) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500`}
            style={{ width: `${Math.max(percentage, 2)}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-foreground min-w-[40px] text-right">
          {value.toLocaleString('pt-BR')}
        </span>
      </div>
    </div>
  );
}
