import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Loader2, 
  Download, 
  Wifi, 
  WifiOff, 
  Phone, 
  Settings, 
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchProviderInstances, setChannelWebhook, ProviderInstance } from '@/lib/whatsapp/instance-creator';
import { supabase } from '@/integrations/supabase/client';

interface Provider {
  id: string;
  name: string;
  code: string;
  base_url: string;
  admin_token?: string;
}

interface ExistingChannel {
  id: string;
  name: string;
  instance_id: string | null;
  provider_id: string | null;
}

interface ImportInstancesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: Provider[];
  existingChannels: ExistingChannel[];
  onSuccess: () => void;
}

interface EnrichedInstance extends ProviderInstance {
  providerId: string;
  providerCode: string;
  providerName: string;
  isConnected: boolean;
  phone: string;
  displayName: string;
  alreadyExists: boolean;
  existingChannelId?: string;
}

export default function ImportInstancesModal({
  open,
  onOpenChange,
  providers,
  existingChannels,
  onSuccess,
}: ImportInstancesModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [instances, setInstances] = useState<EnrichedInstance[]>([]);
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(new Set());
  const [configureWebhook, setConfigureWebhook] = useState(true);
  const [importProgress, setImportProgress] = useState<{current: number; total: number; status: string} | null>(null);

  // Buscar instâncias quando abrir o modal
  useEffect(() => {
    if (open) {
      fetchInstances();
    }
  }, [open]);

  const fetchInstances = async () => {
    setIsLoading(true);
    setInstances([]);
    setSelectedInstances(new Set());

    const allInstances: EnrichedInstance[] = [];

    try {
      for (const provider of providers) {
        if (provider.code !== 'uazapi' && provider.code !== 'evolution') continue;

        toast.loading(`Buscando instâncias de ${provider.name}...`, { id: 'fetch-instances' });

        const result = await fetchProviderInstances(provider.code as 'uazapi' | 'evolution');

        if (!result.success || !result.instances) {
          console.log(`[Import] ${provider.name}: ${result.error || 'Sem instâncias'}`);
          continue;
        }

        console.log(`[Import] ${provider.name}: ${result.instances.length} instâncias encontradas`);

        for (const instance of result.instances) {
          // Extrair dados da instância (formato varia por provedor)
          const instanceName = instance.instance?.instanceName || instance.instanceName || '';
          const connectionState = typeof instance.connectionStatus === 'object' 
            ? instance.connectionStatus?.state 
            : instance.connectionStatus;
          const instanceStatus = instance.instance?.state || connectionState;
          const profileName = instance.instance?.profileName || instance.profileName || instanceName;
          const ownerPhone = instance.instance?.owner || instance.owner || '';
          const ownerJid = instance.ownerJid || '';
          
          // Extrair phone do ownerJid se disponível
          let phone = ownerPhone;
          if (!phone && ownerJid) {
            phone = ownerJid.split('@')[0];
          }

          if (!instanceName) continue;

          // Verificar se já existe
          const existing = existingChannels.find(c => c.instance_id === instanceName);

          allInstances.push({
            ...instance,
            providerId: provider.id,
            providerCode: provider.code,
            providerName: provider.name,
            isConnected: instanceStatus === 'open',
            phone: phone || 'Não identificado',
            displayName: profileName || instanceName,
            alreadyExists: !!existing,
            existingChannelId: existing?.id,
            instanceName,
          });
        }
      }

      toast.dismiss('fetch-instances');

      if (allInstances.length === 0) {
        toast.info('Nenhuma instância encontrada nos provedores');
      } else {
        // Selecionar automaticamente as que não existem
        const newInstances = allInstances.filter(i => !i.alreadyExists);
        setSelectedInstances(new Set(newInstances.map(i => i.instanceName)));
      }

      setInstances(allInstances);
    } catch (error: any) {
      toast.dismiss('fetch-instances');
      toast.error(error.message || 'Erro ao buscar instâncias');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleInstance = (instanceName: string) => {
    const newSelected = new Set(selectedInstances);
    if (newSelected.has(instanceName)) {
      newSelected.delete(instanceName);
    } else {
      newSelected.add(instanceName);
    }
    setSelectedInstances(newSelected);
  };

  const toggleAll = () => {
    const importable = instances.filter(i => !i.alreadyExists);
    if (selectedInstances.size === importable.length) {
      setSelectedInstances(new Set());
    } else {
      setSelectedInstances(new Set(importable.map(i => i.instanceName)));
    }
  };

  const handleImport = async () => {
    const toImport = instances.filter(i => selectedInstances.has(i.instanceName) && !i.alreadyExists);
    
    if (toImport.length === 0) {
      toast.error('Selecione pelo menos uma instância para importar');
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: toImport.length, status: 'Iniciando...' });

    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < toImport.length; i++) {
        const instance = toImport[i];
        setImportProgress({ 
          current: i + 1, 
          total: toImport.length, 
          status: `Importando ${instance.displayName}...` 
        });

        try {
          // 1. Criar canal no banco
          const { data: channel, error: createError } = await supabase
            .from('whatsapp_channels')
            .insert({
              name: instance.displayName,
              phone: instance.phone,
              provider_id: instance.providerId,
              instance_id: instance.instanceName,
              instance_token: (instance as any).token || null,
              status: instance.isConnected ? 'connected' : 'disconnected',
              last_sync_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (createError) {
            console.error('[Import] Create error:', createError);
            errorCount++;
            continue;
          }

          // 2. Configurar webhook (se habilitado)
          if (configureWebhook && (instance.providerCode === 'uazapi' || instance.providerCode === 'evolution')) {
            setImportProgress({ 
              current: i + 1, 
              total: toImport.length, 
              status: `Configurando webhook de ${instance.displayName}...` 
            });

            const webhookResult = await setChannelWebhook(
              instance.providerCode as 'uazapi' | 'evolution',
              instance.instanceName
            );

            if (!webhookResult.success) {
              console.warn('[Import] Webhook config failed:', webhookResult.error);
              // Não conta como erro, apenas avisa
            }
          }

          successCount++;
        } catch (error: any) {
          console.error('[Import] Error importing instance:', error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} canal(is) importado(s) com sucesso!`);
        onSuccess();
      }
      
      if (errorCount > 0) {
        toast.error(`${errorCount} erro(s) durante a importação`);
      }

      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao importar');
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const importableCount = instances.filter(i => !i.alreadyExists).length;
  const selectedCount = Array.from(selectedInstances).filter(
    name => !instances.find(i => i.instanceName === name)?.alreadyExists
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Download className="w-6 h-6 text-primary" />
            Importar Instâncias
          </DialogTitle>
          <DialogDescription>
            Selecione as instâncias que deseja importar dos seus provedores configurados.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Buscando instâncias...</p>
            </div>
          ) : instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">Nenhuma instância encontrada</h3>
              <p className="text-muted-foreground mb-4">
                Certifique-se de que você tem instâncias criadas no UAZAPI ou Evolution API.
              </p>
              <Button variant="outline" onClick={fetchInstances}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          ) : (
            <>
              {/* Header com seleção */}
              <div className="flex items-center justify-between py-3 border-b">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedCount === importableCount && importableCount > 0}
                    onCheckedChange={toggleAll}
                    disabled={importableCount === 0}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedCount} de {importableCount} selecionada(s)
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchInstances}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Atualizar
                </Button>
              </div>

              {/* Lista de instâncias */}
              <div className="flex-1 overflow-y-auto py-2 space-y-2">
                {instances.map((instance) => (
                  <div
                    key={instance.instanceName}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg border transition-colors",
                      instance.alreadyExists 
                        ? "bg-muted/30 opacity-60 cursor-not-allowed"
                        : selectedInstances.has(instance.instanceName)
                          ? "bg-primary/5 border-primary/30"
                          : "hover:bg-muted/50 cursor-pointer"
                    )}
                    onClick={() => !instance.alreadyExists && toggleInstance(instance.instanceName)}
                  >
                    <Checkbox
                      checked={selectedInstances.has(instance.instanceName)}
                      onCheckedChange={() => toggleInstance(instance.instanceName)}
                      disabled={instance.alreadyExists}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{instance.displayName}</span>
                        <Badge variant="secondary" className="text-xs">
                          {instance.providerName}
                        </Badge>
                        {instance.alreadyExists && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Já importado
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {instance.phone}
                        </span>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">
                          {instance.instanceName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {instance.isConnected ? (
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                          <Wifi className="w-3 h-3 mr-1" />
                          Conectado
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground">
                          <WifiOff className="w-3 h-3 mr-1" />
                          Desconectado
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t space-y-4">
          {/* Opção de configurar webhook */}
          {importableCount > 0 && (
            <div 
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
              onClick={() => setConfigureWebhook(!configureWebhook)}
            >
              <Checkbox
                checked={configureWebhook}
                onCheckedChange={(checked) => setConfigureWebhook(!!checked)}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-primary" />
                  <span className="font-medium">Configurar webhook automaticamente</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configura as instâncias para enviar mensagens recebidas para este sistema
                </p>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {importProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{importProgress.status}</span>
                <span className="font-medium">{importProgress.current}/{importProgress.total}</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
              Cancelar
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={selectedCount === 0 || isImporting}
              className="btn-gradient"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Importar {selectedCount > 0 ? `(${selectedCount})` : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
