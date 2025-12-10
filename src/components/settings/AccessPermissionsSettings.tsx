import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Eye, Repeat, Building2, Users, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UserWithAccess {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  can_view_all_conversations: boolean;
  can_transfer_freely: boolean;
}

interface DepartmentWithAccess {
  id: string;
  name: string;
  color: string | null;
  can_view_all_conversations: boolean;
  can_transfer_freely: boolean;
}

export function AccessPermissionsSettings() {
  const queryClient = useQueryClient();

  // Fetch users with access permissions
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users-access-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, can_view_all_conversations, can_transfer_freely')
        .eq('is_active', true)
        .not('role', 'in', '("admin","supervisor")')
        .order('full_name');
      
      if (error) throw error;
      return (data || []) as UserWithAccess[];
    },
  });

  // Fetch departments with access permissions
  const { data: departments = [], isLoading: loadingDepartments } = useQuery({
    queryKey: ['departments-access-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, color, can_view_all_conversations, can_transfer_freely')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return (data || []) as DepartmentWithAccess[];
    },
  });

  // Update user permissions
  const updateUserPermission = useMutation({
    mutationFn: async ({ userId, field, value }: { userId: string; field: string; value: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ [field]: value })
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-access-permissions'] });
      toast.success('Permissão atualizada');
    },
    onError: () => {
      toast.error('Erro ao atualizar permissão');
    },
  });

  // Update department permissions
  const updateDepartmentPermission = useMutation({
    mutationFn: async ({ departmentId, field, value }: { departmentId: string; field: string; value: boolean }) => {
      const { error } = await supabase
        .from('departments')
        .update({ [field]: value })
        .eq('id', departmentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments-access-permissions'] });
      toast.success('Permissão atualizada');
    },
    onError: () => {
      toast.error('Erro ao atualizar permissão');
    },
  });

  const handleUserToggle = (userId: string, field: 'can_view_all_conversations' | 'can_transfer_freely', value: boolean) => {
    updateUserPermission.mutate({ userId, field, value });
  };

  const handleDepartmentToggle = (departmentId: string, field: 'can_view_all_conversations' | 'can_transfer_freely', value: boolean) => {
    updateDepartmentPermission.mutate({ departmentId, field, value });
  };

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const roleLabels: Record<string, string> = {
    vendedor: 'Vendedor',
    agent: 'Agente',
    user: 'Usuário',
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Administradores</strong> e <strong>Supervisores</strong> já possuem acesso total por padrão. 
          Use estas configurações para conceder acesso especial a outros usuários ou departamentos.
        </AlertDescription>
      </Alert>

      {/* Configuração por Usuário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Por Usuário
          </CardTitle>
          <CardDescription>
            Conceda permissões especiais para usuários individuais
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum usuário disponível (exceto admin/supervisor)
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr,auto,auto] gap-4 text-xs font-medium text-muted-foreground pb-2 border-b">
                <div>Usuário</div>
                <div className="flex items-center gap-1 justify-center w-32">
                  <Eye className="h-3 w-3" />
                  Ver Todas
                </div>
                <div className="flex items-center gap-1 justify-center w-32">
                  <Repeat className="h-3 w-3" />
                  Transferir
                </div>
              </div>
              {users.map(user => (
                <div key={user.id} className="grid grid-cols-[1fr,auto,auto] gap-4 items-center py-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user.full_name || 'Sem nome'}</p>
                      <Badge variant="secondary" className="text-xs">
                        {roleLabels[user.role || ''] || user.role}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-center w-32">
                    <Switch
                      checked={user.can_view_all_conversations || false}
                      onCheckedChange={(checked) => handleUserToggle(user.id, 'can_view_all_conversations', checked)}
                      disabled={updateUserPermission.isPending}
                    />
                  </div>
                  <div className="flex justify-center w-32">
                    <Switch
                      checked={user.can_transfer_freely || false}
                      onCheckedChange={(checked) => handleUserToggle(user.id, 'can_transfer_freely', checked)}
                      disabled={updateUserPermission.isPending}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuração por Departamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Por Departamento
          </CardTitle>
          <CardDescription>
            Conceda permissões especiais para todos os membros de um departamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDepartments ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : departments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum departamento cadastrado
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr,auto,auto] gap-4 text-xs font-medium text-muted-foreground pb-2 border-b">
                <div>Departamento</div>
                <div className="flex items-center gap-1 justify-center w-32">
                  <Eye className="h-3 w-3" />
                  Ver Todas
                </div>
                <div className="flex items-center gap-1 justify-center w-32">
                  <Repeat className="h-3 w-3" />
                  Transferir
                </div>
              </div>
              {departments.map(dept => (
                <div key={dept.id} className="grid grid-cols-[1fr,auto,auto] gap-4 items-center py-2">
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-9 w-9 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: dept.color || '#8B5CF6' }}
                    >
                      <Building2 className="h-4 w-4 text-white" />
                    </div>
                    <p className="text-sm font-medium">{dept.name}</p>
                  </div>
                  <div className="flex justify-center w-32">
                    <Switch
                      checked={dept.can_view_all_conversations || false}
                      onCheckedChange={(checked) => handleDepartmentToggle(dept.id, 'can_view_all_conversations', checked)}
                      disabled={updateDepartmentPermission.isPending}
                    />
                  </div>
                  <div className="flex justify-center w-32">
                    <Switch
                      checked={dept.can_transfer_freely || false}
                      onCheckedChange={(checked) => handleDepartmentToggle(dept.id, 'can_transfer_freely', checked)}
                      disabled={updateDepartmentPermission.isPending}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legenda */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Eye className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Ver Todas as Conversas</p>
                <p className="text-xs text-muted-foreground">
                  Permite visualizar conversas de outros atendentes, mesmo sem estar atribuído
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Repeat className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Transferir Livremente</p>
                <p className="text-xs text-muted-foreground">
                  Permite transferir conversas sem precisar solicitar autorização do responsável
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}