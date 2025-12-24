import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Boxes, Check, X, Building2 } from 'lucide-react';
import { useSuperAdminTenants } from '@/hooks/useSuperAdminTenants';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Lista de módulos disponíveis na plataforma
const PLATFORM_MODULES = [
  { key: 'dashboard', name: 'Dashboard', description: 'Painel principal com métricas' },
  { key: 'conversations', name: 'Conversas', description: 'Atendimento via WhatsApp' },
  { key: 'contacts', name: 'Contatos', description: 'Gestão de contatos' },
  { key: 'crm', name: 'CRM', description: 'Gestão de negociações' },
  { key: 'products', name: 'Produtos', description: 'Catálogo de produtos' },
  { key: 'orders', name: 'Pedidos', description: 'Gestão de pedidos' },
  { key: 'quotes', name: 'Orçamentos', description: 'Criação de orçamentos' },
  { key: 'financial', name: 'Financeiro', description: 'Controle financeiro' },
  { key: 'reports', name: 'Relatórios', description: 'Relatórios e analytics' },
  { key: 'automations', name: 'Automações', description: 'Fluxos automatizados' },
  { key: 'gamification', name: 'Gamificação', description: 'Sistema de pontos e rankings' },
  { key: 'internal_chat', name: 'Chat Interno', description: 'Comunicação entre equipe' },
  { key: 'internal_email', name: 'E-mail Interno', description: 'Gestão de e-mails' },
  { key: 'webhooks', name: 'Webhooks', description: 'Integrações via webhook' },
  { key: 'meta_ads', name: 'Meta Ads', description: 'Integração com Meta' },
];

export default function PlatformModules() {
  const { data: tenants = [], isLoading: tenantsLoading } = useSuperAdminTenants();
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');

  // Fetch modules for selected tenant
  const { data: tenantModules, isLoading: modulesLoading } = useQuery({
    queryKey: ['tenant-modules-admin', selectedTenantId],
    queryFn: async () => {
      if (!selectedTenantId) return null;
      
      const { data, error } = await supabase
        .from('tenant_modules')
        .select('*')
        .eq('tenant_id', selectedTenantId);

      if (error) throw error;
      return data;
    },
    enabled: !!selectedTenantId,
  });

  const isModuleEnabled = (moduleKey: string) => {
    if (!tenantModules) return false;
    const module = tenantModules.find(m => m.module_key === moduleKey);
    return module?.is_enabled ?? false;
  };

  // Count enabled modules per tenant
  const getTenantModuleCount = (tenantId: string) => {
    // This is simplified - in production you'd fetch this data
    return '—';
  };

  if (tenantsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-purple-500/10">
          <Boxes className="h-6 w-6 text-purple-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Módulos da Plataforma</h1>
          <p className="text-muted-foreground">
            Visualize os módulos disponíveis e habilitados por tenant
          </p>
        </div>
      </div>

      {/* Tenant Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Selecionar Tenant</CardTitle>
          <CardDescription>
            Escolha um tenant para visualizar seus módulos habilitados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
            <SelectTrigger className="w-full md:w-[400px]">
              <SelectValue placeholder="Selecione um tenant..." />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>{tenant.name}</span>
                    {!tenant.is_active && (
                      <Badge variant="secondary" className="ml-2">Inativo</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Modules Grid */}
      {selectedTenantId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Módulos do Tenant
            </CardTitle>
            <CardDescription>
              Status de cada módulo para o tenant selecionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            {modulesLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {PLATFORM_MODULES.map((module) => {
                  const enabled = isModuleEnabled(module.key);
                  return (
                    <div
                      key={module.key}
                      className={`p-4 rounded-lg border transition-colors ${
                        enabled 
                          ? 'bg-success/5 border-success/20' 
                          : 'bg-muted/50 border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{module.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {module.description}
                          </p>
                        </div>
                        <div className={`p-1.5 rounded-full ${
                          enabled ? 'bg-success/10' : 'bg-muted'
                        }`}>
                          {enabled ? (
                            <Check className="h-4 w-4 text-success" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* All Modules Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Todos os Módulos Disponíveis</CardTitle>
          <CardDescription>
            Lista completa de módulos da plataforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {PLATFORM_MODULES.map((module) => (
              <div
                key={module.key}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
              >
                <Badge variant="outline" className="font-mono text-xs">
                  {module.key}
                </Badge>
                <span className="text-sm font-medium">{module.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
