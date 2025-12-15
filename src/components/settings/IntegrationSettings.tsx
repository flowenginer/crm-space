import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Save, ExternalLink, CheckCircle, XCircle, Loader2, Plug, ChevronDown } from 'lucide-react';
import { RedePaymentSettings } from './RedePaymentSettings';
import { MelhorEnvioSettings } from './MelhorEnvioSettings';

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
  const [openProviders, setOpenProviders] = useState<Record<string, boolean>>({});

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

  const toggleProvider = (providerId: string) => {
    setOpenProviders(prev => ({
      ...prev,
      [providerId]: !prev[providerId],
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
      {/* Payment Gateway - Rede */}
      <RedePaymentSettings />

      {/* Shipping - Melhor Envio */}
      <MelhorEnvioSettings />

      {/* WhatsApp Section Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plug className="h-5 w-5" />
            Integrações WhatsApp
          </CardTitle>
          <CardDescription className="text-sm">
            Configure as credenciais dos provedores para criar canais automaticamente.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* WhatsApp Providers Grid - 3 columns */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {providers?.map((provider) => {
          const values = getFormValue(provider);
          const isOpen = openProviders[provider.id] ?? false;
          
          return (
            <Collapsible
              key={provider.id}
              open={isOpen}
              onOpenChange={() => toggleProvider(provider.id)}
            >
              <Card className={`transition-all duration-200 ${provider.is_configured ? 'border-green-500/50' : ''}`}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                          provider.is_configured ? 'bg-green-500/10' : 'bg-muted'
                        }`}>
                          {provider.is_configured ? (
                            <CheckCircle size={16} className="text-green-500" />
                          ) : (
                            <XCircle size={16} className="text-muted-foreground" />
                          )}
                        </div>
                        <div className="text-left">
                          <CardTitle className="text-sm font-medium">{provider.name}</CardTitle>
                          <CardDescription className="text-xs">{provider.code}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          provider.is_configured 
                            ? 'bg-green-500/10 text-green-500' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {provider.is_configured ? 'OK' : 'N/C'}
                        </span>
                        <ChevronDown 
                          size={16} 
                          className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
                        />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="space-y-3 pt-0 px-4 pb-4">
                    {/* URL Base (Evolution e UAZAPI) */}
                    {(provider.code === 'evolution' || provider.code === 'uazapi') && (
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          URL do Servidor *
                        </label>
                        <Input
                          value={values.baseUrl}
                          onChange={(e) => updateFormValue(provider.id, 'baseUrl', e.target.value)}
                          placeholder={provider.code === 'uazapi' 
                            ? "https://api.seudominio.com" 
                            : "https://evolution.seudominio.com"}
                          className="h-8 text-sm"
                        />
                      </div>
                    )}

                    {/* Admin Token / API Key */}
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        {provider.code === 'zapi' && 'Client Token *'}
                        {provider.code === 'uazapi' && 'Admin Token *'}
                        {provider.code === 'evolution' && 'API Key *'}
                      </label>
                      <Input
                        type="password"
                        value={values.adminToken}
                        onChange={(e) => updateFormValue(provider.id, 'adminToken', e.target.value)}
                        placeholder="Cole sua chave..."
                        className="h-8 text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {provider.code === 'zapi' && (
                          <a 
                            href="https://app.z-api.io/app/security" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            Obter em z-api.io
                            <ExternalLink size={10} />
                          </a>
                        )}
                        {provider.code === 'uazapi' && 'Painel UAZAPI'}
                        {provider.code === 'evolution' && 'AUTHENTICATION_API_KEY'}
                      </p>
                    </div>

                    {/* Client Token (apenas Z-API) */}
                    {provider.code === 'zapi' && (
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Security Token (opcional)
                        </label>
                        <Input
                          type="password"
                          value={values.clientToken}
                          onChange={(e) => updateFormValue(provider.id, 'clientToken', e.target.value)}
                          placeholder="Token adicional"
                          className="h-8 text-sm"
                        />
                      </div>
                    )}

                    {/* Botão Salvar */}
                    <Button
                      onClick={() => handleSave(provider)}
                      disabled={saving === provider.id}
                      size="sm"
                      className="w-full mt-2"
                    >
                      {saving === provider.id ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-3 w-3" />
                      )}
                      Salvar
                    </Button>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      {/* Documentação - Compacta */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="py-3 px-4">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-blue-500 mr-2">Documentação:</span>
            <a href="https://developer.z-api.io/" target="_blank" className="text-primary hover:underline mr-3">Z-API</a>
            <a href="https://docs.uazapi.com/" target="_blank" className="text-primary hover:underline mr-3">UAZAPI</a>
            <a href="https://doc.evolution-api.com/" target="_blank" className="text-primary hover:underline">Evolution</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
