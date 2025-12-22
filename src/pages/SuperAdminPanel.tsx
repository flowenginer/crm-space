import { useState } from 'react';
import { useSuperAdminTenants, useUpdateTenant, TenantWithStats } from '@/hooks/useSuperAdminTenants';
import { TenantStatsCards } from '@/components/super-admin/TenantStatsCards';
import { TenantsTable } from '@/components/super-admin/TenantsTable';
import { TenantDetailsModal } from '@/components/super-admin/TenantDetailsModal';
import { Crown, Loader2 } from 'lucide-react';

export default function SuperAdminPanel() {
  const { data: tenants = [], isLoading } = useSuperAdminTenants();
  const updateTenant = useUpdateTenant();
  const [selectedTenant, setSelectedTenant] = useState<TenantWithStats | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-yellow-500/10">
          <Crown className="h-6 w-6 text-yellow-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Super Admin Panel</h1>
          <p className="text-muted-foreground">Gerencie todos os tenants da plataforma</p>
        </div>
      </div>

      <TenantStatsCards tenants={tenants} />

      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Tenants</h2>
        <TenantsTable
          tenants={tenants}
          onEdit={handleEdit}
          onToggleStatus={handleToggleStatus}
        />
      </div>

      <TenantDetailsModal
        tenant={selectedTenant}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
}
