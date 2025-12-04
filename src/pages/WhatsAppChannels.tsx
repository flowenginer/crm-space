import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  MessageCircle,
  Wifi,
  WifiOff,
  MoreVertical,
  Power,
  RefreshCw,
  QrCode,
  Battery,
  Clock,
  Check,
  Edit3,
  BarChart3,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  useChannels, 
  useDeletedChannels, 
  useCreateChannel, 
  useUpdateChannel,
  useDeleteChannel,
  useRestoreChannel,
  type WhatsAppChannel 
} from '@/hooks/useChannels';
import { useProviders } from '@/hooks/useProviders';
import { useDepartments } from '@/hooks/useDepartments';
import { whatsappService } from '@/lib/whatsapp';

export default function WhatsAppChannels() {
  const { data: channels = [], isLoading } = useChannels();
  const { data: deletedChannels = [] } = useDeletedChannels();
  const { data: providers = [] } = useProviders();
  const { data: departments = [] } = useDepartments();
  
  const createChannel = useCreateChannel();
  const updateChannel = useUpdateChannel();
  const deleteChannel = useDeleteChannel();
  const restoreChannel = useRestoreChannel();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<WhatsAppChannel | null>(null);
  const [addStep, setAddStep] = useState(1);
  
  // Form state
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelPhone, setNewChannelPhone] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [instanceToken, setInstanceToken] = useState('');
  
  // QR Code state
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrCountdown, setQrCountdown] = useState(60);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [createdChannelId, setCreatedChannelId] = useState<string | null>(null);

  const connectedCount = channels.filter(c => c.status === 'connected').length;
  const totalSlots = channels.length;

  // QR countdown timer
  useEffect(() => {
    if (addStep === 2 && qrCountdown > 0) {
      const timer = setTimeout(() => setQrCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [addStep, qrCountdown]);

  const getTimeSinceSync = (lastSync: string | null) => {
    if (!lastSync) return 'N/A';
    const minutes = Math.floor((Date.now() - new Date(lastSync).getTime()) / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
  };

  const getSelectedProvider = () => {
    return providers.find(p => p.id === selectedProviderId);
  };

  const resetForm = () => {
    setAddStep(1);
    setNewChannelName('');
    setNewChannelPhone('');
    setSelectedProviderId('');
    setSelectedDepartmentId('');
    setInstanceId('');
    setInstanceToken('');
    setQrCode(null);
    setQrCountdown(60);
    setIsConnecting(false);
    setConnectionError(null);
    setCreatedChannelId(null);
  };

  const handleOpenDetails = (channel: WhatsAppChannel) => {
    setSelectedChannel(channel);
    setShowDetailsModal(true);
  };

  const handleAddChannel = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleContinueAdd = async () => {
    if (addStep === 1) {
      if (!newChannelName.trim() || !selectedProviderId || !instanceId.trim()) {
        toast({
          title: 'Campos obrigatórios',
          description: 'Preencha todos os campos obrigatórios.',
          variant: 'destructive',
        });
        return;
      }

      setIsConnecting(true);
      setConnectionError(null);

      try {
        // Create channel in database first
        const createdChannel = await createChannel.mutateAsync({
          name: newChannelName,
          phone: newChannelPhone || 'Aguardando conexão',
          provider_id: selectedProviderId,
          instance_id: instanceId,
          instance_token: instanceToken || undefined,
          department_id: selectedDepartmentId || null,
        });

        setCreatedChannelId(createdChannel.id);

        // Try to connect and get QR code
        const result = await whatsappService.connect(createdChannel.id);

        if (result.status === 'connected') {
          setAddStep(3);
        } else if (result.qrCode) {
          setQrCode(result.qrCode);
          setQrCountdown(60);
          setAddStep(2);
        } else {
          setConnectionError('Não foi possível gerar o QR Code. Verifique as credenciais.');
        }
      } catch (error: any) {
        console.error('Connection error:', error);
        setConnectionError(error.message || 'Erro ao conectar. Verifique as credenciais.');
      } finally {
        setIsConnecting(false);
      }
    } else if (addStep === 3) {
      setShowAddModal(false);
      resetForm();
    }
  };

  const handleRefreshQR = async () => {
    if (!createdChannelId) return;
    
    setIsConnecting(true);
    try {
      const result = await whatsappService.connect(createdChannelId);
      if (result.qrCode) {
        setQrCode(result.qrCode);
        setQrCountdown(60);
      } else if (result.status === 'connected') {
        setAddStep(3);
        toast({
          title: 'Conectado!',
          description: 'Canal conectado com sucesso.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao gerar QR Code',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnect = async (channel: WhatsAppChannel) => {
    setSelectedChannel(channel);
    setIsConnecting(true);
    
    try {
      const result = await whatsappService.connect(channel.id);
      
      if (result.status === 'connected') {
        toast({
          title: 'Conectado!',
          description: `${channel.name} está conectado.`,
        });
      } else if (result.qrCode) {
        setQrCode(result.qrCode);
        setQrCountdown(60);
        setCreatedChannelId(channel.id);
        setAddStep(2);
        setShowAddModal(true);
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao conectar',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (channel: WhatsAppChannel) => {
    try {
      await whatsappService.disconnect(channel.id);
      toast({
        title: 'Desconectado',
        description: `${channel.name} foi desconectado.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao desconectar',
        variant: 'destructive',
      });
    }
  };

  const handleSync = async (channel: WhatsAppChannel) => {
    try {
      const status = await whatsappService.getStatus(channel.id);
      await updateChannel.mutateAsync({
        id: channel.id,
        status,
        last_sync_at: new Date().toISOString(),
      });
      toast({
        title: 'Sincronizado',
        description: `${channel.name} está ${status}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao sincronizar',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (channel: WhatsAppChannel) => {
    try {
      await deleteChannel.mutateAsync(channel.id);
      toast({
        title: 'Canal removido',
        description: `${channel.name} foi movido para a lixeira.`,
      });
      setShowDetailsModal(false);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao remover canal',
        variant: 'destructive',
      });
    }
  };

  const handleRestore = async (channel: WhatsAppChannel) => {
    try {
      await restoreChannel.mutateAsync(channel.id);
      toast({
        title: 'Canal restaurado',
        description: `${channel.name} foi restaurado.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao restaurar canal',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Canais de atendimento</h1>
          <p className="text-muted-foreground">
            <span className="font-semibold text-primary">{connectedCount}/{totalSlots}</span> canais conectados
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setShowDeletedModal(true)}
            className="border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <Trash2 size={18} />
            Deletados
            {deletedChannels.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-destructive/20 text-destructive rounded-full text-xs font-bold">
                {deletedChannels.length}
              </span>
            )}
          </Button>

          <Button onClick={handleAddChannel} className="btn-gradient">
            <Plus size={18} />
            Adicionar Canal
          </Button>
        </div>
      </div>

      {/* Channels Grid */}
      {channels.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <MessageCircle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">Nenhum canal configurado</h3>
          <p className="text-muted-foreground mb-6">Adicione seu primeiro canal WhatsApp para começar</p>
          <Button onClick={handleAddChannel} className="btn-gradient">
            <Plus size={18} />
            Adicionar Canal
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onOpenDetails={handleOpenDetails}
              onSync={handleSync}
              onDisconnect={handleDisconnect}
              onConnect={handleConnect}
              getTimeSinceSync={getTimeSinceSync}
            />
          ))}
        </div>
      )}

      {/* Add Channel Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => {
        if (!open && addStep !== 3) {
          // If closing without completing, clean up created channel
          if (createdChannelId && addStep === 2) {
            deleteChannel.mutate(createdChannelId);
          }
        }
        setShowAddModal(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {addStep === 3 ? 'Canal conectado!' : 'Conectar novo canal WhatsApp'}
            </DialogTitle>
            {addStep !== 3 && (
              <DialogDescription>
                {addStep === 1 ? 'Selecione o provedor e configure as credenciais' : 'Escaneie o QR Code com seu WhatsApp'}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Step 1: Provider Selection & Credentials */}
            {addStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="channelName">Nome do canal *</Label>
                  <Input
                    id="channelName"
                    placeholder="Ex: Vendas 01, Suporte..."
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="provider">Provedor WhatsApp *</Label>
                  <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Selecione o provedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{provider.name}</span>
                            <span className="text-xs text-muted-foreground">({provider.code})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProviderId && (
                  <>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        {getSelectedProvider()?.code === 'zapi' && (
                          <>Obtenha as credenciais em <strong>z-api.io</strong> → Sua Instância → Credenciais</>
                        )}
                        {getSelectedProvider()?.code === 'uazapi' && (
                          <>Obtenha as credenciais em <strong>uazapi.com</strong> → Dashboard → Instâncias</>
                        )}
                        {getSelectedProvider()?.code === 'evolution' && (
                          <>Configure a URL da sua instância Evolution API self-hosted</>
                        )}
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="instanceId">
                        {getSelectedProvider()?.code === 'evolution' ? 'Nome da Instância *' : 'Instance ID *'}
                      </Label>
                      <Input
                        id="instanceId"
                        placeholder={getSelectedProvider()?.code === 'evolution' ? 'minha-instancia' : 'Ex: 3F7A9B2C1D...'}
                        value={instanceId}
                        onChange={(e) => setInstanceId(e.target.value)}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="instanceToken">
                        {getSelectedProvider()?.code === 'evolution' ? 'API Key (Global)' : 'Token da Instância'}
                      </Label>
                      <Input
                        id="instanceToken"
                        type="password"
                        placeholder="Token de acesso..."
                        value={instanceToken}
                        onChange={(e) => setInstanceToken(e.target.value)}
                        className="mt-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {getSelectedProvider()?.code === 'zapi' && 'Opcional: Client Token para maior segurança'}
                        {getSelectedProvider()?.code === 'uazapi' && 'Token Bearer da sua instância'}
                        {getSelectedProvider()?.code === 'evolution' && 'API Key configurada no seu servidor'}
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="phone">Número do WhatsApp</Label>
                      <Input
                        id="phone"
                        placeholder="+55 21 99999-9999"
                        value={newChannelPhone}
                        onChange={(e) => setNewChannelPhone(e.target.value)}
                        className="mt-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Será preenchido automaticamente após conexão
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="department">Departamento (opcional)</Label>
                      <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Nenhum departamento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Nenhum</SelectItem>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {connectionError && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                    <AlertCircle size={18} />
                    <span className="text-sm">{connectionError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: QR Code */}
            {addStep === 2 && (
              <div className="text-center">
                <div className="mb-6">
                  <div className="inline-block p-4 bg-card border-4 border-border rounded-2xl shadow-elevated">
                    {qrCode ? (
                      <img 
                        src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                        alt="QR Code"
                        className="w-64 h-64 rounded-xl"
                      />
                    ) : (
                      <div className="w-64 h-64 bg-gradient-to-br from-primary/10 to-pink-500/10 rounded-xl flex items-center justify-center">
                        {isConnecting ? (
                          <Loader2 size={48} className="text-primary animate-spin" />
                        ) : (
                          <QrCode size={180} className="text-primary" />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="text-xl font-bold text-foreground mb-4">
                  Escaneie o QR Code com seu WhatsApp
                </h3>

                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-left space-y-2 mb-6">
                  {[
                    'Abra o WhatsApp no seu celular',
                    'Vá em Configurações → Aparelhos conectados',
                    'Toque em "Conectar aparelho"',
                    'Escaneie o QR Code acima',
                  ].map((instruction, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {idx + 1}
                      </div>
                      <p className="text-sm text-foreground/80">{instruction}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-center gap-2 mb-4">
                  <Clock size={18} className="text-orange-500" />
                  <span className="text-sm text-muted-foreground">
                    QR Code expira em: <strong className={cn(
                      qrCountdown <= 10 ? 'text-destructive' : 'text-orange-600'
                    )}>00:{qrCountdown.toString().padStart(2, '0')}</strong>
                  </span>
                </div>

                <Button 
                  variant="link" 
                  onClick={handleRefreshQR}
                  disabled={isConnecting}
                  className="text-primary"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} className="mr-2" />
                      Gerar novo QR Code
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Step 3: Success */}
            {addStep === 3 && (
              <div className="text-center py-4">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-elevated">
                  <Check size={40} className="text-white" />
                </div>

                <h3 className="text-2xl font-bold text-foreground mb-2">
                  Canal conectado com sucesso!
                </h3>
                <p className="text-muted-foreground mb-6">
                  {newChannelName || 'Novo canal'} está pronto para receber mensagens
                </p>

                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Provedor:</span>
                    <span className="font-semibold text-foreground">{getSelectedProvider()?.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      Online
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {addStep === 1 && (
              <Button
                onClick={handleContinueAdd}
                disabled={!newChannelName.trim() || !selectedProviderId || !instanceId.trim() || isConnecting}
                className="w-full btn-gradient"
              >
                {isConnecting ? (
                  <>
                    <Loader2 size={18} className="animate-spin mr-2" />
                    Conectando...
                  </>
                ) : (
                  'Conectar'
                )}
              </Button>
            )}

            {addStep === 2 && (
              <div className="w-full space-y-2">
                <Button
                  onClick={() => {
                    // Check connection status
                    handleRefreshQR();
                  }}
                  className="w-full btn-gradient"
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 size={18} className="animate-spin mr-2" />
                      Verificando...
                    </>
                  ) : (
                    'Já escaneei o QR Code'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (createdChannelId) {
                      deleteChannel.mutate(createdChannelId);
                    }
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="w-full"
                >
                  Cancelar
                </Button>
              </div>
            )}

            {addStep === 3 && (
              <Button
                onClick={handleContinueAdd}
                className="w-full btn-gradient"
              >
                Concluir
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Channel Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Canal</DialogTitle>
          </DialogHeader>

          {selectedChannel && (
            <div className="space-y-4 py-4">
              {/* Channel Info */}
              <div className="text-center pb-4 border-b border-border">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <MessageCircle size={32} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-1">{selectedChannel.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedChannel.phone}</p>
                {selectedChannel.provider && (
                  <p className="text-xs text-primary mt-1">{selectedChannel.provider.name}</p>
                )}
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-foreground mb-1">
                    {(selectedChannel.messages_sent || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Enviadas</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-foreground mb-1">
                    {(selectedChannel.messages_received || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Recebidas</div>
                </div>
              </div>

              {/* Channel Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Instance ID:</span>
                  <span className="font-mono text-xs">{selectedChannel.instance_id || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Departamento:</span>
                  <span>{selectedChannel.department?.name || 'Nenhum'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Última sync:</span>
                  <span>{getTimeSinceSync(selectedChannel.last_sync_at)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-border space-y-2">
                <button 
                  className="w-full py-2.5 text-left px-4 hover:bg-destructive/10 rounded-lg transition-colors flex items-center gap-3 text-sm text-destructive"
                  onClick={() => handleDelete(selectedChannel)}
                >
                  <Trash2 size={16} />
                  <span>Excluir canal</span>
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Deleted Channels Modal */}
      <Dialog open={showDeletedModal} onOpenChange={setShowDeletedModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Canais Deletados</DialogTitle>
            <DialogDescription>
              Restaure ou exclua permanentemente canais removidos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4 max-h-96 overflow-y-auto">
            {deletedChannels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum canal deletado
              </div>
            ) : (
              deletedChannels.map((channel) => (
                <div key={channel.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                      <MessageCircle size={24} className="text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{channel.name}</h4>
                      <p className="text-sm text-muted-foreground">{channel.phone}</p>
                      {channel.deleted_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Deletado em {new Date(channel.deleted_at).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleRestore(channel)}
                    >
                      Restaurar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Channel Card Component
function ChannelCard({
  channel,
  onOpenDetails,
  onSync,
  onDisconnect,
  onConnect,
  getTimeSinceSync,
}: {
  channel: WhatsAppChannel;
  onOpenDetails: (channel: WhatsAppChannel) => void;
  onSync: (channel: WhatsAppChannel) => void;
  onDisconnect: (channel: WhatsAppChannel) => void;
  onConnect: (channel: WhatsAppChannel) => void;
  getTimeSinceSync: (lastSync: string | null) => string;
}) {
  const isConnected = channel.status === 'connected';
  const isDisconnected = channel.status === 'disconnected' || !channel.status;

  return (
    <div
      className={cn(
        'bg-card rounded-2xl border-2 shadow-card p-6 transition-all duration-300 hover:shadow-card-hover',
        isConnected && 'border-green-200 dark:border-green-800',
        isDisconnected && 'border-border'
      )}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'p-3 rounded-xl shadow-lg',
              isConnected && 'bg-gradient-to-br from-green-500 to-emerald-600',
              isDisconnected && 'bg-muted-foreground'
            )}
          >
            <MessageCircle size={24} className="text-white" />
          </div>

          <div className="flex items-center gap-2">
            {isConnected && <Wifi size={18} className="text-green-500" />}
            {isDisconnected && <WifiOff size={18} className="text-muted-foreground" />}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
              <MoreVertical size={18} className="text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpenDetails(channel)}>
              <BarChart3 size={16} className="mr-2" />
              Ver detalhes
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Edit3 size={16} className="mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              <Trash2 size={16} className="mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Channel Name */}
      <div className="mb-3">
        <h3 className="text-lg font-bold text-foreground mb-1">{channel.name}</h3>
        <div className="flex items-center gap-1 flex-wrap">
          {channel.provider && (
            <span className="px-2 py-1 rounded-full font-medium text-xs bg-primary/10 text-primary">
              {channel.provider.name}
            </span>
          )}
          <span
            className={cn(
              'px-2 py-1 rounded-full font-medium text-xs',
              isConnected
                ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {isConnected ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
      </div>

      {/* Phone Number */}
      <div className="bg-muted/50 rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-muted-foreground font-medium">Número:</span>
          <span className="text-foreground font-semibold">{channel.phone}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-medium">Instance:</span>
          <span className="text-muted-foreground font-mono text-xs truncate max-w-32">
            {channel.instance_id || '-'}
          </span>
        </div>
      </div>

      {/* Additional Info */}
      {isConnected && (
        <div className="space-y-2 mb-4">
          {channel.battery_level && (
            <div className="flex items-center gap-2 text-sm">
              <Battery
                size={16}
                className={cn(
                  channel.battery_level > 50 && 'text-green-600',
                  channel.battery_level <= 50 && channel.battery_level > 20 && 'text-yellow-600',
                  channel.battery_level <= 20 && 'text-destructive'
                )}
              />
              <span className="text-muted-foreground">Bateria:</span>
              <span className="font-medium text-foreground">{channel.battery_level}%</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock size={16} />
            <span>Sincronizado há {getTimeSinceSync(channel.last_sync_at)}</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {isConnected ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => onDisconnect(channel)}
            >
              <Power size={16} />
              Desconectar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => onSync(channel)}
            >
              <RefreshCw size={16} />
              Sincronizar
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg"
            onClick={() => onConnect(channel)}
          >
            <Power size={16} className="mr-1" />
            Conectar
          </Button>
        )}
      </div>
    </div>
  );
}
