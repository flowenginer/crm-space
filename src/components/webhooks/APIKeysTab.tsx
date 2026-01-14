import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
  Key, 
  Plus, 
  Trash2, 
  Copy, 
  Check,
  Clock,
  Shield
} from "lucide-react";
import { 
  useIntegrationAPIKeys, 
  useUpdateIntegrationAPIKey, 
  useDeleteIntegrationAPIKey,
  maskAPIKey,
  IntegrationAPIKey 
} from "@/hooks/useIntegrationAPIKeys";
import { CreateAPIKeyModal } from "./CreateAPIKeyModal";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export function APIKeysTab() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<IntegrationAPIKey | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: apiKeys, isLoading } = useIntegrationAPIKeys();
  const updateAPIKey = useUpdateIntegrationAPIKey();
  const deleteAPIKey = useDeleteIntegrationAPIKey();

  const handleCopy = (apiKey: IntegrationAPIKey) => {
    navigator.clipboard.writeText(apiKey.api_key);
    setCopiedId(apiKey.id);
    toast.success("API Key copiada!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = (apiKey: IntegrationAPIKey) => {
    setSelectedKey(apiKey);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedKey) {
      await deleteAPIKey.mutateAsync(selectedKey.id);
      setDeleteDialogOpen(false);
      setSelectedKey(null);
    }
  };

  const toggleActive = async (apiKey: IntegrationAPIKey) => {
    await updateAPIKey.mutateAsync({
      id: apiKey.id,
      is_active: !apiKey.is_active,
    });
  };

  const getPermissionLabels = (permissions: IntegrationAPIKey['permissions']) => {
    const labels: string[] = [];
    if (permissions?.send_message) labels.push("Enviar mensagens");
    if (permissions?.read_contacts) labels.push("Ler contatos");
    return labels;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-32" />
        </div>
        {[1, 2].map(i => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-96 mb-4" />
              <Skeleton className="h-4 w-64" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-end">
        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova API Key
        </Button>
      </div>

      {/* Empty State */}
      {apiKeys?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Key className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhuma API Key configurada</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Crie chaves de API para integrar o CRM com ferramentas externas como N8N, Zapier, Make e outras.
            </p>
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeira API Key
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {apiKeys?.map(apiKey => (
            <Card key={apiKey.id} className={!apiKey.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-2">
                      <Key className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-lg">{apiKey.name}</h3>
                      {apiKey.is_active ? (
                        <Badge variant="default" className="bg-green-500">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>

                    {/* API Key */}
                    <div className="flex items-center gap-2 mb-3">
                      <code className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded font-mono">
                        {maskAPIKey(apiKey.api_key)}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleCopy(apiKey)}
                      >
                        {copiedId === apiKey.id ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Permissions */}
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-wrap gap-1.5">
                        {getPermissionLabels(apiKey.permissions).map(label => (
                          <Badge key={label} variant="outline" className="text-xs">
                            {label}
                          </Badge>
                        ))}
                        {getPermissionLabels(apiKey.permissions).length === 0 && (
                          <span className="text-sm text-muted-foreground">Sem permissões</span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span>
                          Criada {apiKey.created_at && formatDistanceToNow(new Date(apiKey.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                      {apiKey.last_used_at && (
                        <div className="flex items-center gap-1.5">
                          <span>•</span>
                          <span>
                            Último uso {formatDistanceToNow(new Date(apiKey.last_used_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDelete(apiKey)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <Switch
                      checked={apiKey.is_active ?? false}
                      onCheckedChange={() => toggleActive(apiKey)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateAPIKeyModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a API Key "{selectedKey?.name}"? 
              Qualquer integração usando esta chave deixará de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
