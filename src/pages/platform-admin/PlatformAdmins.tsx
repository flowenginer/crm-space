import { AdminManagementSection } from '@/components/super-admin/AdminManagementSection';
import { Shield } from 'lucide-react';

export default function PlatformAdmins() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10">
          <Shield className="h-6 w-6 text-amber-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Super Administradores</h1>
          <p className="text-muted-foreground">
            Gerencie os administradores com acesso total à plataforma
          </p>
        </div>
      </div>

      {/* Admin Management */}
      <AdminManagementSection />
    </div>
  );
}
