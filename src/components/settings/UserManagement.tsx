import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions, useRoles, useUsers, usePendingInvites } from '@/hooks/usePermissions';
import { useDepartments } from '@/hooks/useDepartments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Shield, UserCog, ShoppingCart, Palette,
  Plus, Search, Edit3, Trash2, Mail, MoreVertical,
  Check, X, Clock, RefreshCw, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { PermissionGate, AccessDenied } from '@/components/PermissionGate';
import type { LucideIcon } from 'lucide-react';

// Role icons mapping
const roleIcons: Record<string, LucideIcon> = {
  admin: Shield,
  supervisor: UserCog,
  vendedor: ShoppingCart,
  designer: Palette,
};

// Role colors mapping
const roleColors: Record<string, { bg: string; text: string }> = {
  admin: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  supervisor: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  vendedor: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  designer: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
};

export function UserManagement() {
  const [search, setSearch] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [filterRole, setFilterRole] = useState<string>('');
  
  const { can, isAdmin } = usePermissions();
  const { data: roles } = useRoles();
  const { data: departments } = useDepartments();
  const { data: users, isLoading } = useUsers(search, filterRole);
  const { data: pendingInvites } = usePendingInvites();
  const queryClient = useQueryClient();

  // If user can't view users, show access denied
  if (!can.viewUsers() && !isAdmin) {
    return <AccessDenied />;
  }

  // Count users per role
  const userCounts = {
    admin: users?.filter(u => u.role === 'admin').length || 0,
    supervisor: users?.filter(u => u.role === 'supervisor').length || 0,
    vendedor: users?.filter(u => u.role === 'vendedor').length || 0,
    designer: users?.filter(u => u.role === 'designer').length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {roles?.map((role) => {
          const Icon = roleIcons[role.role_key] || Shield;
          const colors = roleColors[role.role_key] || { bg: 'bg-muted', text: 'text-muted-foreground' };
          const count = userCounts[role.role_key as keyof typeof userCounts] || 0;
          
          return (
            <button
              key={role.role_key}
              onClick={() => setFilterRole(filterRole === role.role_key ? '' : role.role_key)}
              className={`
                p-4 rounded-xl border-2 transition-all text-left
                ${filterRole === role.role_key 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border bg-card hover:border-primary/50'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center`}>
                  <Icon size={20} className={colors.text} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{count}</div>
                  <div className="text-sm text-muted-foreground">{role.role_name}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center gap-3">
          {filterRole && (
            <Button variant="outline" onClick={() => setFilterRole('')} className="gap-2">
              <X size={16} />
              Limpar filtro
            </Button>
          )}
          
          <PermissionGate permission="users.create">
            <Button 
              onClick={() => setShowInviteModal(true)}
              className="gap-2 btn-gradient text-white"
            >
              <Plus size={18} />
              Convidar Usuário
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Pending Invites */}
      {pendingInvites && pendingInvites.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
          <h3 className="font-semibold text-warning mb-3 flex items-center gap-2">
            <Clock size={18} />
            Convites Pendentes ({pendingInvites.length})
          </h3>
          <div className="space-y-2">
            {pendingInvites.map((invite) => {
              const colors = roleColors[invite.role] || { bg: 'bg-muted', text: 'text-muted-foreground' };
              return (
                <div 
                  key={invite.id}
                  className="flex items-center justify-between bg-card rounded-lg px-4 py-2 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <Mail size={16} className="text-muted-foreground" />
                    <span className="text-sm text-foreground">{invite.email}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
                      {invite.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-1.5 hover:bg-muted rounded" title="Reenviar">
                      <RefreshCw size={14} className="text-muted-foreground" />
                    </button>
                    <button className="p-1.5 hover:bg-destructive/10 rounded" title="Cancelar">
                      <X size={14} className="text-destructive" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Usuário</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Perfil</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">Departamento</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase hidden lg:table-cell">Status</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase hidden lg:table-cell">Último acesso</th>
                <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </td>
                </tr>
              ) : users?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              ) : (
                users?.map((user) => {
                  const Icon = roleIcons[user.role as string] || Shield;
                  const colors = roleColors[user.role as string] || { bg: 'bg-muted', text: 'text-muted-foreground' };
                  
                  return (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-semibold">
                              {user.full_name?.charAt(0) || '?'}
                            </div>
                            {user.is_online && (
                              <div className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-card"></div>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{user.full_name || 'Sem nome'}</div>
                            <div className="text-sm text-muted-foreground">{user.phone || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${colors.bg}`}>
                          <Icon size={14} className={colors.text} />
                          <span className={`text-sm font-medium ${colors.text}`}>
                            {roles?.find(r => r.role_key === user.role)?.role_name || user.role || 'Vendedor'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground hidden md:table-cell">
                        {user.department?.name || '-'}
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <span className={`
                          px-2.5 py-1 rounded-full text-xs font-medium
                          ${user.is_active !== false
                            ? 'bg-success/10 text-success' 
                            : 'bg-muted text-muted-foreground'
                          }
                        `}>
                          {user.is_active !== false ? '● Ativo' : '○ Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground hidden lg:table-cell">
                        {user.last_login_at 
                          ? new Date(user.last_login_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Nunca'
                        }
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <PermissionGate permission="users.update">
                            <button 
                              className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                              onClick={() => {
                                setSelectedUser(user);
                                setShowEditModal(true);
                              }}
                            >
                              <Edit3 size={16} className="text-primary" />
                            </button>
                          </PermissionGate>
                          <PermissionGate permission="users.delete">
                            {user.role !== 'admin' && (
                              <button className="p-2 hover:bg-destructive/10 rounded-lg transition-colors">
                                <Trash2 size={16} className="text-destructive" />
                              </button>
                            )}
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      <InviteUserModal 
        open={showInviteModal} 
        onClose={() => setShowInviteModal(false)}
        roles={roles || []}
        departments={departments || []}
      />

      {/* Edit Modal */}
      <EditUserModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        roles={roles || []}
        departments={departments || []}
      />
    </div>
  );
}

// Invite User Modal
function InviteUserModal({ open, onClose, roles, departments }: {
  open: boolean;
  onClose: () => void;
  roles: any[];
  departments: any[];
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('vendedor');
  const [departmentId, setDepartmentId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleInvite = async () => {
    if (!email) {
      toast.error('Digite o email do usuário');
      return;
    }

    setIsLoading(true);
    try {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase.from('user_invites').insert({
        email,
        role,
        department_id: departmentId || null,
        token,
        expires_at: expiresAt.toISOString(),
        invited_by: userData.user?.id,
      });

      if (error) throw error;

      toast.success(`Convite enviado para ${email}`);
      queryClient.invalidateQueries({ queryKey: ['pendingInvites'] });
      onClose();
      setEmail('');
      setRole('vendedor');
      setDepartmentId('');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erro ao enviar convite');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar Novo Usuário</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email *
            </label>
            <Input
              type="email"
              placeholder="usuario@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Perfil *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {roles.map((r) => {
                const Icon = roleIcons[r.role_key] || Shield;
                const colors = roleColors[r.role_key] || { bg: 'bg-muted', text: 'text-muted-foreground' };
                
                return (
                  <button
                    key={r.role_key}
                    type="button"
                    onClick={() => setRole(r.role_key)}
                    className={`
                      flex items-center gap-2 p-3 rounded-lg border-2 transition-all
                      ${role === r.role_key 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                      }
                    `}
                  >
                    <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center`}>
                      <Icon size={16} className={colors.text} />
                    </div>
                    <div className="text-left flex-1">
                      <div className="text-sm font-medium text-foreground">{r.role_name}</div>
                    </div>
                    {role === r.role_key && (
                      <Check size={16} className="text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Departamento
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-foreground"
            >
              <option value="">Selecione...</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          {/* Role description */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              {roles.find((r) => r.role_key === role)?.description}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            onClick={handleInvite}
            disabled={isLoading}
            className="btn-gradient text-white"
          >
            {isLoading ? 'Enviando...' : 'Enviar Convite'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Edit User Modal
function EditUserModal({ open, onClose, user, roles, departments }: {
  open: boolean;
  onClose: () => void;
  user: any;
  roles: any[];
  departments: any[];
}) {
  const [role, setRole] = useState(user?.role || 'vendedor');
  const [departmentId, setDepartmentId] = useState(user?.department_id || '');
  const [isActive, setIsActive] = useState(user?.is_active ?? true);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  // Update state when user changes
  useEffect(() => {
    if (user) {
      setRole(user.role || 'vendedor');
      setDepartmentId(user.department_id || '');
      setIsActive(user.is_active ?? true);
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role,
          department_id: departmentId || null,
          is_active: isActive,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Usuário atualizado!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erro ao atualizar usuário');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* User info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-semibold text-lg">
              {user.full_name?.charAt(0) || '?'}
            </div>
            <div>
              <div className="font-medium text-foreground">{user.full_name || 'Sem nome'}</div>
              <div className="text-sm text-muted-foreground">{user.phone || '-'}</div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Perfil
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-foreground"
            >
              {roles.map((r) => (
                <option key={r.role_key} value={r.role_key}>{r.role_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Departamento
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-foreground"
            >
              <option value="">Nenhum</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <div className="font-medium text-foreground">Status da conta</div>
              <div className="text-sm text-muted-foreground">
                {isActive ? 'Usuário pode acessar o sistema' : 'Usuário bloqueado'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`
                relative w-12 h-7 rounded-full transition-colors
                ${isActive ? 'bg-success' : 'bg-muted-foreground/30'}
              `}
            >
              <div className={`
                absolute top-1 w-5 h-5 rounded-full bg-card shadow transition-transform
                ${isActive ? 'translate-x-6' : 'translate-x-1'}
              `} />
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            onClick={handleSave}
            disabled={isLoading}
            className="btn-gradient text-white"
          >
            {isLoading ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
