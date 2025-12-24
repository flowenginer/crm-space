import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  RefreshCw, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Crown,
  Zap,
  ArrowRight
} from 'lucide-react';
import {
  usePlatformSyncConfig,
  useTenantsSyncStatus,
  useSyncAllTenants,
  useSyncSelectedTenants,
  TenantSyncStatus
} from '@/hooks/useTenantSync';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function SyncStatusBadge({ percentage, missing }: { percentage: number; missing: number }) {
  if (percentage >= 100) {
    return (
      <Badge variant="outline" className="bg-success/10 text-success border-success/30">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Sincronizado
      </Badge>
    );
  }
  
  if (percentage >= 80) {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
        <AlertCircle className="h-3 w-3 mr-1" />
        {missing} faltando
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
      <AlertCircle className="h-3 w-3 mr-1" />
      {missing} faltando
    </Badge>
  );
}

function TenantRow({ 
  tenant, 
  isSelected, 
  onToggle,
  onSyncSingle,
  isSyncing
}: { 
  tenant: TenantSyncStatus;
  isSelected: boolean;
  onToggle: () => void;
  onSyncSingle: () => void;
  isSyncing: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
      tenant.is_base 
        ? 'bg-primary/5 border-primary/30' 
        : isSelected 
          ? 'bg-muted/50 border-primary/30' 
          : 'bg-background border-border hover:bg-muted/30'
    }`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {!tenant.is_base && (
          <Checkbox 
            checked={isSelected}
            onCheckedChange={onToggle}
            disabled={isSyncing}
          />
        )}
        
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-md ${tenant.is_base ? 'bg-primary/10' : 'bg-muted'}`}>
            {tenant.is_base ? (
              <Crown className="h-4 w-4 text-primary" />
            ) : (
              <Building2 className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{tenant.tenant_name}</span>
              {tenant.is_base && (
                <Badge variant="secondary" className="text-xs">BASE</Badge>
              )}
              {!tenant.is_active && (
                <Badge variant="outline" className="text-xs">Inativo</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{tenant.total_menus} menus</span>
              {!tenant.is_base && (
                <>
                  <span>•</span>
                  <span>{tenant.sync_percentage.toFixed(0)}% sincronizado</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3 shrink-0">
        {!tenant.is_base && (
          <>
            <div className="hidden sm:flex items-center gap-2 w-32">
              <Progress value={tenant.sync_percentage} className="h-2" />
            </div>
            <SyncStatusBadge 
              percentage={tenant.sync_percentage} 
              missing={tenant.missing_menus} 
            />
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncSingle}
              disabled={isSyncing || tenant.sync_percentage >= 100}
              className="hidden sm:flex"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="ml-1">Sync</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function TenantSyncPanel() {
  const [selectedTenants, setSelectedTenants] = useState<Set<string>>(new Set());
  
  const { data: config, isLoading: configLoading } = usePlatformSyncConfig();
  const { data: tenants = [], isLoading: tenantsLoading, refetch } = useTenantsSyncStatus(config?.base_tenant_id);
  
  const syncAll = useSyncAllTenants();
  const syncSelected = useSyncSelectedTenants();
  
  const isSyncing = syncAll.isPending || syncSelected.isPending;
  
  const nonBaseTenants = useMemo(() => 
    tenants.filter(t => !t.is_base), 
    [tenants]
  );
  
  const tenantsNeedingSync = useMemo(() => 
    nonBaseTenants.filter(t => t.sync_percentage < 100),
    [nonBaseTenants]
  );
  
  const totalMissing = useMemo(() => 
    tenantsNeedingSync.reduce((acc, t) => acc + t.missing_menus, 0),
    [tenantsNeedingSync]
  );
  
  const handleToggleTenant = (tenantId: string) => {
    setSelectedTenants(prev => {
      const next = new Set(prev);
      if (next.has(tenantId)) {
        next.delete(tenantId);
      } else {
        next.add(tenantId);
      }
      return next;
    });
  };
  
  const handleSelectAll = () => {
    if (selectedTenants.size === nonBaseTenants.length) {
      setSelectedTenants(new Set());
    } else {
      setSelectedTenants(new Set(nonBaseTenants.map(t => t.tenant_id)));
    }
  };
  
  const handleSyncAll = () => {
    if (config?.base_tenant_id) {
      syncAll.mutate(config.base_tenant_id, {
        onSuccess: () => {
          refetch();
          setSelectedTenants(new Set());
        }
      });
    }
  };
  
  const handleSyncSelected = () => {
    if (config?.base_tenant_id && selectedTenants.size > 0) {
      syncSelected.mutate({
        sourceTenantId: config.base_tenant_id,
        targetTenantIds: Array.from(selectedTenants)
      }, {
        onSuccess: () => {
          refetch();
          setSelectedTenants(new Set());
        }
      });
    }
  };
  
  const handleSyncSingle = (tenantId: string) => {
    if (config?.base_tenant_id) {
      syncSelected.mutate({
        sourceTenantId: config.base_tenant_id,
        targetTenantIds: [tenantId]
      }, {
        onSuccess: () => refetch()
      });
    }
  };
  
  if (configLoading || tenantsLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16" />
          ))}
        </CardContent>
      </Card>
    );
  }
  
  if (!config) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum tenant base encontrado
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Sincronização de Menus
            </CardTitle>
            <CardDescription className="mt-1">
              Propague as configurações de menu do tenant base para todos os outros tenants
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isSyncing}
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        {/* Summary */}
        <div className="flex flex-wrap gap-4 pt-4 mt-2 border-t">
          <div className="flex items-center gap-2 text-sm">
            <Crown className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Base:</span>
            <span className="font-medium">{config.base_tenant_name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Tenants:</span>
            <span className="font-medium">{config.total_tenants}</span>
          </div>
          {tenantsNeedingSync.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="text-muted-foreground">Pendentes:</span>
              <span className="font-medium text-amber-600">
                {tenantsNeedingSync.length} tenants ({totalMissing} itens)
              </span>
            </div>
          )}
          {tenantsNeedingSync.length === 0 && nonBaseTenants.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-success font-medium">
                Todos sincronizados
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Actions bar */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedTenants.size === nonBaseTenants.length && nonBaseTenants.length > 0}
              onCheckedChange={handleSelectAll}
              disabled={isSyncing}
            />
            <span className="text-sm text-muted-foreground">
              {selectedTenants.size > 0 
                ? `${selectedTenants.size} selecionado(s)` 
                : 'Selecionar todos'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {selectedTenants.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncSelected}
                disabled={isSyncing}
              >
                <Zap className="h-4 w-4 mr-1" />
                Sincronizar Selecionados
              </Button>
            )}
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  disabled={isSyncing || tenantsNeedingSync.length === 0}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                  Sincronizar Todos
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sincronizar Todos os Tenants?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá copiar todos os itens de menu do tenant base ({config.base_tenant_name}) 
                    para {tenantsNeedingSync.length} tenant(s) que não estão sincronizados.
                    <br /><br />
                    <strong>Total de itens a serem copiados:</strong> até {totalMissing} itens
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSyncAll}>
                    Confirmar Sincronização
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        
        {/* Tenants list */}
        <div className="space-y-2">
          {tenants.map(tenant => (
            <TenantRow
              key={tenant.tenant_id}
              tenant={tenant}
              isSelected={selectedTenants.has(tenant.tenant_id)}
              onToggle={() => handleToggleTenant(tenant.tenant_id)}
              onSyncSingle={() => handleSyncSingle(tenant.tenant_id)}
              isSyncing={isSyncing}
            />
          ))}
        </div>
        
        {/* Auto-sync notice */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
          <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-primary">Auto-sync ativado</p>
            <p className="text-muted-foreground">
              Novos tenants criados receberão automaticamente todos os menus e módulos do tenant base.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
