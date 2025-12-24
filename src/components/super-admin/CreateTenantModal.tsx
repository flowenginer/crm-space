import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateTenant } from '@/hooks/useCreateTenant';
import { Loader2, Building, User, Settings, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TenantModulesTree } from './TenantModulesTree';
import { useBaseMenuHierarchy } from '@/hooks/useBaseMenuConfig';
import { toast } from 'sonner';

interface CreateTenantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper para extrair todas as chaves de módulo da hierarquia
// Agora usa item.module_key diretamente do banco
function getAllModuleKeysFromHierarchy(items: any[]): string[] {
  const keys: string[] = [];
  items.forEach(item => {
    // Usar module_key diretamente do banco
    if (item.module_key) {
      keys.push(item.module_key);
    }
    if (item.children) {
      keys.push(...getAllModuleKeysFromHierarchy(item.children));
    }
  });
  return [...new Set(keys)];
}

export function CreateTenantModal({ open, onOpenChange }: CreateTenantModalProps) {
  const createTenant = useCreateTenant();
  const { data: menuHierarchy = [] } = useBaseMenuHierarchy();
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('tenant');
  
  // Form state
  const [tenantName, setTenantName] = useState('');
  const [slug, setSlug] = useState('');
  const [planType, setPlanType] = useState<'free' | 'pro' | 'enterprise'>('pro');
  const [maxUsers, setMaxUsers] = useState(10);
  const [maxContacts, setMaxContacts] = useState(5000);
  const [trialDays, setTrialDays] = useState<number | undefined>(undefined);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [enabledModules, setEnabledModules] = useState<string[]>([]);

  // Inicializa os módulos quando a hierarquia carrega
  useEffect(() => {
    if (menuHierarchy.length > 0 && enabledModules.length === 0) {
      const allKeys = getAllModuleKeysFromHierarchy(menuHierarchy);
      setEnabledModules(allKeys);
    }
  }, [menuHierarchy, enabledModules.length]);

  // Auto-generate slug from tenant name
  const generatedSlug = useMemo(() => {
    return tenantName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }, [tenantName]);

  const handleTenantNameChange = (value: string) => {
    setTenantName(value);
    if (!slug || slug === generatedSlug) {
      setSlug(value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''));
    }
  };

  // Validações por aba
  const tenantTabValid = tenantName.trim() && slug.trim();
  const adminTabValid = adminName.trim() && adminEmail.trim() && adminPassword.length >= 6;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailValid = emailRegex.test(adminEmail.trim().toLowerCase());

  const handleSubmit = async () => {
    const trimmedEmail = adminEmail.trim().toLowerCase();
    const trimmedName = adminName.trim();
    const trimmedTenantName = tenantName.trim();
    const trimmedSlug = slug.trim().toLowerCase();
    
    // Validações com feedback
    if (!trimmedTenantName) {
      toast.error('Preencha o nome da empresa');
      setActiveTab('tenant');
      return;
    }
    if (!trimmedSlug) {
      toast.error('Preencha o slug');
      setActiveTab('tenant');
      return;
    }
    if (!trimmedName) {
      toast.error('Preencha o nome do administrador');
      setActiveTab('admin');
      return;
    }
    if (!trimmedEmail) {
      toast.error('Preencha o email do administrador');
      setActiveTab('admin');
      return;
    }
    if (!emailRegex.test(trimmedEmail)) {
      toast.error('Email inválido');
      setActiveTab('admin');
      return;
    }
    if (!adminPassword || adminPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      setActiveTab('admin');
      return;
    }

    try {
      await createTenant.mutateAsync({
        tenantName: trimmedTenantName,
        slug: trimmedSlug,
        planType,
        maxUsers,
        maxContacts,
        trialDays,
        adminEmail: trimmedEmail,
        adminName: trimmedName,
        adminPassword,
        enabledModules
      });

      // Reset form
      setTenantName('');
      setSlug('');
      setPlanType('pro');
      setMaxUsers(10);
      setMaxContacts(5000);
      setTrialDays(undefined);
      setAdminEmail('');
      setAdminName('');
      setAdminPassword('');
      const allKeys = getAllModuleKeysFromHierarchy(menuHierarchy);
      setEnabledModules(allKeys);
      setActiveTab('tenant');
      
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao criar tenant');
    }
  };

  const isValid = tenantTabValid && adminTabValid && emailValid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Criar Novo Tenant
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tenant" className="gap-2 relative">
              <Building className="h-4 w-4" />
              Empresa
              {!tenantTabValid && (
                <AlertCircle className="h-3 w-3 text-destructive absolute -top-1 -right-1" />
              )}
            </TabsTrigger>
            <TabsTrigger value="admin" className="gap-2 relative">
              <User className="h-4 w-4" />
              Administrador
              {(!adminTabValid || !emailValid) && (
                <AlertCircle className="h-3 w-3 text-destructive absolute -top-1 -right-1" />
              )}
            </TabsTrigger>
            <TabsTrigger value="modules" className="gap-2">
              <Settings className="h-4 w-4" />
              Módulos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tenant" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tenantName">Nome da Empresa *</Label>
                <Input
                  id="tenantName"
                  value={tenantName}
                  onChange={(e) => handleTenantNameChange(e.target.value)}
                  placeholder="Ex: Minha Empresa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL) *</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="minha-empresa"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="planType">Plano</Label>
                <Select value={planType} onValueChange={(v) => setPlanType(v as typeof planType)}>
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
              <div className="space-y-2">
                <Label htmlFor="maxUsers">Limite de Usuários</Label>
                <Input
                  id="maxUsers"
                  type="number"
                  value={maxUsers}
                  onChange={(e) => setMaxUsers(parseInt(e.target.value) || 0)}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxContacts">Limite de Contatos</Label>
                <Input
                  id="maxContacts"
                  type="number"
                  value={maxContacts}
                  onChange={(e) => setMaxContacts(parseInt(e.target.value) || 0)}
                  min={100}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trialDays">Dias de Trial (opcional)</Label>
              <Input
                id="trialDays"
                type="number"
                value={trialDays || ''}
                onChange={(e) => setTrialDays(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Ex: 14"
                min={1}
              />
            </div>
          </TabsContent>

          <TabsContent value="admin" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Estes serão os dados de acesso do administrador principal do tenant.
            </p>

            <div className="space-y-2">
              <Label htmlFor="adminName">Nome do Administrador *</Label>
              <Input
                id="adminName"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminEmail">Email *</Label>
              <Input
                id="adminEmail"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@empresa.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminPassword">Senha Inicial * (mín. 6 caracteres)</Label>
              <div className="relative">
                <Input
                  id="adminPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="modules" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Selecione quais módulos estarão disponíveis para este tenant.
            </p>
            
            <TenantModulesTree
              modules={enabledModules}
              onChange={setEnabledModules}
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isValid || createTenant.isPending}
          >
            {createTenant.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              'Criar Tenant'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
