import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBlingStatus, useBlingConfig, useTriggerBlingSync } from '@/hooks/useBlingIntegration';
import { Download, RefreshCw, Zap, Settings } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { BlingImportModal } from './BlingImportModal';

export type BlingEntityType = 'products' | 'contacts' | 'orders' | 'financial';

interface BlingIntegrationBannerProps {
  entityType: BlingEntityType;
}

const entityLabels: Record<BlingEntityType, string> = {
  products: 'Produtos',
  contacts: 'Contatos',
  orders: 'Pedidos',
  financial: 'Financeiro',
};

export function BlingIntegrationBanner({ entityType }: BlingIntegrationBannerProps) {
  const { isConnected, isLoading: statusLoading } = useBlingStatus();
  const { data: config } = useBlingConfig();
  const triggerSync = useTriggerBlingSync();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Não mostrar se não está conectado ou carregando
  if (statusLoading || !isConnected) {
    return null;
  }

  const lastSyncText = config?.last_sync_at 
    ? formatDistanceToNow(new Date(config.last_sync_at), { addSuffix: true, locale: ptBR })
    : 'Nunca sincronizado';

  const handleQuickSync = () => {
    // Map entity type to sync type
    const syncType = entityType === 'financial' ? 'all' : entityType;
    triggerSync.mutate(syncType as any);
  };

  return (
    <>
      <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700">
              Bling Conectado
            </Badge>
          </div>
          <span className="text-sm text-muted-foreground hidden sm:inline">
            Última sync: {lastSyncText}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Importar {entityLabels[entityType]}</span>
            <span className="sm:hidden">Importar</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleQuickSync}
            disabled={triggerSync.isPending}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${triggerSync.isPending ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sincronizar</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-8 w-8"
          >
            <Link to="/settings?tab=integrations">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <BlingImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        entityType={entityType}
      />
    </>
  );
}
