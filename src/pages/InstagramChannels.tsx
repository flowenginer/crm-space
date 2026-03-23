import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  MoreVertical,
  Power,
  RefreshCw,
  Check,
  Edit3,
  Loader2,
  AlertCircle,
  Settings,
  Info,
  Shield,
  ChevronDown,
  Instagram,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Users,
  MessageCircle,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useInstagramChannels,
  useDeletedInstagramChannels,
  useCreateInstagramChannel,
  useUpdateInstagramChannel,
  useDeleteInstagramChannel,
  useRestoreInstagramChannel,
  useTestInstagramConnection,
  useGenerateInstagramWebhookUrl,
} from '@/hooks/useInstagramChannels';
import { useDepartments } from '@/hooks/useDepartments';
import { supabase } from '@/integrations/supabase/client';
import type { InstagramChannel } from '@/types/instagram';

export default function InstagramChannels() {
  const { data: channels = [], isLoading, refetch: refetchChannels } = useInstagramChannels();
  const { data: deletedChannels = [] } = useDeletedInstagramChannels();
  const { data: departments = [] } = useDepartments();

  const createChannel = useCreateInstagramChannel();
  const updateChannel = useUpdateInstagramChannel();
  const deleteChannel = useDeleteInstagramChannel();
  const restoreChannel = useRestoreInstagramChannel();
  const testConnection = useTestInstagramConnection();
  const generateWebhookUrl = useGenerateInstagramWebhookUrl();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<InstagramChannel | null>(null);
  const [showToken, setShowToken] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formInstagramAccountId, setFormInstagramAccountId] = useState('');
  const [formInstagramUsername, setFormInstagramUsername] = useState('');
  const [formPageId, setFormPageId] = useState('');
  const [formPageAccessToken, setFormPageAccessToken] = useState('');
  const [formAppSecret, setFormAppSecret] = useState('');
  const [formVerifyToken, setFormVerifyToken] = useState('');
  const [formDepartmentId, setFormDepartmentId] = useState('');

  // Webhook info
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookVerifyToken, setWebhookVerifyToken] = useState('');

  const connectedCount = channels.filter(c => c.status === 'connected').length;

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('instagram-channels-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'instagram_channels',
        },
        (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;

          if (newData.status !== oldData.status) {
            if (newData.status === 'connected') {
              toast.success(`Canal @${newData.instagram_username || 'Instagram'} conectado!`);
            } else if (newData.status === 'disconnected' && oldData.status === 'connected') {
              toast.warning(`Canal @${newData.instagram_username || 'Instagram'} desconectado`);
            }
          }
          refetchChannels();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchChannels]);

  const resetForm = () => {
    setFormName('');
    setFormInstagramAccountId('');
    setFormInstagramUsername('');
    setFormPageId('');
    setFormPageAccessToken('');
    setFormAppSecret('');
    setFormVerifyToken('');
    setFormDepartmentId('');
    setWebhookUrl('');
    setWebhookVerifyToken('');
    setShowToken(false);
  };

  const handleOpenAdd = async () => {
    resetForm();
    // Gerar webhook URL e verify token automaticamente
    const result = await generateWebhookUrl.mutateAsync();
    setWebhookUrl(result.webhook_url);
    setWebhookVerifyToken(result.verify_token);
    setFormVerifyToken(result.verify_token);
    setShowAddModal(true);
  };

  const handleTestConnection = async () => {
    if (!formPageAccessToken || !formInstagramAccountId) {
      toast.error('Preencha o Token de Acesso e o ID da conta Instagram');
      return;
    }
    await testConnection.mutateAsync({
      page_access_token: formPageAccessToken,
      instagram_account_id: formInstagramAccountId,
    });
  };

  const handleCreateChannel = async () => {
    if (!formName.trim() || !formInstagramAccountId || !formPageId || !formPageAccessToken) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    await createChannel.mutateAsync({
      name: formName,
      instagram_account_id: formInstagramAccountId,
      instagram_username: formInstagramUsername,
      page_id: formPageId,
      page_access_token: formPageAccessToken,
      app_secret: formAppSecret || undefined,
      verify_token: formVerifyToken,
      department_id: formDepartmentId || null,
    });

    setShowAddModal(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (!selectedChannel) return;
    await deleteChannel.mutateAsync(selectedChannel.id);
    setShowDeleteConfirm(false);
    setSelectedChannel(null);
  };

  const handleRestore = async (id: string) => {
    await restoreChannel.mutateAsync(id);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <TooltipProvider>
      <div className="container max-w-6xl mx-auto py-6 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500">
                <Instagram className="h-6 w-6 text-white" />
              </div>
              Canais Instagram
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie suas conexões com o Instagram Messaging API
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeletedModal(true)}
              className="gap-2"
            >
              <Trash2 size={16} />
              Lixeira ({deletedChannels.length})
            </Button>
            <Button onClick={handleOpenAdd} className="gap-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600">
              <Plus size={16} />
              Novo Canal
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Wifi size={20} className="text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conectados</p>
                <p className="text-2xl font-bold">{connectedCount}</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-xl border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <MessageCircle size={20} className="text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Canais</p>
                <p className="text-2xl font-bold">{channels.length}</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-xl border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Users size={20} className="text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Seguidores Total</p>
                <p className="text-2xl font-bold">
                  {channels.reduce((sum, c) => sum + (c.followers_count || 0), 0).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Channel List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : channels.length === 0 ? (
          <div className="text-center py-12 border rounded-xl bg-card">
            <Instagram size={48} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum canal Instagram</h3>
            <p className="text-muted-foreground mb-4">
              Conecte sua conta Instagram Business para começar a receber e enviar mensagens.
            </p>
            <Button onClick={handleOpenAdd} className="gap-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500">
              <Plus size={16} />
              Conectar Instagram
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {channels.map(channel => (
              <div
                key={channel.id}
                className="p-4 rounded-xl border bg-card hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    {channel.profile_picture_url ? (
                      <img
                        src={channel.profile_picture_url}
                        alt={channel.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-pink-500/30"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
                        <Instagram size={24} className="text-white" />
                      </div>
                    )}

                    {/* Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{channel.name}</h3>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          channel.status === 'connected'
                            ? "bg-green-500/20 text-green-600"
                            : "bg-red-500/20 text-red-600"
                        )}>
                          {channel.status === 'connected' ? 'Conectado' : 'Desconectado'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        @{channel.instagram_username}
                        {channel.followers_count ? ` · ${channel.followers_count.toLocaleString('pt-BR')} seguidores` : ''}
                      </p>
                      {channel.department && (
                        <p className="text-xs text-blue-500 mt-0.5">
                          Departamento: {channel.department.name}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {/* Stats */}
                    <div className="hidden md:flex items-center gap-4 mr-4 text-sm text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger>
                          <span>📤 {channel.messages_sent || 0}</span>
                        </TooltipTrigger>
                        <TooltipContent>Mensagens enviadas</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger>
                          <span>📥 {channel.messages_received || 0}</span>
                        </TooltipTrigger>
                        <TooltipContent>Mensagens recebidas</TooltipContent>
                      </Tooltip>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setSelectedChannel(channel);
                          setShowDetailsModal(true);
                        }}>
                          <Settings size={14} className="mr-2" />
                          Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            setSelectedChannel(channel);
                            setShowDeleteConfirm(true);
                          }}
                        >
                          <Trash2 size={14} className="mr-2" />
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* =====================================================
            MODAL: ADICIONAR NOVO CANAL
            ===================================================== */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Instagram size={20} className="text-pink-500" />
                Conectar Canal Instagram
              </DialogTitle>
              <DialogDescription>
                Configure sua conta Instagram Business para receber e enviar mensagens via DM.
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="credentials" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="credentials">1. Credenciais</TabsTrigger>
                <TabsTrigger value="webhook">2. Webhook</TabsTrigger>
              </TabsList>

              {/* Tab 1: Credenciais */}
              <TabsContent value="credentials" className="space-y-4 mt-4">
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-start gap-2">
                    <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-600">
                      <p className="font-medium mb-1">Pré-requisitos:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-xs">
                        <li>Conta Instagram Business ou Creator</li>
                        <li>Página do Facebook vinculada à conta Instagram</li>
                        <li>App no Meta Developers com permissão <code>instagram_manage_messages</code></li>
                        <li>Advanced Access aprovado para messaging</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Nome do Canal *</Label>
                    <Input
                      placeholder="Ex: Atendimento Instagram"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Instagram Account ID *</Label>
                      <Input
                        placeholder="Ex: 17841400123456789"
                        value={formInstagramAccountId}
                        onChange={(e) => setFormInstagramAccountId(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>@Username</Label>
                      <Input
                        placeholder="Ex: minha_empresa"
                        value={formInstagramUsername}
                        onChange={(e) => setFormInstagramUsername(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Page ID (Facebook) *</Label>
                    <Input
                      placeholder="ID da Página do Facebook vinculada"
                      value={formPageId}
                      onChange={(e) => setFormPageId(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Page Access Token *</Label>
                    <div className="relative">
                      <Input
                        type={showToken ? 'text' : 'password'}
                        placeholder="Token de acesso da página"
                        value={formPageAccessToken}
                        onChange={(e) => setFormPageAccessToken(e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label>App Secret (opcional)</Label>
                    <Input
                      type="password"
                      placeholder="Secret do App Meta"
                      value={formAppSecret}
                      onChange={(e) => setFormAppSecret(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Usado para verificar assinatura dos webhooks (recomendado)
                    </p>
                  </div>

                  <div>
                    <Label>Departamento</Label>
                    <Select value={formDepartmentId} onValueChange={setFormDepartmentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map(dept => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testConnection.isPending || !formPageAccessToken || !formInstagramAccountId}
                    className="w-full gap-2"
                  >
                    {testConnection.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Check size={16} />
                    )}
                    Testar Conexão
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 2: Webhook */}
              <TabsContent value="webhook" className="space-y-4 mt-4">
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-600">
                      <p className="font-medium mb-1">Configure no Meta Developers:</p>
                      <ol className="list-decimal list-inside space-y-0.5 text-xs">
                        <li>Vá em Webhooks no seu App</li>
                        <li>Selecione "Instagram" no dropdown</li>
                        <li>Cole a URL e o Token abaixo</li>
                        <li>Subscreva o campo <code>messages</code></li>
                        <li>Ative page subscriptions via API</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Webhook URL</Label>
                    <div className="flex gap-2">
                      <Input value={webhookUrl} readOnly className="bg-muted" />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(webhookUrl, 'URL')}
                      >
                        <Copy size={16} />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label>Verify Token</Label>
                    <div className="flex gap-2">
                      <Input value={formVerifyToken} readOnly className="bg-muted" />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(formVerifyToken, 'Token')}
                      >
                        <Copy size={16} />
                      </Button>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-sm font-medium mb-2">Subscrever Page (executar via API):</p>
                    <code className="text-xs block bg-background p-2 rounded border break-all">
                      POST https://graph.facebook.com/v21.0/{formPageId || '{PAGE_ID}'}/subscribed_apps?access_token={'{TOKEN}'}&subscribed_fields=messages
                    </code>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateChannel}
                disabled={createChannel.isPending || !formName || !formInstagramAccountId || !formPageId || !formPageAccessToken}
                className="gap-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500"
              >
                {createChannel.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                Criar Canal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* =====================================================
            MODAL: DETALHES DO CANAL
            ===================================================== */}
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Instagram size={20} className="text-pink-500" />
                Detalhes do Canal
              </DialogTitle>
            </DialogHeader>

            {selectedChannel && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {selectedChannel.profile_picture_url ? (
                    <img
                      src={selectedChannel.profile_picture_url}
                      alt={selectedChannel.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-pink-500/30"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
                      <Instagram size={32} className="text-white" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-lg">{selectedChannel.name}</h3>
                    <p className="text-muted-foreground">@{selectedChannel.instagram_username}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground">Status</p>
                    <p className={cn(
                      "font-medium",
                      selectedChannel.status === 'connected' ? "text-green-600" : "text-red-600"
                    )}>
                      {selectedChannel.status === 'connected' ? 'Conectado' : 'Desconectado'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground">Seguidores</p>
                    <p className="font-medium">
                      {(selectedChannel.followers_count || 0).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground">Enviadas</p>
                    <p className="font-medium">{selectedChannel.messages_sent || 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground">Recebidas</p>
                    <p className="font-medium">{selectedChannel.messages_received || 0}</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account ID</span>
                    <span className="font-mono">{selectedChannel.instagram_account_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Page ID</span>
                    <span className="font-mono">{selectedChannel.page_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Webhook</span>
                    <span className={cn(
                      "font-medium",
                      selectedChannel.webhook_configured ? "text-green-600" : "text-amber-600"
                    )}>
                      {selectedChannel.webhook_configured ? 'Configurado' : 'Pendente'}
                    </span>
                  </div>
                  {selectedChannel.department && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Departamento</span>
                      <span>{selectedChannel.department.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Criado em</span>
                    <span>{new Date(selectedChannel.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* =====================================================
            MODAL: LIXEIRA
            ===================================================== */}
        <Dialog open={showDeletedModal} onOpenChange={setShowDeletedModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Canais Removidos</DialogTitle>
            </DialogHeader>
            {deletedChannels.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground">Nenhum canal na lixeira</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {deletedChannels.map(channel => (
                  <div key={channel.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{channel.name}</p>
                      <p className="text-xs text-muted-foreground">
                        @{channel.instagram_username} · Removido em {channel.deleted_at ? new Date(channel.deleted_at).toLocaleDateString('pt-BR') : ''}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(channel.id)}
                      className="gap-1"
                    >
                      <RefreshCw size={14} />
                      Restaurar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* =====================================================
            DIALOG: CONFIRMAR DELETE
            ===================================================== */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover canal Instagram?</AlertDialogTitle>
              <AlertDialogDescription>
                O canal <strong>@{selectedChannel?.instagram_username}</strong> será movido para a lixeira.
                As conversas existentes serão mantidas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
