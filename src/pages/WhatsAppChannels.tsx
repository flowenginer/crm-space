import { useState } from 'react';
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
  X,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface WhatsAppChannel {
  id: string;
  name: string;
  phone: string | null;
  channelId: string | null;
  status: 'connected' | 'disconnected' | 'connecting' | 'available';
  type: 'unofficial' | 'business' | null;
  lastSync: string | null;
  batteryLevel: number | null;
  messagesSent: number;
  messagesReceived: number;
  activeContacts: number;
}

const mockWhatsAppChannels: WhatsAppChannel[] = [
  {
    id: '1',
    name: 'Vendas 06',
    phone: '+55 (21) 9 8533-2473',
    channelId: '3949',
    status: 'connected',
    type: 'unofficial',
    lastSync: '2025-12-03T15:30:00',
    batteryLevel: 87,
    messagesSent: 2345,
    messagesReceived: 3678,
    activeContacts: 234,
  },
  {
    id: '2',
    name: 'Vendas 08',
    phone: '+55 (21) 9 6533-2750',
    channelId: '9571',
    status: 'connected',
    type: 'unofficial',
    lastSync: '2025-12-03T14:20:00',
    batteryLevel: 92,
    messagesSent: 1890,
    messagesReceived: 2456,
    activeContacts: 189,
  },
  {
    id: '3',
    name: 'Vendas 01',
    phone: '+55 (21) 9 7099-0110',
    channelId: '9965',
    status: 'connected',
    type: 'business',
    lastSync: '2025-12-03T16:10:00',
    batteryLevel: null,
    messagesSent: 5670,
    messagesReceived: 7890,
    activeContacts: 567,
  },
  {
    id: '4',
    name: 'Vendas 03',
    phone: '+55 (21) 9 9693-3037',
    channelId: '9937',
    status: 'connected',
    type: 'unofficial',
    lastSync: '2025-12-03T15:45:00',
    batteryLevel: 78,
    messagesSent: 1234,
    messagesReceived: 1567,
    activeContacts: 123,
  },
  {
    id: '5',
    name: 'Vendas 05',
    phone: '+55 (21) 9 8533-2281',
    channelId: '9558',
    status: 'connected',
    type: 'unofficial',
    lastSync: '2025-12-03T14:30:00',
    batteryLevel: 65,
    messagesSent: 987,
    messagesReceived: 1234,
    activeContacts: 98,
  },
  {
    id: '6',
    name: 'Vendas 02',
    phone: '+55 (21) 9 7805-2644',
    channelId: '9866',
    status: 'connected',
    type: 'business',
    lastSync: '2025-12-03T16:00:00',
    batteryLevel: null,
    messagesSent: 4567,
    messagesReceived: 5678,
    activeContacts: 456,
  },
  {
    id: '7',
    name: 'Vendas 07',
    phone: '+55 (21) 9 6533-2686',
    channelId: '9578',
    status: 'disconnected',
    type: 'unofficial',
    lastSync: '2025-12-02T10:00:00',
    batteryLevel: null,
    messagesSent: 567,
    messagesReceived: 789,
    activeContacts: 56,
  },
  {
    id: '8',
    name: 'Canal Disponível',
    phone: null,
    channelId: null,
    status: 'available',
    type: null,
    lastSync: null,
    batteryLevel: null,
    messagesSent: 0,
    messagesReceived: 0,
    activeContacts: 0,
  },
];

const mockDeletedChannels = [
  {
    id: 'd1',
    name: 'Vendas 04',
    phone: '+55 (21) 9 7777-7777',
    deletedAt: '2025-11-28T10:00:00',
  },
];

const mockSyncLogs = [
  { time: '15:30', status: 'success', messages: 45 },
  { time: '14:15', status: 'success', messages: 32 },
  { time: '12:45', status: 'success', messages: 28 },
];

