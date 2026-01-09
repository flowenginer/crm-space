import { useEffect, useRef, useState } from 'react';
import { syncChannelStatus } from '@/lib/whatsapp/instance-creator';
import { toast } from 'sonner';

interface WhatsAppChannel {
  id: string;
  name: string;
  status?: string;
}

interface SyncProgress {
  current: number;
  total: number;
  channelName: string;
}

/**
 * Hook para sincronizar automaticamente o status dos canais WhatsApp
 * quando a página carrega. Isso garante que o usuário sempre veja
 * o status atualizado dos canais, mesmo se o webhook falhar.
 */
export function useAutoSyncChannelStatus(
  channels: WhatsAppChannel[],
  enabled: boolean,
  onComplete?: () => void
) {
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const hasSynced = useRef(false);
  const channelsRef = useRef<WhatsAppChannel[]>([]);

  // Atualiza a referência dos canais
  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  useEffect(() => {
    // Só sincroniza uma vez por montagem do componente
    if (!enabled || hasSynced.current || channels.length === 0) return;

    const doSync = async () => {
      hasSynced.current = true;
      setIsAutoSyncing(true);
      
      let changedCount = 0;
      let errorCount = 0;
      const channelsToSync = [...channels]; // Snapshot dos canais

      console.log(`[AutoSync] Iniciando sincronização de ${channelsToSync.length} canais`);

      for (let i = 0; i < channelsToSync.length; i++) {
        const channel = channelsToSync[i];
        setSyncProgress({ 
          current: i + 1, 
          total: channelsToSync.length, 
          channelName: channel.name 
        });

        try {
          const result = await syncChannelStatus(channel.id);
          
          if (result.success) {
            // Verifica se o status mudou comparando com o status atual
            const currentChannel = channelsRef.current.find(c => c.id === channel.id);
            if (currentChannel && result.status !== currentChannel.status) {
              changedCount++;
              console.log(`[AutoSync] ${channel.name}: status alterado para ${result.status}`);
            }
          } else {
            errorCount++;
            console.warn(`[AutoSync] ${channel.name}: erro - ${result.error}`);
          }
        } catch (error: any) {
          errorCount++;
          console.error(`[AutoSync] ${channel.name}: erro - ${error.message}`);
        }

        // Delay entre sincronizações para não sobrecarregar a API
        if (i < channelsToSync.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setIsAutoSyncing(false);
      setSyncProgress(null);

      // Só mostra toast se houve mudanças
      if (changedCount > 0) {
        toast.success(`${changedCount} canal(is) atualizado(s) automaticamente`);
      }

      console.log(`[AutoSync] Concluído: ${changedCount} alterados, ${errorCount} erros`);
      
      onComplete?.();
    };

    // Pequeno delay para não sincronizar imediatamente ao carregar
    const timer = setTimeout(doSync, 1000);
    
    return () => clearTimeout(timer);
  }, [enabled, channels.length]); // Depende apenas do enabled e da quantidade de canais

  return { isAutoSyncing, syncProgress };
}
