import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Link2, 
  Plus, 
  Pencil, 
  Trash2, 
  Send, 
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  BookOpen,
  Key
} from "lucide-react";
import { useWebhooks, useUpdateWebhook, useDeleteWebhook, WebhookConfig } from "@/hooks/useWebhooks";
import { WebhookConfigModal } from "@/components/webhooks/WebhookConfigModal";
import { WebhookLogsModal } from "@/components/webhooks/WebhookLogsModal";
import { WebhookTestModal } from "@/components/webhooks/WebhookTestModal";
import { WebhookApiDocs } from "@/components/webhooks/WebhookApiDocs";
import { RestApiDocs } from "@/components/webhooks/RestApiDocs";
import { APIKeysTab } from "@/components/webhooks/APIKeysTab";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Webhooks() {
  const [activeTab, setActiveTab] = useState("webhooks");
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfig | null>(null);

  const { data: webhooks, isLoading } = useWebhooks();
  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();

  const handleEdit = (webhook: WebhookConfig) => {
    setSelectedWebhook(webhook);
    setConfigModalOpen(true);
  };

  const handleLogs = (webhook: WebhookConfig) => {
    setSelectedWebhook(webhook);
    setLogsModalOpen(true);
  };

  const handleTest = (webhook: WebhookConfig) => {
    setSelectedWebhook(webhook);
    setTestModalOpen(true);
  };

  const handleDelete = (webhook: WebhookConfig) => {
    setSelectedWebhook(webhook);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedWebhook) {
      await deleteWebhook.mutateAsync(selectedWebhook.id);
      setDeleteDialogOpen(false);
      setSelectedWebhook(null);
    }
  };

  const toggleActive = async (webhook: WebhookConfig) => {
    await updateWebhook.mutateAsync({
      id: webhook.id,
      is_active: !webhook.is_active,
    });
  };

  const truncateUrl = (url: string, maxLength = 50) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="h-6 w-6 text-primary" />
            Webhooks & API
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure webhooks e consulte a documentação da API
          </p>
        </div>
        {activeTab === "webhooks" && (
          <Button onClick={() => { setSelectedWebhook(null); setConfigModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Webhook
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="webhooks" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="api-docs" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            API REST
          </TabsTrigger>
          <TabsTrigger value="webhook-docs" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Eventos Webhook
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="mt-6">
          {/* Webhooks List */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-96 mb-4" />
                    <Skeleton className="h-4 w-64" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : webhooks?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Link2 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhum webhook configurado</h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  Configure webhooks para integrar o CRM com ferramentas como N8N, Zapier, Make e outras automações.
                </p>
                <Button onClick={() => { setSelectedWebhook(null); setConfigModalOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Webhook
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {webhooks?.map(webhook => (
                <Card key={webhook.id} className={!webhook.is_active ? 'opacity-60' : ''}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`h-3 w-3 rounded-full ${webhook.is_active ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                          <h3 className="font-semibold text-lg">{webhook.name}</h3>
                          {!webhook.is_active && (
                            <Badge variant="secondary">Inativo</Badge>
                          )}
                        </div>

                        {/* URL */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                          <ExternalLink className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate" title={webhook.url}>
                            {truncateUrl(webhook.url, 60)}
                          </span>
                        </div>

                        {/* Events */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {webhook.events.slice(0, 5).map(event => (
                            <Badge key={event} variant="outline" className="text-xs">
                              {event}
                            </Badge>
                          ))}
                          {webhook.events.length > 5 && (
                            <Badge variant="secondary" className="text-xs">
                              +{webhook.events.length - 5} mais
                            </Badge>
                          )}
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-muted-foreground">{webhook.total_success} sucesso</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <XCircle className="h-4 w-4 text-destructive" />
                            <span className="text-muted-foreground">{webhook.total_failed} falhas</span>
                          </div>
                          {webhook.last_sent_at && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                {formatDistanceToNow(new Date(webhook.last_sent_at), { addSuffix: true, locale: ptBR })}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Last Error */}
                        {webhook.last_error && (
                          <p className="text-xs text-destructive mt-2 truncate" title={webhook.last_error}>
                            Último erro: {webhook.last_error}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(webhook)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleTest(webhook)}>
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleLogs(webhook)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(webhook)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        <Switch
                          checked={webhook.is_active}
                          onCheckedChange={() => toggleActive(webhook)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="api-keys" className="mt-6">
          <APIKeysTab />
        </TabsContent>

        <TabsContent value="api-docs" className="mt-6">
          <RestApiDocs />
        </TabsContent>

        <TabsContent value="webhook-docs" className="mt-6">
          <WebhookApiDocs />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <WebhookConfigModal
        open={configModalOpen}
        onOpenChange={setConfigModalOpen}
        webhook={selectedWebhook}
      />

      <WebhookLogsModal
        open={logsModalOpen}
        onOpenChange={setLogsModalOpen}
        webhook={selectedWebhook}
      />

      <WebhookTestModal
        open={testModalOpen}
        onOpenChange={setTestModalOpen}
        webhook={selectedWebhook}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o webhook "{selectedWebhook?.name}"? 
              Esta ação não pode ser desfeita e todos os logs de entrega serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
