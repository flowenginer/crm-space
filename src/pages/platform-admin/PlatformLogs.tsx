import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollText, Search, RefreshCw, User, Calendar, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSuperAdminTenants } from '@/hooks/useSuperAdminTenants';

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  description: string | null;
  user_id: string | null;
  tenant_id: string;
  created_at: string;
  old_values: any;
  new_values: any;
}

export default function PlatformLogs() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<string>('all');

  const { data: tenants = [] } = useSuperAdminTenants();

  const { data: logs = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['platform-activity-logs', selectedTenantId, selectedAction],
    queryFn: async () => {
      let query = supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (selectedTenantId && selectedTenantId !== 'all') {
        query = query.eq('tenant_id', selectedTenantId);
      }

      if (selectedAction && selectedAction !== 'all') {
        query = query.eq('action', selectedAction);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ActivityLog[];
    },
  });

  const actionColors: Record<string, string> = {
    create: 'bg-success/10 text-success border-success/20',
    update: 'bg-info/10 text-info border-info/20',
    delete: 'bg-destructive/10 text-destructive border-destructive/20',
    login: 'bg-primary/10 text-primary border-primary/20',
    logout: 'bg-muted text-muted-foreground border-muted',
  };

  const getActionColor = (action: string) => {
    const lowerAction = action.toLowerCase();
    for (const [key, color] of Object.entries(actionColors)) {
      if (lowerAction.includes(key)) return color;
    }
    return 'bg-muted text-muted-foreground border-muted';
  };

  const getTenantName = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    return tenant?.name || tenantId.substring(0, 8);
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(search) ||
      log.entity_type.toLowerCase().includes(search) ||
      log.description?.toLowerCase().includes(search) ||
      log.entity_id.toLowerCase().includes(search)
    );
  });

  const uniqueActions = [...new Set(logs.map(l => l.action))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <ScrollText className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Logs & Auditoria</h1>
            <p className="text-muted-foreground">
              Histórico de ações realizadas na plataforma
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar nos logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos os tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tenants</SelectItem>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Todas as ações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                {uniqueActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Registros de Atividade
            <Badge variant="secondary" className="ml-2">
              {filteredLogs.length} registros
            </Badge>
          </CardTitle>
          <CardDescription>
            Últimas 100 ações registradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ScrollText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum log encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={getActionColor(log.action)}
                        >
                          {log.action}
                        </Badge>
                        <Badge variant="secondary">
                          {log.entity_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {getTenantName(log.tenant_id)}
                        </span>
                      </div>
                      {log.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {log.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                        {log.user_id && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {log.user_id.substring(0, 8)}...
                          </span>
                        )}
                        <span className="font-mono text-xs opacity-50">
                          {log.entity_id.substring(0, 8)}...
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
