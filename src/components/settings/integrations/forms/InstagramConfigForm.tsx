import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Check,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Unlink,
  Instagram,
  Copy,
  Info,
} from 'lucide-react';
import { useInstagramConfig, useSaveInstagramConfig, useDisconnectInstagram } from '@/hooks/useInstagramConfig';
import { toast } from 'sonner';

interface InstagramConfigFormProps {
  onSuccess?: () => void;
}

export function InstagramConfigForm({ onSuccess }: InstagramConfigFormProps) {
  const { data: existingConfig, isLoading } = useInstagramConfig();
  const saveConfig = useSaveInstagramConfig();
  const disconnectMutation = useDisconnectInstagram();

  const [formData, setFormData] = useState({
    page_id: '',
    instagram_account_id: '',
    page_access_token: '',
    app_secret: '',
    channel_name: 'Instagram Direct',
  });

  const webhookUrl = 'https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/instagram-webhook';

  const handleSave = async () => {
    if (!formData.page_id || !formData.instagram_account_id || !formData.page_access_token) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      await saveConfig.mutateAsync(formData);
      toast.success('Instagram Direct configurado com sucesso!');
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar configuração');
    }
  };

  const handleDisconnect = async () => {
    if (!existingConfig) return;
    try {
      await disconnectMutation.mutateAsync(existingConfig.id);
      toast.success('Instagram desconectado');
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao desconectar');
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Connected state
  if (existingConfig) {
    return (
      <div className="space-y-4">
        <Alert className="bg-green-500/10 border-green-500/30">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-700 dark:text-green-400">
            Instagram Direct conectado e ativo
          </AlertDescription>
        </Alert>

        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Page ID</span>
              <span className="text-sm font-mono">{existingConfig.page_id}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Instagram Account</span>
              <span className="text-sm font-mono">{existingConfig.instagram_account_id}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Webhook</span>
              <Badge variant={existingConfig.webhook_configured ? 'default' : 'secondary'}>
                {existingConfig.webhook_configured ? 'Configurado' : 'Pendente'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Webhook Setup Guide */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="h-4 w-4" />
              Configuração do Webhook no Meta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground">URL do Webhook</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input value={webhookUrl} readOnly className="text-xs font-mono" />
                <Button size="sm" variant="outline" onClick={() => handleCopy(webhookUrl, 'URL')}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Verify Token</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input value={existingConfig.verify_token} readOnly className="text-xs font-mono" />
                <Button size="sm" variant="outline" onClick={() => handleCopy(existingConfig.verify_token, 'Token')}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure estes valores no Meta Developer Portal → Instagram → Webhooks → 
              Assinatura no campo <strong>messages</strong>
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDisconnect}
            disabled={disconnectMutation.isPending}
          >
            {disconnectMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Unlink className="h-4 w-4 mr-1" />
            )}
            Desconectar
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Meta Developer Portal
            </a>
          </Button>
        </div>
      </div>
    );
  }

  // Setup state
  return (
    <div className="space-y-4">
      {/* Prerequisites */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Instagram className="h-4 w-4" />
            Pré-requisitos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
            <span>Conta Business no Instagram conectada a uma Página do Facebook</span>
          </div>
          <div className="flex items-start gap-2">
            <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
            <span>App criado no Meta Developer Portal com produto Instagram</span>
          </div>
          <div className="flex items-start gap-2">
            <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
            <span>Permissões: <code className="text-xs bg-muted px-1 rounded">instagram_basic</code>, <code className="text-xs bg-muted px-1 rounded">instagram_manage_messages</code>, <code className="text-xs bg-muted px-1 rounded">pages_messaging</code></span>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Após configurar, você precisará adicionar o webhook no Meta Developer Portal.
          As instruções serão exibidas após salvar.
        </AlertDescription>
      </Alert>

      {/* Form */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="channel_name">Nome do Canal</Label>
          <Input
            id="channel_name"
            value={formData.channel_name}
            onChange={(e) => setFormData(prev => ({ ...prev, channel_name: e.target.value }))}
            placeholder="Instagram Direct"
          />
        </div>

        <div>
          <Label htmlFor="page_id">Facebook Page ID *</Label>
          <Input
            id="page_id"
            value={formData.page_id}
            onChange={(e) => setFormData(prev => ({ ...prev, page_id: e.target.value }))}
            placeholder="Ex: 123456789012345"
          />
          <p className="text-xs text-muted-foreground mt-1">
            ID da Página do Facebook vinculada ao Instagram Business
          </p>
        </div>

        <div>
          <Label htmlFor="instagram_account_id">Instagram Business Account ID *</Label>
          <Input
            id="instagram_account_id"
            value={formData.instagram_account_id}
            onChange={(e) => setFormData(prev => ({ ...prev, instagram_account_id: e.target.value }))}
            placeholder="Ex: 17841400000000000"
          />
        </div>

        <div>
          <Label htmlFor="page_access_token">Page Access Token (permanente) *</Label>
          <Input
            id="page_access_token"
            type="password"
            value={formData.page_access_token}
            onChange={(e) => setFormData(prev => ({ ...prev, page_access_token: e.target.value }))}
            placeholder="Token de acesso permanente da página"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Gere um token permanente no Meta Developer Portal → Configurações do App
          </p>
        </div>

        <div>
          <Label htmlFor="app_secret">App Secret (opcional)</Label>
          <Input
            id="app_secret"
            type="password"
            value={formData.app_secret}
            onChange={(e) => setFormData(prev => ({ ...prev, app_secret: e.target.value }))}
            placeholder="Para validação de assinatura do webhook"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={saveConfig.isPending || !formData.page_id || !formData.instagram_account_id || !formData.page_access_token}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          {saveConfig.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Instagram className="h-4 w-4 mr-1" />
          )}
          Conectar Instagram Direct
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href="https://developers.facebook.com/docs/instagram-api/guides/messaging" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-1" />
            Documentação
          </a>
        </Button>
      </div>
    </div>
  );
}
