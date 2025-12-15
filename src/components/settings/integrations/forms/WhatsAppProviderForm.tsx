import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Loader2, ExternalLink } from 'lucide-react';

interface Provider {
  id: string;
  name: string;
  code: string;
  base_url: string;
  admin_token?: string | null;
  client_token?: string | null;
  is_configured?: boolean;
}

interface WhatsAppProviderFormProps {
  provider: Provider;
  onSuccess?: () => void;
}

export function WhatsAppProviderForm({ provider, onSuccess }: WhatsAppProviderFormProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    adminToken: provider.admin_token || '',
    clientToken: provider.client_token || '',
    baseUrl: provider.base_url || '',
  });

  useEffect(() => {
    setFormData({
      adminToken: provider.admin_token || '',
      clientToken: provider.client_token || '',
      baseUrl: provider.base_url || '',
    });
  }, [provider]);

  const saveConfig = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('whatsapp_providers')
        .update({
          admin_token: formData.adminToken || null,
          client_token: formData.clientToken || null,
          base_url: formData.baseUrl || undefined,
          is_configured: !!formData.adminToken,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', provider.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configuração salva!');
      queryClient.invalidateQueries({ queryKey: ['providers-config'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-providers'] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar: ' + error.message);
    },
  });

  const handleSave = async () => {
    setSaving(true);
    await saveConfig.mutateAsync();
    setSaving(false);
  };

  const getDocUrl = () => {
    switch (provider.code) {
      case 'zapi':
        return 'https://developer.z-api.io/';
      case 'uazapi':
        return 'https://docs.uazapi.com/';
      case 'evolution':
        return 'https://doc.evolution-api.com/';
      default:
        return null;
    }
  };

  const getTokenLabel = () => {
    switch (provider.code) {
      case 'zapi':
        return 'Client Token';
      case 'uazapi':
        return 'Admin Token';
      case 'evolution':
        return 'API Key';
      default:
        return 'Token';
    }
  };

  const docUrl = getDocUrl();

  return (
    <div className="space-y-6">
      {/* URL Base (Evolution e UAZAPI) */}
      {(provider.code === 'evolution' || provider.code === 'uazapi') && (
        <div className="space-y-2">
          <Label>URL do Servidor *</Label>
          <Input
            value={formData.baseUrl}
            onChange={(e) => setFormData(prev => ({ ...prev, baseUrl: e.target.value }))}
            placeholder={provider.code === 'uazapi' 
              ? "https://api.seudominio.com" 
              : "https://evolution.seudominio.com"}
          />
          <p className="text-xs text-muted-foreground">
            Endereço da sua instância do {provider.name}
          </p>
        </div>
      )}

      {/* Main Token */}
      <div className="space-y-2">
        <Label>{getTokenLabel()} *</Label>
        <Input
          type="password"
          value={formData.adminToken}
          onChange={(e) => setFormData(prev => ({ ...prev, adminToken: e.target.value }))}
          placeholder="Cole sua chave de acesso..."
        />
        {provider.code === 'zapi' && (
          <p className="text-xs text-muted-foreground">
            Obtenha em{' '}
            <a 
              href="https://app.z-api.io/app/security" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              app.z-api.io/app/security
              <ExternalLink size={10} />
            </a>
          </p>
        )}
        {provider.code === 'uazapi' && (
          <p className="text-xs text-muted-foreground">
            Encontre no painel administrativo do UAZAPI
          </p>
        )}
        {provider.code === 'evolution' && (
          <p className="text-xs text-muted-foreground">
            AUTHENTICATION_API_KEY do seu arquivo .env
          </p>
        )}
      </div>

      {/* Security Token (Z-API only) */}
      {provider.code === 'zapi' && (
        <div className="space-y-2">
          <Label>Security Token (opcional)</Label>
          <Input
            type="password"
            value={formData.clientToken}
            onChange={(e) => setFormData(prev => ({ ...prev, clientToken: e.target.value }))}
            placeholder="Token de segurança adicional"
          />
          <p className="text-xs text-muted-foreground">
            Token adicional para maior segurança
          </p>
        </div>
      )}

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full"
      >
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Salvar Configuração
      </Button>

      {/* Documentation Link */}
      {docUrl && (
        <div className="border-t pt-4">
          <Button variant="outline" size="sm" asChild className="w-full">
            <a href={docUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Documentação {provider.name}
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
