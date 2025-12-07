import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Save, Loader2, Link2, Shield, Filter, Bell } from "lucide-react";
import { WebhookConfig, WEBHOOK_EVENTS, useCreateWebhook, useUpdateWebhook } from "@/hooks/useWebhooks";
import { useDepartments } from "@/hooks/useDepartments";
import { useChannels } from "@/hooks/useChannels";

interface WebhookConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook?: WebhookConfig | null;
}

export function WebhookConfigModal({ open, onOpenChange, webhook }: WebhookConfigModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [authType, setAuthType] = useState('none');
  const [authToken, setAuthToken] = useState('');
  const [authHeaderName, setAuthHeaderName] = useState('');
  const [authHeaderValue, setAuthHeaderValue] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [departmentId, setDepartmentId] = useState<string>('');
  const [channelId, setChannelId] = useState<string>('');

  const { data: departments } = useDepartments();
  const { data: channels } = useChannels();
  const createWebhook = useCreateWebhook();
  const updateWebhook = useUpdateWebhook();

  const isLoading = createWebhook.isPending || updateWebhook.isPending;

  useEffect(() => {
    if (webhook) {
      setName(webhook.name);
      setUrl(webhook.url);
      setAuthType(webhook.auth_type);
      setAuthToken(webhook.auth_token || '');
      setAuthHeaderName(webhook.auth_header_name || '');
      setAuthHeaderValue(webhook.auth_header_value || '');
      setEvents(webhook.events);
      setDepartmentId(webhook.filters?.department_id || '');
      setChannelId(webhook.filters?.channel_id || '');
    } else {
      resetForm();
    }
  }, [webhook, open]);

  const resetForm = () => {
    setName('');
    setUrl('');
    setAuthType('none');
    setAuthToken('');
    setAuthHeaderName('');
    setAuthHeaderValue('');
    setEvents([]);
    setDepartmentId('');
    setChannelId('');
  };

  const toggleEvent = (eventKey: string) => {
    setEvents(prev =>
      prev.includes(eventKey)
        ? prev.filter(e => e !== eventKey)
        : [...prev, eventKey]
    );
  };

  const toggleCategory = (categoryEvents: { key: string }[]) => {
    const categoryKeys = categoryEvents.map(e => e.key);
    const allSelected = categoryKeys.every(key => events.includes(key));

    if (allSelected) {
      setEvents(prev => prev.filter(e => !categoryKeys.includes(e)));
    } else {
      setEvents(prev => [...new Set([...prev, ...categoryKeys])]);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !url.trim()) return;

    const filters: Record<string, string> = {};
    if (departmentId) filters.department_id = departmentId;
    if (channelId) filters.channel_id = channelId;

    const webhookData = {
      name: name.trim(),
      url: url.trim(),
      auth_type: authType,
      auth_token: authType === 'bearer' ? authToken : null,
      auth_header_name: authType === 'header' ? authHeaderName : null,
      auth_header_value: authType === 'header' ? authHeaderValue : null,
      events,
      filters,
    };

    if (webhook) {
      await updateWebhook.mutateAsync({ id: webhook.id, ...webhookData });
    } else {
      await createWebhook.mutateAsync(webhookData);
    }

    onOpenChange(false);
  };

  const renderEventCategory = (title: string, categoryEvents: { key: string; label: string; description: string }[]) => {
    const categoryKeys = categoryEvents.map(e => e.key);
    const selectedCount = categoryKeys.filter(key => events.includes(key)).length;
    const allSelected = selectedCount === categoryKeys.length;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-foreground">{title}</h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => toggleCategory(categoryEvents)}
          >
            {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
          </Button>
        </div>
        <div className="space-y-1">
          {categoryEvents.map(event => (
            <label
              key={event.key}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <Checkbox
                checked={events.includes(event.key)}
                onCheckedChange={() => toggleEvent(event.key)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{event.label}</p>
                <p className="text-xs text-muted-foreground">{event.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            {webhook ? 'Editar Webhook' : 'Novo Webhook'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Webhook *</Label>
                <Input
                  id="name"
                  placeholder="Ex: N8N - Automações"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">URL do Webhook *</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://seu-dominio.com/webhook"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Authentication */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Autenticação (opcional)</h3>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Autenticação</Label>
                <Select value={authType} onValueChange={setAuthType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="header">Header Customizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {authType === 'bearer' && (
                <div className="space-y-2">
                  <Label htmlFor="authToken">Token</Label>
                  <Input
                    id="authToken"
                    type="password"
                    placeholder="Seu token de autenticação"
                    value={authToken}
                    onChange={e => setAuthToken(e.target.value)}
                  />
                </div>
              )}

              {authType === 'header' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="headerName">Nome do Header</Label>
                    <Input
                      id="headerName"
                      placeholder="X-API-Key"
                      value={authHeaderName}
                      onChange={e => setAuthHeaderName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="headerValue">Valor do Header</Label>
                    <Input
                      id="headerValue"
                      type="password"
                      placeholder="Valor secreto"
                      value={authHeaderValue}
                      onChange={e => setAuthHeaderValue(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Events */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Eventos</h3>
                <span className="text-xs text-muted-foreground">
                  ({events.length} selecionado{events.length !== 1 ? 's' : ''})
                </span>
              </div>

              <div className="border rounded-lg p-4 max-h-[300px] overflow-y-auto">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-6">
                    {renderEventCategory('Mensagens', WEBHOOK_EVENTS.messages)}
                    {renderEventCategory('Contatos', WEBHOOK_EVENTS.contacts)}
                    {renderEventCategory('Canais', WEBHOOK_EVENTS.channels)}
                  </div>
                  <div className="space-y-6">
                    {renderEventCategory('Conversas', WEBHOOK_EVENTS.conversations)}
                    {renderEventCategory('Negócios', WEBHOOK_EVENTS.deals)}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Filters */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Filtros (opcional)</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select value={departmentId || 'all'} onValueChange={v => setDepartmentId(v === 'all' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {departments?.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Canal</Label>
                  <Select value={channelId || 'all'} onValueChange={v => setChannelId(v === 'all' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {channels?.map(channel => (
                        <SelectItem key={channel.id} value={channel.id}>{channel.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !name.trim() || !url.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {webhook ? 'Salvar Alterações' : 'Criar Webhook'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
