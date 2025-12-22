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
import { TenantWithStats, useUpdateTenant } from '@/hooks/useSuperAdminTenants';
import { Loader2 } from 'lucide-react';

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

  const updateTenant = useUpdateTenant();

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

  const handleSave = async () => {
    if (!tenant) return;

    await updateTenant.mutateAsync({
      tenantId: tenant.id,
      name,
      planType,
      maxUsers,
      maxContacts,
      isActive,
      trialEndsAt: trialEndsAt || null,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Tenant</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={tenant?.slug || ''} disabled className="bg-muted" />
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
              <Label>Max. Usuários</Label>
              <Input
                type="number"
                value={maxUsers}
                onChange={(e) => setMaxUsers(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Max. Contatos</Label>
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

          <div className="flex items-center justify-between">
            <Label>Status Ativo</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {tenant && (
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Usuários:</span>
                <span className="font-medium">{tenant.user_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contatos:</span>
                <span className="font-medium">{tenant.contact_count.toLocaleString('pt-BR')}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateTenant.isPending}>
            {updateTenant.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
