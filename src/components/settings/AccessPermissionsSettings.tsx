import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Eye, Repeat, Building2, Users, Info, ChevronDown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

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
  const [usersOpen, setUsersOpen] = useState(true);
  const [deptsOpen, setDeptsOpen] = useState(true);

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
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Administradores</strong> e <strong>Supervisores</strong> já possuem acesso total por padrão. 
          Use estas configurações para conceder acesso especial a outros usuários ou departamentos.
        </AlertDescription>
      </Alert>

      {/* Configuração por Usuário - Colapsável */}
      <Card>
        <Collapsible open={usersOpen} onOpenChange={setUsersOpen}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-semibold">Por Usuário</span>
                <Badge variant="secondary" className="text-xs">{users.length}</Badge>
              </div>
              <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", usersOpen && "rotate-180")} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {loadingUsers ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-24 w-full rounded-lg" />
                  ))}
                </div>
              ) : users.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum usuário disponível (exceto admin/supervisor)
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {users.map(user => (
                    <div 
                      key={user.id} 
                      className="p-3 rounded-lg border bg-card hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getInitials(user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{user.full_name || 'Sem nome'}</p>
                          <p className="text-xs text-muted-foreground">
                            {roleLabels[user.role || ''] || user.role}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Switch
                            className="scale-75"
                            checked={user.can_view_all_conversations || false}
                            onCheckedChange={(checked) => handleUserToggle(user.id, 'can_view_all_conversations', checked)}
                            disabled={updateUserPermission.isPending}
                          />
                          <Eye className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Ver</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Switch
                            className="scale-75"
                            checked={user.can_transfer_freely || false}
                            onCheckedChange={(checked) => handleUserToggle(user.id, 'can_transfer_freely', checked)}
                            disabled={updateUserPermission.isPending}
                          />
                          <Repeat className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Transf.</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Configuração por Departamento - Colapsável */}
      <Card>
        <Collapsible open={deptsOpen} onOpenChange={setDeptsOpen}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <span className="font-semibold">Por Departamento</span>
                <Badge variant="secondary" className="text-xs">{departments.length}</Badge>
              </div>
              <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", deptsOpen && "rotate-180")} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {loadingDepartments ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {[1, 2].map(i => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
              ) : departments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum departamento cadastrado
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {departments.map(dept => (
                    <div 
                      key={dept.id} 
                      className="p-3 rounded-lg border bg-card hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div 
                          className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: dept.color || '#8B5CF6' }}
                        >
                          <Building2 className="h-4 w-4 text-white" />
                        </div>
                        <p className="text-sm font-medium truncate">{dept.name}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Switch
                            className="scale-75"
                            checked={dept.can_view_all_conversations || false}
                            onCheckedChange={(checked) => handleDepartmentToggle(dept.id, 'can_view_all_conversations', checked)}
                            disabled={updateDepartmentPermission.isPending}
                          />
                          <Eye className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Ver</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Switch
                            className="scale-75"
                            checked={dept.can_transfer_freely || false}
                            onCheckedChange={(checked) => handleDepartmentToggle(dept.id, 'can_transfer_freely', checked)}
                            disabled={updateDepartmentPermission.isPending}
                          />
                          <Repeat className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Transf.</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Legenda Compacta */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" />
          <span><strong>Ver:</strong> Visualizar todas as conversas</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Repeat className="h-3.5 w-3.5" />
          <span><strong>Transf.:</strong> Transferir sem autorização</span>
        </div>
      </div>
    </div>
  );
}