export default function WhatsAppChannels() {
  const [channels] = useState<WhatsAppChannel[]>(mockWhatsAppChannels);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<WhatsAppChannel | null>(null);
  const [addStep, setAddStep] = useState(1);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'unofficial' | 'business'>('unofficial');
  const [qrCountdown, setQrCountdown] = useState(45);

  const connectedCount = channels.filter(c => c.status === 'connected').length;
  const totalSlots = channels.length;
  const availableSlots = channels.filter(c => c.status === 'available').length;

  const getTimeSinceSync = (lastSync: string | null) => {
    if (!lastSync) return 'N/A';
    const minutes = Math.floor((Date.now() - new Date(lastSync).getTime()) / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
  };

  const handleOpenDetails = (channel: WhatsAppChannel) => {
    setSelectedChannel(channel);
    setShowDetailsModal(true);
  };

  const handleAddChannel = () => {
    setAddStep(1);
    setNewChannelName('');
    setNewChannelType('unofficial');
    setShowAddModal(true);
  };

  const handleContinueAdd = () => {
    if (addStep === 1 && newChannelName.trim()) {
      setAddStep(2);
      setQrCountdown(45);
    } else if (addStep === 2) {
      // Simulate connection success
      setAddStep(3);
    } else if (addStep === 3) {
      setShowAddModal(false);
      toast({
        title: 'Canal conectado!',
        description: `${newChannelName} foi adicionado com sucesso.`,
      });
    }
  };

  const handleSync = (channel: WhatsAppChannel) => {
    toast({
      title: 'Sincronizando...',
      description: `Sincronizando ${channel.name}`,
    });
  };

  const handleDisconnect = (channel: WhatsAppChannel) => {
    toast({
      title: 'Canal desconectado',
      description: `${channel.name} foi desconectado.`,
      variant: 'destructive',
    });
  };

  const handleConnect = (channel: WhatsAppChannel) => {
    setSelectedChannel(channel);
    setAddStep(2);
    setShowAddModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Canais de atendimento</h1>
          <p className="text-muted-foreground">
            <span className="font-semibold text-primary">{connectedCount}/{totalSlots}</span> canais utilizados
            {availableSlots > 0 && (
              <span className="text-green-600 ml-2">({availableSlots} disponível)</span>
            )}
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
            {mockDeletedChannels.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-destructive/20 text-destructive rounded-full text-xs font-bold">
                {mockDeletedChannels.length}
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

      {/* Add Channel Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {addStep === 3 ? 'Canal conectado!' : 'Conectar novo canal WhatsApp'}
            </DialogTitle>
            {addStep !== 3 && (
              <DialogDescription>
                Configure e conecte um novo número WhatsApp ao seu CRM
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Step 1: Channel Name & Type */}
            {addStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="channelName">Nome do canal</Label>
                  <Input
                    id="channelName"
                    placeholder="Ex: Vendas 09, Suporte 01..."
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label className="mb-3 block">Tipo de conexão</Label>
                  <RadioGroup
                    value={newChannelType}
                    onValueChange={(value) => setNewChannelType(value as 'unofficial' | 'business')}
                    className="space-y-3"
                  >
                    <label className="flex items-start gap-3 p-4 border-2 border-border rounded-xl cursor-pointer hover:border-primary transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                      <RadioGroupItem value="unofficial" className="mt-1" />
                      <div>
                        <div className="font-semibold text-foreground mb-1">WhatsApp não oficial (Gratuito)</div>
                        <div className="text-sm text-muted-foreground">
                          Conecte via QR Code. Requer celular próximo. Ideal para começar.
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-4 border-2 border-border rounded-xl cursor-pointer hover:border-primary transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                      <RadioGroupItem value="business" className="mt-1" />
                      <div>
                        <div className="font-semibold text-foreground mb-1">WhatsApp Business API</div>
                        <div className="text-sm text-muted-foreground">
                          Conexão oficial via Meta. Requer aprovação. Mais estável e recursos avançados.
                        </div>
                      </div>
                    </label>
                  </RadioGroup>
                </div>
              </div>
            )}

            {/* Step 2: QR Code */}
            {addStep === 2 && (
              <div className="text-center">
                <div className="mb-6">
                  <div className="inline-block p-4 bg-card border-4 border-border rounded-2xl shadow-elevated">
                    <div className="w-64 h-64 bg-gradient-to-br from-primary/10 to-pink-500/10 rounded-xl flex items-center justify-center">
                      <QrCode size={180} className="text-primary" />
                    </div>
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
                    QR Code expira em: <strong className="text-orange-600">00:{qrCountdown.toString().padStart(2, '0')}</strong>
                  </span>
                </div>

                <button className="text-sm text-primary hover:text-primary/80 font-medium">
                  Gerar novo QR Code
                </button>
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
                    <span className="text-muted-foreground">Número conectado:</span>
                    <span className="font-semibold text-foreground">+55 (21) 99999-9999</span>
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
                disabled={!newChannelName.trim()}
                className="w-full btn-gradient"
              >
                Continuar
              </Button>
            )}

            {addStep === 2 && (
              <Button
                variant="outline"
                onClick={() => setShowAddModal(false)}
                className="w-full"
              >
                Cancelar
              </Button>
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
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground mb-1">
                    {selectedChannel.messagesSent.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Mensagens enviadas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground mb-1">
                    {selectedChannel.messagesReceived.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Mensagens recebidas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground mb-1">
                    {selectedChannel.activeContacts}
                  </div>
                  <div className="text-xs text-muted-foreground">Contatos ativos</div>
                </div>
              </div>

              {/* Recent Syncs */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Sincronizações recentes</h4>
                <div className="space-y-2">
                  {mockSyncLogs.map((sync, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Check size={16} className="text-green-600" />
                        <span className="text-muted-foreground">Hoje, {sync.time}</span>
                      </div>
                      <span className="text-foreground font-medium">{sync.messages} mensagens</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-border space-y-2">
                <button className="w-full py-2.5 text-left px-4 hover:bg-muted rounded-lg transition-colors flex items-center gap-3 text-sm">
                  <Edit3 size={16} className="text-muted-foreground" />
                  <span className="text-foreground">Editar nome do canal</span>
                </button>
                <button className="w-full py-2.5 text-left px-4 hover:bg-muted rounded-lg transition-colors flex items-center gap-3 text-sm">
                  <BarChart3 size={16} className="text-muted-foreground" />
                  <span className="text-foreground">Ver estatísticas completas</span>
                </button>
                <button className="w-full py-2.5 text-left px-4 hover:bg-destructive/10 rounded-lg transition-colors flex items-center gap-3 text-sm text-destructive">
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

          <div className="space-y-3 py-4">
            {mockDeletedChannels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum canal deletado
              </div>
            ) : (
              mockDeletedChannels.map((channel) => (
                <div key={channel.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                      <MessageCircle size={24} className="text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{channel.name}</h4>
                      <p className="text-sm text-muted-foreground">{channel.phone}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Deletado em {new Date(channel.deletedAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                      Restaurar
                    </Button>
                    <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10">
                      Excluir permanentemente
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
  const isAvailable = channel.status === 'available';
  const isConnected = channel.status === 'connected';
  const isDisconnected = channel.status === 'disconnected';

  return (
    <div
      className={cn(
        'bg-card rounded-2xl border-2 shadow-card p-6 transition-all duration-300 hover:shadow-card-hover',
        isConnected && 'border-green-200 dark:border-green-800',
        isDisconnected && 'border-destructive/30 opacity-75',
        isAvailable && 'border-border border-dashed'
      )}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'p-3 rounded-xl shadow-lg',
              isConnected && 'bg-gradient-to-br from-green-500 to-emerald-600',
              isDisconnected && 'bg-muted-foreground',
              isAvailable && 'bg-gradient-to-br from-primary to-pink-500'
            )}
          >
            {isAvailable ? (
              <Plus size={24} className="text-white" />
            ) : (
              <MessageCircle size={24} className="text-white" />
            )}
          </div>

          {!isAvailable && (
            <div className="flex items-center gap-2">
              {isConnected && <Wifi size={18} className="text-green-500" />}
              {isDisconnected && <WifiOff size={18} className="text-destructive" />}
            </div>
          )}
        </div>

        {!isAvailable && (
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
        )}
      </div>

      {/* Card Content */}
      {isAvailable ? (
        <div className="text-center py-8">
          <h3 className="text-lg font-bold text-foreground mb-2">Slot Disponível</h3>
          <p className="text-sm text-muted-foreground mb-4">Conecte um novo canal WhatsApp</p>
          <Button className="w-full btn-gradient">Conectar Canal</Button>
        </div>
      ) : (
        <>
          {/* Channel Name */}
          <div className="mb-3">
            <h3 className="text-lg font-bold text-foreground mb-1">{channel.name}</h3>
            <div className="flex items-center gap-1 flex-wrap">
              <span
                className={cn(
                  'px-2 py-1 rounded-full font-medium text-xs',
                  channel.type === 'business'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {channel.type === 'business' ? 'Business API' : 'Não oficial'}
              </span>
              <span
                className={cn(
                  'px-2 py-1 rounded-full font-medium text-xs',
                  isConnected
                    ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                    : 'bg-destructive/20 text-destructive'
                )}
              >
                {isConnected ? 'Estável' : 'Desconectado'}
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
              <span className="text-muted-foreground font-medium">ID:</span>
              <span className="text-muted-foreground font-mono text-xs">{channel.channelId}</span>
            </div>
          </div>

          {/* Additional Info */}
          {isConnected && (
            <div className="space-y-2 mb-4">
              {channel.batteryLevel && (
                <div className="flex items-center gap-2 text-sm">
                  <Battery
                    size={16}
                    className={cn(
                      channel.batteryLevel > 50 && 'text-green-600',
                      channel.batteryLevel <= 50 && channel.batteryLevel > 20 && 'text-yellow-600',
                      channel.batteryLevel <= 20 && 'text-destructive'
                    )}
                  />
                  <span className="text-muted-foreground">Bateria:</span>
                  <span className="font-medium text-foreground">{channel.batteryLevel}%</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock size={16} />
                <span>Sincronizado há {getTimeSinceSync(channel.lastSync)}</span>
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
              <>
                <Button
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg"
                  onClick={() => onConnect(channel)}
                >
                  <Power size={16} />
                  Conectar
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <QrCode size={16} />
                  Novo QR
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
