import { useState } from 'react';
import { useSuperAdminTenants, useUpdateTenant, TenantWithStats } from '@/hooks/useSuperAdminTenants';
import { TenantStatsCards } from '@/components/super-admin/TenantStatsCards';
import { TenantsTable } from '@/components/super-admin/TenantsTable';
import { TenantDetailsModal } from '@/components/super-admin/TenantDetailsModal';
import { AdminManagementSection } from '@/components/super-admin/AdminManagementSection';
import { CreateTenantModal } from '@/components/super-admin/CreateTenantModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Crown, Building, Shield, Loader2, Plus } from 'lucide-react';

export default function SuperAdminPanel() {
  const { data: tenants = [], isLoading } = useSuperAdminTenants();
  const updateTenant = useUpdateTenant();
  const [selectedTenant, setSelectedTenant] = useState<TenantWithStats | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-yellow-500/10">
            <Crown className="h-6 w-6 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Super Admin Panel</h1>
            <p className="text-muted-foreground">Gerencie todos os tenants e administradores da plataforma</p>
          </div>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Criar Novo Tenant
        </Button>
      </div>

      <TenantStatsCards tenants={tenants} />

      <Tabs defaultValue="tenants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tenants" className="gap-2">
            <Building className="h-4 w-4" />
            Tenants
          </TabsTrigger>
          <TabsTrigger value="admins" className="gap-2">
            <Shield className="h-4 w-4" />
            Administradores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tenants">
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Tenants</h2>
            <TenantsTable
              tenants={tenants}
              onEdit={handleEdit}
              onToggleStatus={handleToggleStatus}
            />
          </div>
        </TabsContent>

        <TabsContent value="admins">
          <AdminManagementSection />
        </TabsContent>
      </Tabs>

      <TenantDetailsModal
        tenant={selectedTenant}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />

      <CreateTenantModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />
    </div>
  );
}
