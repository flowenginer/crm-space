import { useState } from 'react';
import { useSuperAdminTenants, useUpdateTenant, useDeleteTenant, TenantWithStats } from '@/hooks/useSuperAdminTenants';
import { TenantStatsCards } from '@/components/super-admin/TenantStatsCards';
import { TenantsTable } from '@/components/super-admin/TenantsTable';
import { TenantDetailsModal } from '@/components/super-admin/TenantDetailsModal';
import { AdminManagementSection } from '@/components/super-admin/AdminManagementSection';
import { CreateTenantModal } from '@/components/super-admin/CreateTenantModal';
import { DeleteTenantModal } from '@/components/super-admin/DeleteTenantModal';
import { TenantDiagnosticsPanel } from '@/components/super-admin/TenantDiagnosticsPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Crown, Building, Shield, Loader2, Plus, Stethoscope } from 'lucide-react';

export default function SuperAdminPanel() {
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
          <TabsTrigger value="diagnostics" className="gap-2">
            <Stethoscope className="h-4 w-4" />
            Diagnóstico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tenants">
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Tenants</h2>
            <TenantsTable
              tenants={tenants}
              onEdit={handleEdit}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDeleteClick}
            />
          </div>
        </TabsContent>

        <TabsContent value="admins">
          <AdminManagementSection />
        </TabsContent>

        <TabsContent value="diagnostics">
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Diagnóstico de Isolamento de Tenant</h2>
            <p className="text-muted-foreground mb-6">
              Identifique usuários com problemas de configuração de tenant e verifique o isolamento de dados.
            </p>
            <TenantDiagnosticsPanel />
          </div>
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
