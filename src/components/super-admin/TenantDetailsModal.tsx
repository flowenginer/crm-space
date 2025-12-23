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
import { Badge } from '@/components/ui/badge';
import {
  TenantWithStats,
  useUpdateTenant,
  useTenantModules,
  useUpdateTenantModules,
  useTenantAdmin,
} from '@/hooks/useSuperAdminTenants';
import { Loader2, Building2, User, Settings, Mail, Shield, Key, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { TenantModulesTree } from './TenantModulesTree';
import { normalizeModuleKey } from '@/lib/moduleKeys';

interface TenantDetailsModalProps {
  tenant: TenantWithStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TenantDetailsModal({ tenant, open, onOpenChange }: TenantDetailsModalProps) {
  const [name, setName] = useState('');
  const [planType, setPlanType] = useState('free');
  const [maxUsers, setMaxUsers] = useState(5);
  const [maxContacts, setMaxContacts] = useState(1000);
  const [isActive, setIsActive] = useState(true);
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('empresa');
  
  // Password reset state
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

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
      // Normaliza as chaves do banco para o formato atual (hífens -> underscores)
      const enabled = modules
        .filter(m => m.is_enabled)
        .map(m => normalizeModuleKey(m.module_key));
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

      // Salvar módulos se mudaram (comparar com chaves normalizadas)
      const currentEnabled = modules?.filter(m => m.is_enabled).map(m => normalizeModuleKey(m.module_key)) || [];
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

  const handleResetPassword = async () => {
    if (!admin?.id) {
      toast.error('ID do administrador não encontrado');
      return;
    }
    
    if (!newPassword || newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: { user_id: admin.id, new_password: newPassword }
      });

      if (error) throw error;

      toast.success('Senha redefinida com sucesso!');
      setNewPassword('');
      setShowPassword(false);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.message || 'Erro ao redefinir senha');
    } finally {
      setIsResettingPassword(false);
    }
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
                  <h4 className="font-medium flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Redefinir Senha
                  </h4>
                  <div className="space-y-2">
                    <Label>Nova Senha</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Digite a nova senha"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                      <Button 
                        onClick={handleResetPassword}
                        disabled={isResettingPassword || !newPassword}
                      >
                        {isResettingPassword ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Redefinir'
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A senha será atualizada imediatamente. Mínimo de 6 caracteres.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum administrador encontrado para este tenant.
              </div>
            )}
          </TabsContent>

          {/* Aba Módulos - Agora usando TenantModulesTree */}
          <TabsContent value="modulos" className="space-y-4 mt-4">
            {modulesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <TenantModulesTree
                modules={selectedModules}
                onChange={setSelectedModules}
              />
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