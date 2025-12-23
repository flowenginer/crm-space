import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  TenantWithStats,
  useUpdateTenant,
  useTenantModules,
  useUpdateTenantModules,
  useTenantAdmin,
} from '@/hooks/useSuperAdminTenants';
import { Loader2, Building2, User, Settings, Mail, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface TenantDetailsModalProps {
  tenant: TenantWithStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AVAILABLE_MODULES = [
  { key: 'conversations', label: 'Conversas', description: 'Chat com clientes via WhatsApp' },
  { key: 'crm', label: 'CRM', description: 'Gestão de pipeline de vendas' },
  { key: 'contacts', label: 'Contatos', description: 'Cadastro de contatos' },
  { key: 'orders', label: 'Pedidos', description: 'Gestão de pedidos' },
  { key: 'quotes', label: 'Orçamentos', description: 'Criação de orçamentos' },
  { key: 'products', label: 'Produtos', description: 'Catálogo de produtos' },
  { key: 'financial', label: 'Financeiro', description: 'Controle financeiro' },
  { key: 'reports', label: 'Relatórios', description: 'Relatórios e análises' },
  { key: 'campaigns', label: 'Campanhas', description: 'Meta Ads analytics' },
  { key: 'gamification', label: 'Gamificação', description: 'Rankings e conquistas' },
  { key: 'automations', label: 'Automações', description: 'Fluxos automáticos' },
  { key: 'bulk_dispatch', label: 'Disparo em Massa', description: 'Envio de mensagens em massa' },
  { key: 'internal_chat', label: 'Chat Interno', description: 'Comunicação interna' },
  { key: 'internal_email', label: 'E-mail Interno', description: 'E-mail corporativo' },
  { key: 'live_monitor', label: 'Monitor ao Vivo', description: 'Monitoramento em tempo real' },
  { key: 'webhooks', label: 'Webhooks', description: 'Integrações via API' },
  { key: 'whatsapp_channels', label: 'Canais WhatsApp', description: 'Gestão de instâncias' },
];

export function TenantDetailsModal({ tenant, open, onOpenChange }: TenantDetailsModalProps) {
  const [name, setName] = useState('');
  const [planType, setPlanType] = useState('free');
  const [maxUsers, setMaxUsers] = useState(5);
  const [maxContacts, setMaxContacts] = useState(1000);
  const [isActive, setIsActive] = useState(true);
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('empresa');

  const updateTenant = useUpdateTenant();
  const updateModules = useUpdateTenantModules();
  const { data: modules, isLoading: modulesLoading } = useTenantModules(tenant?.id);
  const { data: admin, isLoading: adminLoading } = useTenantAdmin(tenant?.id);

  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      setPlanType(tenant.plan_type);
      setMaxUsers(tenant.max_users);
      setMaxContacts(tenant.max_contacts);
      setIsActive(tenant.is_active);
      setTrialEndsAt(tenant.trial_ends_at ? tenant.trial_ends_at.split('T')[0] : '');
    }
  }, [tenant]);

  useEffect(() => {
    if (modules) {
      const enabled = modules.filter(m => m.is_enabled).map(m => m.module_key);
      setSelectedModules(enabled);
    }
  }, [modules]);

  const handleSave = async () => {
    if (!tenant) return;

    try {
      await updateTenant.mutateAsync({
        tenantId: tenant.id,
        name,
        planType,
        maxUsers,
        maxContacts,
        isActive,
        trialEndsAt: trialEndsAt || null,
      });

      // Salvar módulos se mudaram
      const currentEnabled = modules?.filter(m => m.is_enabled).map(m => m.module_key) || [];
      const modulesChanged = JSON.stringify(currentEnabled.sort()) !== JSON.stringify(selectedModules.sort());
      
      if (modulesChanged) {
        await updateModules.mutateAsync({
          tenantId: tenant.id,
          modules: selectedModules,
        });
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error saving tenant:', error);
    }
  };

  const toggleModule = (moduleKey: string) => {
    setSelectedModules(prev =>
      prev.includes(moduleKey)
        ? prev.filter(m => m !== moduleKey)
        : [...prev, moduleKey]
    );
  };

  const selectAllModules = () => {
    setSelectedModules(AVAILABLE_MODULES.map(m => m.key));
  };

  const clearAllModules = () => {
    setSelectedModules([]);
  };

  const handleSendPasswordReset = async () => {
    if (!admin?.email) {
      toast.error('Email do administrador não encontrado');
      return;
    }
    toast.info('Funcionalidade de reset de senha será implementada em breve');
  };

  const isSaving = updateTenant.isPending || updateModules.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Editar Tenant: {tenant?.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="empresa" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Empresa
            </TabsTrigger>
            <TabsTrigger value="admin" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Administrador
            </TabsTrigger>
            <TabsTrigger value="modulos" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Módulos
              <Badge variant="secondary" className="ml-1 text-xs">
                {selectedModules.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Aba Empresa */}
          <TabsContent value="empresa" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Empresa</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Slug (URL)</Label>
                <Input value={tenant?.slug || ''} disabled className="bg-muted" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={planType} onValueChange={setPlanType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Limite de Usuários</Label>
                <Input
                  type="number"
                  value={maxUsers}
                  onChange={(e) => setMaxUsers(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Limite de Contatos</Label>
                <Input
                  type="number"
                  value={maxContacts}
                  onChange={(e) => setMaxContacts(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fim do Trial</Label>
              <Input
                type="date"
                value={trialEndsAt}
                onChange={(e) => setTrialEndsAt(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label>Status Ativo</Label>
                <p className="text-sm text-muted-foreground">
                  Tenant desativado não pode acessar o sistema
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            {tenant && (
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <h4 className="font-medium text-sm">Estatísticas Atuais</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Usuários:</span>
                    <span className="font-medium">
                      {tenant.user_count} / {maxUsers}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contatos:</span>
                    <span className="font-medium">
                      {tenant.contact_count.toLocaleString('pt-BR')} / {maxContacts.toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Aba Administrador */}
          <TabsContent value="admin" className="space-y-4 mt-4">
            {adminLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : admin ? (
              <>
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">{admin.full_name}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {admin.email}
                      </div>
                    </div>
                    <Badge variant="secondary" className="ml-auto">
                      <Shield className="h-3 w-3 mr-1" />
                      {admin.role}
                    </Badge>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="font-medium">Ações de Segurança</h4>
                  <Button 
                    variant="outline" 
                    onClick={handleSendPasswordReset}
                    className="w-full"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Enviar E-mail de Reset de Senha
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Um e-mail será enviado para {admin.email} com instruções para redefinir a senha.
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum administrador encontrado para este tenant.
              </div>
            )}
          </TabsContent>

          {/* Aba Módulos */}
          <TabsContent value="modulos" className="space-y-4 mt-4">
            {modulesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Selecione os módulos habilitados para este tenant
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllModules}>
                      Selecionar Todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearAllModules}>
                      Limpar
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
                  {AVAILABLE_MODULES.map((module) => (
                    <div
                      key={module.key}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedModules.includes(module.key)
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleModule(module.key)}
                    >
                      <Checkbox
                        checked={selectedModules.includes(module.key)}
                        onCheckedChange={() => toggleModule(module.key)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{module.label}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {module.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm">
                    <strong>{selectedModules.length}</strong> de {AVAILABLE_MODULES.length} módulos habilitados
                  </p>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
