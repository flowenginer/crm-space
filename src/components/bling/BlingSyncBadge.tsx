import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BlingSyncBadgeProps {
  lastSyncedAt?: string | null;
  blingNumero?: string | null;
  size?: 'sm' | 'default';
}

export function BlingSyncBadge({ lastSyncedAt, blingNumero, size = 'sm' }: BlingSyncBadgeProps) {
  const syncText = lastSyncedAt 
    ? formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true, locale: ptBR })
    : 'Nunca sincronizado';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 ${size === 'sm' ? 'text-xs px-1.5 py-0.5' : ''}`}
          >
            <RefreshCw className={`${size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} />
            Bling
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm space-y-1">
            <p className="font-medium">Sincronizado com Bling</p>
            {blingNumero && <p>Código Bling: {blingNumero}</p>}
            <p className="text-muted-foreground">{syncText}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
