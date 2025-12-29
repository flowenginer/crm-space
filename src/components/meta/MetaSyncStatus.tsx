import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, Clock, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MetaSyncStatusProps {
  lastSyncAt: string | null;
  lastAutoSyncAt?: string | null;
  autoSyncEnabled?: boolean;
  isSyncing?: boolean;
}

export function MetaSyncStatus({ 
  lastSyncAt, 
  lastAutoSyncAt, 
  autoSyncEnabled = true,
  isSyncing = false 
}: MetaSyncStatusProps) {
  const getStatusInfo = () => {
    if (isSyncing) {
      return {
        icon: Loader2,
        iconClass: 'h-3.5 w-3.5 animate-spin text-blue-500',
        badgeVariant: 'outline' as const,
        label: 'Sincronizando...',
        color: 'border-blue-500/50 bg-blue-500/10 text-blue-600'
      };
    }

    if (!lastSyncAt) {
      return {
        icon: AlertCircle,
        iconClass: 'h-3.5 w-3.5 text-amber-500',
        badgeVariant: 'outline' as const,
        label: 'Nunca sincronizado',
        color: 'border-amber-500/50 bg-amber-500/10 text-amber-600'
      };
    }

    const lastSync = new Date(lastSyncAt);
    const now = new Date();
    const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);

    if (hoursSinceSync < 2) {
      return {
        icon: CheckCircle,
        iconClass: 'h-3.5 w-3.5 text-green-500',
        badgeVariant: 'outline' as const,
        label: 'Atualizado',
        color: 'border-green-500/50 bg-green-500/10 text-green-600'
      };
    } else if (hoursSinceSync < 6) {
      return {
        icon: Clock,
        iconClass: 'h-3.5 w-3.5 text-blue-500',
        badgeVariant: 'outline' as const,
        label: 'Recente',
        color: 'border-blue-500/50 bg-blue-500/10 text-blue-600'
      };
    } else if (hoursSinceSync < 24) {
      return {
        icon: Clock,
        iconClass: 'h-3.5 w-3.5 text-amber-500',
        badgeVariant: 'outline' as const,
        label: 'Desatualizado',
        color: 'border-amber-500/50 bg-amber-500/10 text-amber-600'
      };
    } else {
      return {
        icon: AlertCircle,
        iconClass: 'h-3.5 w-3.5 text-red-500',
        badgeVariant: 'outline' as const,
        label: 'Muito antigo',
        color: 'border-red-500/50 bg-red-500/10 text-red-600'
      };
    }
  };

  const status = getStatusInfo();
  const Icon = status.icon;

  const formatSyncTime = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    return `${formatDistanceToNow(date, { addSuffix: true, locale: ptBR })} (${format(date, "dd/MM 'às' HH:mm", { locale: ptBR })})`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={status.badgeVariant} 
            className={`gap-1.5 cursor-default ${status.color}`}
          >
            <Icon className={status.iconClass} />
            {status.label}
            {autoSyncEnabled && !isSyncing && (
              <RefreshCw className="h-3 w-3 ml-0.5 text-muted-foreground" />
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1.5 text-sm">
            <p><strong>Última sync:</strong> {formatSyncTime(lastSyncAt)}</p>
            {lastAutoSyncAt && (
              <p><strong>Última auto-sync:</strong> {formatSyncTime(lastAutoSyncAt)}</p>
            )}
            <p className="flex items-center gap-1">
              <strong>Sync automática:</strong> 
              {autoSyncEnabled ? (
                <span className="text-green-600">Ativa (a cada 1h)</span>
              ) : (
                <span className="text-muted-foreground">Desativada</span>
              )}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
