import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Save, ExternalLink, CheckCircle, XCircle, Loader2, Plug } from 'lucide-react';

interface ProviderWithConfig {
  id: string;
  name: string;
  code: string;
  base_url: string;
  is_active: boolean;
  admin_token?: string | null;
  client_token?: string | null;
  is_configured?: boolean;
}

export function IntegrationSettings() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, { adminToken: string; clientToken: string; baseUrl: string }>>({});

  // Buscar provedores
  const { data: providers, isLoading } = useQuery({
    queryKey: ['providers-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_providers')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as ProviderWithConfig[];
    },
  });

  // Inicializar form values quando providers carregam
  const getFormValue = (provider: ProviderWithConfig) => {
    if (formValues[provider.id]) {
      return formValues[provider.id];
    }
    return {
      adminToken: provider.admin_token || '',
      clientToken: provider.client_token || '',
      baseUrl: provider.base_url || '',
    };
  };

  const updateFormValue = (providerId: string, field: string, value: string) => {
    setFormValues(prev => ({
      ...prev,
      [providerId]: {
        ...getFormValue(providers?.find(p => p.id === providerId) || {} as ProviderWithConfig),
        [field]: value,
      }
    }));
  };

  // Salvar configuração
  const saveConfig = useMutation({
    mutationFn: async ({
      providerId,
      adminToken,
      clientToken,
      baseUrl,
    }: {
      providerId: string;
      adminToken: string;
      clientToken?: string;
      baseUrl?: string;
    }) => {
      const { error } = await supabase
        .from('whatsapp_providers')
        .update({
          admin_token: adminToken || null,
          client_token: clientToken || null,
          base_url: baseUrl || undefined,
          is_configured: !!adminToken,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', providerId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configuração salva!');
      queryClient.invalidateQueries({ queryKey: ['providers-config'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-providers'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar: ' + error.message);
    },
  });

  const handleSave = async (provider: ProviderWithConfig) => {
    setSaving(provider.id);
    const values = getFormValue(provider);
    
    await saveConfig.mutateAsync({
      providerId: provider.id,
      adminToken: values.adminToken,
      clientToken: values.clientToken,
      baseUrl: values.baseUrl,
    });
    
    setSaving(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Integrações WhatsApp
          </CardTitle>
          <CardDescription>
            Configure as credenciais dos provedores para criar canais automaticamente.
            Após configurar, você poderá adicionar canais na página de Canais WhatsApp.
          </CardDescription>
        </CardHeader>
      </Card>

      {providers?.map((provider) => {
        const values = getFormValue(provider);
        
        return (
          <Card
            key={provider.id}
            className={provider.is_configured ? 'border-green-500/50' : ''}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    provider.is_configured ? 'bg-green-500/10' : 'bg-muted'
                  }`}>
                    {provider.is_configured ? (
                      <CheckCircle size={20} className="text-green-500" />
                    ) : (
                      <XCircle size={20} className="text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{provider.name}</CardTitle>
                    <CardDescription>{provider.code}</CardDescription>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  provider.is_configured 
                    ? 'bg-green-500/10 text-green-500' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {provider.is_configured ? 'Configurado' : 'Não configurado'}
                </span>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* URL Base (Evolution e UAZAPI) */}
              {(provider.code === 'evolution' || provider.code === 'uazapi') && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    URL do Servidor *
                  </label>
                  <Input
                    value={values.baseUrl}
                    onChange={(e) => updateFormValue(provider.id, 'baseUrl', e.target.value)}
                    placeholder={provider.code === 'uazapi' 
                      ? "https://api.seudominio.com" 
                      : "https://evolution.seudominio.com"}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {provider.code === 'uazapi' 
                      ? 'URL do seu servidor UAZAPI (ex: https://api.seudominio.com)' 
                      : 'URL onde sua Evolution API está hospedada'}
                  </p>
                </div>
              )}

              {/* Admin Token / API Key */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  {provider.code === 'zapi' && 'Client Token (Integrador) *'}
                  {provider.code === 'uazapi' && 'Admin Token *'}
                  {provider.code === 'evolution' && 'API Key *'}
                </label>
                <Input
                  type="password"
                  value={values.adminToken}
                  onChange={(e) => updateFormValue(provider.id, 'adminToken', e.target.value)}
                  placeholder="Cole aqui sua chave..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {provider.code === 'zapi' && (
                    <>
                      Obtenha em{' '}
                      <a 
                        href="https://app.z-api.io/app/security" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        app.z-api.io/app/security
                        <ExternalLink size={12} className="inline ml-1" />
                      </a>
                    </>
                  )}
                  {provider.code === 'uazapi' && 'Encontre no painel da UAZAPI'}
                  {provider.code === 'evolution' && 'Definido na variável AUTHENTICATION_API_KEY'}
                </p>
              </div>

              {/* Client Token (apenas Z-API) */}
              {provider.code === 'zapi' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Security Token (opcional)
                  </label>
                  <Input
                    type="password"
                    value={values.clientToken}
                    onChange={(e) => updateFormValue(provider.id, 'clientToken', e.target.value)}
                    placeholder="Token de segurança adicional"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Para validar webhooks recebidos
                  </p>
                </div>
              )}

              {/* Botão Salvar */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => handleSave(provider)}
                  disabled={saving === provider.id}
                >
                  {saving === provider.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Documentação */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardHeader>
          <CardTitle className="text-sm text-blue-500">Documentação</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>
              • Z-API:{' '}
              <a href="https://developer.z-api.io/" target="_blank" className="text-primary hover:underline">
                developer.z-api.io
              </a>
            </li>
            <li>
              • UAZAPI:{' '}
              <a href="https://docs.uazapi.com/" target="_blank" className="text-primary hover:underline">
                docs.uazapi.com
              </a>
            </li>
            <li>
              • Evolution API:{' '}
              <a href="https://doc.evolution-api.com/" target="_blank" className="text-primary hover:underline">
                doc.evolution-api.com
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
