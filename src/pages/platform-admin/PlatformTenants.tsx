import { useState } from 'react';
import { useSuperAdminTenants, useUpdateTenant, useDeleteTenant, TenantWithStats } from '@/hooks/useSuperAdminTenants';
import { TenantStatsCards } from '@/components/super-admin/TenantStatsCards';
import { TenantsTable } from '@/components/super-admin/TenantsTable';
import { TenantDetailsModal } from '@/components/super-admin/TenantDetailsModal';
import { CreateTenantModal } from '@/components/super-admin/CreateTenantModal';
import { DeleteTenantModal } from '@/components/super-admin/DeleteTenantModal';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Building2 } from 'lucide-react';

export default function PlatformTenants() {
  const { data: tenants = [], isLoading } = useSuperAdminTenants();
  const updateTenant = useUpdateTenant();
  const deleteTenant = useDeleteTenant();
  const [selectedTenant, setSelectedTenant] = useState<TenantWithStats | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<TenantWithStats | null>(null);

  const handleEdit = (tenant: TenantWithStats) => {
    setSelectedTenant(tenant);
    setModalOpen(true);
  };

  const handleToggleStatus = async (tenant: TenantWithStats) => {
    await updateTenant.mutateAsync({
      tenantId: tenant.id,
      isActive: !tenant.is_active,
    });
  };

  const handleDeleteClick = (tenant: TenantWithStats) => {
    setTenantToDelete(tenant);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async (tenantId: string) => {
    await deleteTenant.mutateAsync(tenantId);
    setDeleteModalOpen(false);
    setTenantToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Building2 className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Gestão de Tenants</h1>
            <p className="text-muted-foreground">
              Crie, edite e gerencie todos os tenants da plataforma
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Tenant
        </Button>
      </div>

      {/* Stats */}
      <TenantStatsCards tenants={tenants} />

      {/* Table */}
      <div className="bg-card rounded-lg border">
        <TenantsTable
          tenants={tenants}
          onEdit={handleEdit}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDeleteClick}
        />
      </div>

      {/* Modals */}
      <TenantDetailsModal
        tenant={selectedTenant}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />

      <CreateTenantModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />

      <DeleteTenantModal
        tenant={tenantToDelete}
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteTenant.isPending}
      />
    </div>
  );
}
