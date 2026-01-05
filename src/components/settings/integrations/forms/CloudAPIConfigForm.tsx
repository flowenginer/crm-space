import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ExternalLink, Copy, Check, TestTube, Phone } from 'lucide-react';
import { 
  useCloudAPIConfig, 
  useCreateCloudAPIConfig, 
  useUpdateCloudAPIConfig,
  useTestCloudAPIConnection,
  useGenerateWebhookUrl
} from '@/hooks/useCloudAPIConfig';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { VoIPProvider } from '@/types/cloudapi';

interface CloudAPIConfigFormProps {
  onSuccess?: () => void;
}

export function CloudAPIConfigForm({ onSuccess }: CloudAPIConfigFormProps) {
  const { data: existingConfig, isLoading } = useCloudAPIConfig();
  const createConfig = useCreateCloudAPIConfig();
  const updateConfig = useUpdateCloudAPIConfig();
  const testConnection = useTestCloudAPIConnection();
  const generateWebhookUrl = useGenerateWebhookUrl();

  // Buscar canais WhatsApp disponíveis
  const { data: channels } = useQuery({
    queryKey: ['whatsapp-channels-for-cloudapi'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_channels')
        .select('id, name, phone')
        .eq('is_deleted', false)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const [formData, setFormData] = useState({
    phone_number_id: '',
    waba_id: '',
    business_account_id: '',
    access_token: '',
    verify_token: '',
    app_secret: '',
    calling_enabled: false,
    voip_provider: '' as VoIPProvider | '',
    transcription_enabled: false,
    sentiment_analysis_enabled: false,
    channel_id: '',
  });

  const [webhookUrl, setWebhookUrl] = useState('');
  const [copied, setCopied] = useState<'url' | 'token' | null>(null);

  useEffect(() => {
    if (existingConfig) {
      setFormData({
        phone_number_id: existingConfig.phone_number_id || '',
        waba_id: existingConfig.waba_id || '',
        business_account_id: existingConfig.business_account_id || '',
        access_token: existingConfig.access_token || '',
        verify_token: existingConfig.verify_token || '',
        app_secret: existingConfig.app_secret || '',
        calling_enabled: existingConfig.calling_enabled || false,
        voip_provider: existingConfig.voip_provider || '',
        transcription_enabled: existingConfig.transcription_enabled || false,
        sentiment_analysis_enabled: existingConfig.sentiment_analysis_enabled || false,
        channel_id: existingConfig.channel_id || '',
      });
    }
  }, [existingConfig]);

  useEffect(() => {
    // Gerar URL do webhook
    setWebhookUrl('https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/cloudapi-webhook');
  }, []);

  const handleGenerateToken = async () => {
    const result = await generateWebhookUrl.mutateAsync();
    setFormData(prev => ({ ...prev, verify_token: result.verify_token }));
    toast.success('Token de verificação gerado!');
  };

  const handleCopy = async (type: 'url' | 'token', value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(type);
    toast.success('Copiado!');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleTestConnection = async () => {
    if (!formData.phone_number_id || !formData.access_token) {
      toast.error('Preencha o Phone Number ID e Access Token');
      return;
    }
    await testConnection.mutateAsync({
      phone_number_id: formData.phone_number_id,
      access_token: formData.access_token,
    });
  };

  const handleSave = async () => {
    if (!formData.phone_number_id || !formData.access_token || !formData.verify_token) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    if (!formData.channel_id) {
      toast.error('Selecione um canal WhatsApp');
      return;
    }

    try {
      if (existingConfig) {
        await updateConfig.mutateAsync({
          id: existingConfig.id,
          ...formData,
          voip_provider: formData.voip_provider || null,
          channel_id: formData.channel_id || null,
        });
      } else {
        await createConfig.mutateAsync({
          ...formData,
          voip_provider: formData.voip_provider || undefined,
          channel_id: formData.channel_id || undefined,
        });
      }
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const isSaving = createConfig.isPending || updateConfig.isPending;

  return (
    <div className="space-y-6">
      {/* Documentação */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <a 
          href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-primary hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          Documentação Cloud API
        </a>
      </div>

      {/* Canal WhatsApp */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Canal WhatsApp</h3>
        <div className="space-y-2">
          <Label htmlFor="channel_id">Vincular ao Canal *</Label>
          <Select
            value={formData.channel_id}
            onValueChange={(value) => setFormData(prev => ({ ...prev, channel_id: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o canal" />
            </SelectTrigger>
            <SelectContent>
              {channels?.map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>
                  {channel.name} {channel.phone && `(${channel.phone})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            A configuração será vinculada a este canal para chamadas
          </p>
        </div>
      </div>

      {/* Credenciais */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Credenciais do Meta</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone_number_id">Phone Number ID *</Label>
            <Input
              id="phone_number_id"
              value={formData.phone_number_id}
              onChange={(e) => setFormData(prev => ({ ...prev, phone_number_id: e.target.value }))}
              placeholder="Ex: 123456789012345"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="waba_id">WABA ID</Label>
            <Input
              id="waba_id"
              value={formData.waba_id}
              onChange={(e) => setFormData(prev => ({ ...prev, waba_id: e.target.value }))}
              placeholder="WhatsApp Business Account ID"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="access_token">Access Token (Permanente) *</Label>
          <Input
            id="access_token"
            type="password"
            value={formData.access_token}
            onChange={(e) => setFormData(prev => ({ ...prev, access_token: e.target.value }))}
            placeholder="Token de acesso permanente do Meta"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="app_secret">App Secret</Label>
          <Input
            id="app_secret"
            type="password"
            value={formData.app_secret}
            onChange={(e) => setFormData(prev => ({ ...prev, app_secret: e.target.value }))}
            placeholder="Secret do App (para validar webhooks)"
          />
        </div>

        <Button 
          variant="outline" 
          onClick={handleTestConnection}
          disabled={testConnection.isPending}
        >
          {testConnection.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <TestTube className="h-4 w-4 mr-2" />
          )}
          Testar Conexão
        </Button>
      </div>

      {/* Webhook */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-sm font-medium">Configuração do Webhook</h3>
        <p className="text-xs text-muted-foreground">
          Configure essas informações no painel de desenvolvedores do Meta.
        </p>

        <div className="space-y-2">
          <Label>URL do Webhook</Label>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-xs" />
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => handleCopy('url', webhookUrl)}
            >
              {copied === 'url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="verify_token">Verify Token *</Label>
          <div className="flex gap-2">
            <Input
              id="verify_token"
              value={formData.verify_token}
              onChange={(e) => setFormData(prev => ({ ...prev, verify_token: e.target.value }))}
              placeholder="Token de verificação"
              className="font-mono text-xs"
            />
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => formData.verify_token && handleCopy('token', formData.verify_token)}
              disabled={!formData.verify_token}
            >
              {copied === 'token' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="outline" onClick={handleGenerateToken}>
              Gerar
            </Button>
          </div>
        </div>
      </div>

      {/* Calling API */}
      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4" />
              API de Ligações
            </h3>
            <p className="text-xs text-muted-foreground">
              Habilita chamadas de voz via WhatsApp (requer aprovação do Meta)
            </p>
          </div>
          <Switch
            checked={formData.calling_enabled}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, calling_enabled: checked }))}
          />
        </div>

        {formData.calling_enabled && (
          <div className="space-y-4 pl-4 border-l-2 border-muted">
            <div className="space-y-2">
              <Label>Provedor VoIP (para gravação)</Label>
              <Select
                value={formData.voip_provider}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  voip_provider: value as VoIPProvider 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um provedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (sem gravação)</SelectItem>
                  <SelectItem value="twilio">Twilio</SelectItem>
                  <SelectItem value="asterisk">Asterisk</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A Cloud API não grava chamadas automaticamente. Use um provedor VoIP para gravação.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Transcrição Automática</Label>
                <p className="text-xs text-muted-foreground">
                  Transcreve as gravações com Whisper
                </p>
              </div>
              <Switch
                checked={formData.transcription_enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, transcription_enabled: checked }))}
                disabled={!formData.voip_provider || formData.voip_provider === 'none'}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Análise de Sentimento</Label>
                <p className="text-xs text-muted-foreground">
                  Analisa o sentimento das conversas
                </p>
              </div>
              <Switch
                checked={formData.sentiment_analysis_enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, sentiment_analysis_enabled: checked }))}
                disabled={!formData.transcription_enabled}
              />
            </div>
          </div>
        )}
      </div>

      {/* Salvar */}
      <Button 
        className="w-full" 
        onClick={handleSave}
        disabled={isSaving}
      >
        {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {existingConfig ? 'Atualizar Configuração' : 'Salvar Configuração'}
      </Button>
    </div>
  );
}
