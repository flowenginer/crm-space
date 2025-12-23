import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TenantWithStats } from '@/hooks/useSuperAdminTenants';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteTenantModalProps {
  tenant: TenantWithStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (tenantId: string) => void;
  isDeleting: boolean;
}

export function DeleteTenantModal({
  tenant,
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: DeleteTenantModalProps) {
  const [confirmSlug, setConfirmSlug] = useState('');

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmSlug('');
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = () => {
    if (tenant && confirmSlug === tenant.slug) {
      onConfirm(tenant.id);
    }
  };

  if (!tenant) return null;

  const isValid = confirmSlug === tenant.slug;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Excluir Tenant
          </DialogTitle>
          <DialogDescription>
            Esta ação é irreversível e irá deletar permanentemente todos os dados do tenant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-2">
            <p className="text-sm font-medium">Serão excluídos:</p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>{tenant.user_count} usuário(s)</li>
              <li>{tenant.contact_count.toLocaleString('pt-BR')} contato(s)</li>
              <li>Todas as conversas e mensagens</li>
              <li>Configurações, canais e integrações</li>
              <li>Pedidos, orçamentos e dados financeiros</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-slug">
              Digite <span className="font-mono font-bold text-foreground">{tenant.slug}</span> para confirmar:
            </Label>
            <Input
              id="confirm-slug"
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              placeholder={tenant.slug}
              disabled={isDeleting}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              'Excluir Permanentemente'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
