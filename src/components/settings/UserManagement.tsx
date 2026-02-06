import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDepartments } from '@/hooks/useDepartments';
import { useRoles, type RoleDefinition } from '@/hooks/useRoles';
import { useUserDepartments, useAddUserToDepartment, useRemoveUserFromDepartment, useSetPrimaryDepartment } from '@/hooks/useUserDepartments';
import { useChannels } from '@/hooks/useChannels';
import { useUserChannelsConfig, useSyncUserChannels } from '@/hooks/useUserChannelsConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { PermissionPreview } from './PermissionPreview';
import {
  Shield,
  UserCog,
  ShoppingCart,
  Palette,
  Plus,
  Search,
  Edit3,
  Trash2,
  Mail,
  RefreshCw,
  X,
  Check,
  Clock,
  ChevronDown,
  ChevronUp,
  Lock,
  Eye,
  EyeOff,
  Phone,
  Loader2,
  UserPlus,
  AlertCircle,
  CheckCircle,
  Building2,
  User,
  Headphones,
  Settings,
  Users,
  Star,
  PenLine,
  Target,
  DollarSign,
  Trophy,
  Power,
  Smartphone,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Icon mapping for dynamic roles
const iconMap: Record<string, LucideIcon> = {
  Shield,
  UserCog,
  ShoppingCart,
  Palette,
  User,
  Headphones,
  Settings,
  Users,
};

// Color presets for roles
const colorPresets: Record<string, { bgLight: string; text: string; border: string }> = {
  '#EF4444': { bgLight: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/30' },
  '#F59E0B': { bgLight: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30' },
  '#22C55E': { bgLight: 'bg-success/10', text: 'text-success', border: 'border-success/30' },
  '#8B5CF6': { bgLight: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30' },
  '#3B82F6': { bgLight: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30' },
  '#EC4899': { bgLight: 'bg-pink-500/10', text: 'text-pink-500', border: 'border-pink-500/30' },
  '#06B6D4': { bgLight: 'bg-cyan-500/10', text: 'text-cyan-500', border: 'border-cyan-500/30' },
};

// Helper function to get role styling
function getRoleStyle(role: RoleDefinition | undefined) {
  if (!role) {
    return { 
      bgLight: 'bg-muted', 
      text: 'text-muted-foreground', 
      border: 'border-border',
      Icon: User
    };
  }
  
  const colorStyle = colorPresets[role.color || '#8B5CF6'] || colorPresets['#8B5CF6'];
  const Icon = iconMap[role.icon || 'User'] || User;
  
  return { ...colorStyle, Icon };
}

export function UserManagement() {
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userToToggle, setUserToToggle] = useState<any>(null);
  const [showToggleDialog, setShowToggleDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const queryClient = useQueryClient();
  const { data: departments = [] } = useDepartments();
  const { data: roles = [], isLoading: rolesLoading } = useRoles();

  // Create a map for quick role lookup
  const rolesMap = useMemo(() => {
    const map: Record<string, RoleDefinition> = {};
    roles.forEach(role => {
      map[role.role_key] = role;
    });
    return map;
  }, [roles]);

  // Fetch users with their departments
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', search, filterRole],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select(`
          *,
          department:departments(id, name),
          user_departments(
            id,
            department_id,
            is_primary,
            department:departments(id, name, color)
          )
        `)
        .order('full_name');
      
      if (search) {
        query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      
      if (filterRole) {
        query = query.eq('role', filterRole);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch pending invites
  const { data: pendingInvites = [] } = useQuery({
    queryKey: ['pendingInvites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_invites')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Count users by role dynamically
  const userCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    roles.forEach(role => {
      counts[role.role_key] = users.filter(u => u.role === role.role_key).length;
    });
    return counts;
  }, [users, roles]);

  // Cancel invite mutation
  const cancelInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('user_invites')
        .update({ status: 'cancelled' })
        .eq('id', inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingInvites'] });
      toast.success('Convite cancelado');
    },
    onError: () => {
      toast.error('Erro ao cancelar convite');
    }
  });

  // Resend invite mutation
  const resendInvite = useMutation({
    mutationFn: async (invite: any) => {
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 7);
      
      const { error } = await supabase
        .from('user_invites')
        .update({ 
          expires_at: newExpiry.toISOString(),
          token: crypto.randomUUID()
        })
        .eq('id', invite.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingInvites'] });
      toast.success('Convite reenviado');
    },
    onError: () => {
      toast.error('Erro ao reenviar convite');
    }
  });

  // Toggle user active status mutation
  const toggleUserActive = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(variables.isActive ? 'Usuário reativado!' : 'Usuário desativado!');
      setShowToggleDialog(false);
      setUserToToggle(null);
    },
    onError: () => {
      toast.error('Erro ao atualizar status do usuário');
    }
  });

  // Delete user permanently mutation
  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('delete-user', {
        body: { userId },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`
        }
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário excluído permanentemente!');
      setShowDeleteDialog(false);
      setUserToDelete(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir usuário');
    }
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards - Compacto */}
      <div className="flex flex-wrap gap-2">
        {roles.map((role) => {
          const style = getRoleStyle(role);
          const Icon = style.Icon;
          const count = userCounts[role.role_key] || 0;
          const isActive = filterRole === role.role_key;
          
          return (
            <button
              key={role.id}
              onClick={() => setFilterRole(isActive ? '' : role.role_key)}
              className={`
                px-3 py-2 rounded-lg border transition-all flex items-center gap-2
                ${isActive 
                  ? `${style.border} ${style.bgLight}` 
                  : 'border-border bg-card hover:border-muted-foreground/30'
                }
              `}
            >
              <div className={`w-7 h-7 rounded-md ${style.bgLight} flex items-center justify-center`}>
                <Icon size={14} className={style.text} />
              </div>
              <div className="text-left">
                <div className="text-base font-bold text-foreground leading-tight">{count}</div>
                <div className="text-xs text-muted-foreground">{role.role_name}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Header with Search and Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar membro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center gap-3">
          {filterRole && (
            <Button 
              variant="outline" 
              onClick={() => setFilterRole('')}
              className="gap-2"
            >
              <X size={16} />
              Limpar filtro
            </Button>
          )}
          
          <Button 
            onClick={() => setShowInviteModal(true)}
            className="gap-2 btn-gradient text-white"
          >
            <Plus size={18} />
            Novo Membro
          </Button>
        </div>
      </div>

      {/* Pending Invites Banner */}
      {pendingInvites.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
          <h3 className="font-semibold text-warning mb-3 flex items-center gap-2">
            <Clock size={18} />
            Convites Pendentes ({pendingInvites.length})
          </h3>
          <div className="space-y-2">
            {pendingInvites.map((invite) => {
              const role = rolesMap[invite.role];
              const style = getRoleStyle(role);
              const Icon = style.Icon;
              
              return (
                <div 
                  key={invite.id}
                  className="flex items-center justify-between bg-card rounded-lg px-4 py-3 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <Mail size={18} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {invite.email}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${style.bgLight} ${style.text}`}>
                      <Icon size={12} />
                      {role?.role_name || invite.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => resendInvite.mutate(invite)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      title="Reenviar convite"
                    >
                      <RefreshCw size={16} className="text-muted-foreground" />
                    </button>
                    <button 
                      onClick={() => cancelInvite.mutate(invite.id)}
                      className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                      title="Cancelar convite"
                    >
                      <X size={16} className="text-destructive" />
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
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Membro
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Contato
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Função
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                  Departamentos
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                  Status
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">
                  Último Acesso
                </th>
                <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <UserCog size={40} className="text-muted-foreground/30" />
                      <p>Nenhum membro encontrado</p>
                      {filterRole && (
                        <button 
                          onClick={() => setFilterRole('')}
                          className="text-primary hover:underline text-sm"
                        >
                          Limpar filtro
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const role = rolesMap[user.role];
                  const style = getRoleStyle(role);
                  const Icon = style.Icon;
                  const userDepts = user.user_departments || [];
                  const primaryDept = userDepts.find((ud: any) => ud.is_primary);
                  
                  return (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-semibold">
                              {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            {user.is_online && (
                              <div className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-card"></div>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">
                              {user.full_name || 'Sem nome'}
                            </div>
                            <div className="text-sm text-muted-foreground md:hidden">
                              {user.phone || '-'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="text-sm text-muted-foreground">{user.phone || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${style.bgLight} ${style.text}`}>
                          <Icon size={14} />
                          {role?.role_name || user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {userDepts.length === 0 ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            userDepts.slice(0, 3).map((ud: any) => (
                              <Badge
                                key={ud.id}
                                variant="outline"
                                className="text-xs"
                                style={{ 
                                  borderColor: ud.department?.color || '#8B5CF6',
                                  backgroundColor: `${ud.department?.color || '#8B5CF6'}15`
                                }}
                              >
                                {ud.is_primary && <Star size={10} className="mr-1" fill="currentColor" />}
                                {ud.department?.name}
                              </Badge>
                            ))
                          )}
                          {userDepts.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{userDepts.length - 3}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <span className={`
                          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                          ${user.is_active !== false
                            ? 'bg-success/10 text-success' 
                            : 'bg-muted text-muted-foreground'
                          }
                        `}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.is_active !== false ? 'bg-success' : 'bg-muted-foreground'}`}></span>
                          {user.is_active !== false ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground hidden xl:table-cell">
                        {user.last_login_at 
                          ? new Date(user.last_login_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Nunca'
                        }
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowEditModal(true);
                            }}
                            title="Editar"
                          >
                            <Edit3 size={16} className="text-primary" />
                          </button>
                          {user.role !== 'admin' && (
                            <>
                              <button 
                                className="p-2 hover:bg-warning/10 rounded-lg transition-colors"
                                onClick={() => {
                                  setUserToToggle(user);
                                  setShowToggleDialog(true);
                                }}
                                title={user.is_active !== false ? 'Desativar' : 'Reativar'}
                              >
                                {user.is_active !== false ? (
                                  <Power size={16} className="text-warning" />
                                ) : (
                                  <RefreshCw size={16} className="text-success" />
                                )}
                              </button>
                              <button 
                                className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                                onClick={() => {
                                  setUserToDelete(user);
                                  setShowDeleteDialog(true);
                                }}
                                title="Excluir permanentemente"
                              >
                                <Trash2 size={16} className="text-destructive" />
                              </button>
                            </>
                          )}
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

      {/* Create User Modal */}
      <CreateUserModal 
        open={showInviteModal} 
        onClose={() => setShowInviteModal(false)}
        departments={departments}
        roles={roles}
      />

      {/* Edit Modal */}
      <EditUserModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        departments={departments}
        roles={roles}
      />

      {/* Toggle User Status Dialog */}
      <AlertDialog open={showToggleDialog} onOpenChange={setShowToggleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {userToToggle?.is_active !== false ? 'Desativar Usuário' : 'Reativar Usuário'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {userToToggle?.is_active !== false 
                ? `Tem certeza que deseja desativar ${userToToggle?.full_name}? O usuário não poderá acessar o sistema.`
                : `Deseja reativar ${userToToggle?.full_name}? O usuário voltará a ter acesso ao sistema.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToToggle(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toggleUserActive.mutate({
                userId: userToToggle?.id,
                isActive: userToToggle?.is_active === false
              })}
              className={userToToggle?.is_active !== false 
                ? "bg-destructive hover:bg-destructive/90" 
                : "bg-success hover:bg-success/90"
              }
            >
              {userToToggle?.is_active !== false ? 'Desativar' : 'Reativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Permanently Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 size={20} />
              Excluir Usuário Permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                <strong>Atenção:</strong> Esta ação não pode ser desfeita!
              </p>
              <p>
                Você está prestes a excluir permanentemente o usuário <strong>{userToDelete?.full_name}</strong> ({userToDelete?.email}).
              </p>
              <p>
                Todos os dados do usuário serão removidos do sistema, incluindo:
              </p>
              <ul className="list-disc list-inside text-sm">
                <li>Perfil e informações pessoais</li>
                <li>Associações com departamentos</li>
                <li>Permissões e roles</li>
                <li>Acesso ao sistema</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUser.mutate(userToDelete?.id)}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir Permanentemente'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==========================================
// CREATE USER MODAL (Direct user creation)
// ==========================================
function CreateUserModal({ open, onClose, departments, roles }: { 
  open: boolean; 
  onClose: () => void;
  departments: any[];
  roles: RoleDefinition[];
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<string>('vendedor');
  const [selectedDepartments, setSelectedDepartments] = useState<{ id: string; name: string; color: string; isPrimary: boolean }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  // Check if department is required (not admin)
  const isDepartmentRequired = role !== 'admin';

  // Generate random password
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
    setConfirmPassword(result);
    setShowPassword(true);
    toast.success('Senha gerada!', { description: 'Anote a senha antes de criar o usuário.' });
  };

  // Password strength indicator
  const getPasswordStrength = () => {
    if (!password) return { level: 0, text: '', color: '' };
    
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength <= 2) return { level: strength, text: 'Fraca', color: 'bg-destructive' };
    if (strength <= 3) return { level: strength, text: 'Média', color: 'bg-warning' };
    return { level: strength, text: 'Forte', color: 'bg-success' };
  };

  const passwordStrength = getPasswordStrength();

  // Add department to selection
  const handleAddDepartment = (deptId: string) => {
    const dept = departments.find(d => d.id === deptId);
    if (!dept) return;
    
    if (selectedDepartments.some(d => d.id === deptId)) {
      toast.error('Departamento já adicionado');
      return;
    }

    const isFirst = selectedDepartments.length === 0;
    setSelectedDepartments(prev => [...prev, {
      id: dept.id,
      name: dept.name,
      color: dept.color || '#8B5CF6',
      isPrimary: isFirst
    }]);
  };

  // Remove department from selection
  const handleRemoveDepartment = (deptId: string) => {
    const dept = selectedDepartments.find(d => d.id === deptId);
    const wasProimary = dept?.isPrimary;
    
    setSelectedDepartments(prev => {
      const updated = prev.filter(d => d.id !== deptId);
      // If we removed the primary, make the first remaining one primary
      if (wasProimary && updated.length > 0) {
        updated[0].isPrimary = true;
      }
      return updated;
    });
  };

  // Set primary department
  const handleSetPrimary = (deptId: string) => {
    setSelectedDepartments(prev => prev.map(d => ({
      ...d,
      isPrimary: d.id === deptId
    })));
  };

  const handleSubmit = async () => {
    // Validation
    if (!fullName.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (!email.trim()) {
      toast.error('E-mail é obrigatório');
      return;
    }
    if (!email.includes('@')) {
      toast.error('E-mail inválido');
      return;
    }
    if (!password) {
      toast.error('Senha é obrigatória');
      return;
    }
    if (password.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Senhas não conferem');
      return;
    }
    
    // Department validation for non-admins
    if (isDepartmentRequired && selectedDepartments.length === 0) {
      toast.error('Pelo menos um departamento é obrigatório');
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Você precisa estar logado para criar usuários');
      }

      // Prepare department_ids with primary info
      const department_ids = selectedDepartments.map(d => ({
        id: d.id,
        is_primary: d.isPrimary
      }));

      const response = await fetch(
        `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
            full_name: fullName.trim(),
            role,
            department_ids,
            phone: phone || null
          })
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      toast.success('Usuário criado com sucesso!', {
        description: `${fullName} já pode fazer login no sistema.`
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      handleClose();
    } catch (error: any) {
      console.error('Error creating user:', error);
      // Handle specific errors
      if (error.message?.includes('already registered') || error.message?.includes('Email already')) {
        toast.error('E-mail já cadastrado', {
          description: 'Este e-mail já está em uso por outro usuário.'
        });
      } else if (error.message?.includes('Only admins')) {
        toast.error('Sem permissão', {
          description: 'Apenas administradores podem criar usuários.'
        });
      } else {
        toast.error('Erro ao criar usuário', {
          description: error.message
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setRole('vendedor');
    setSelectedDepartments([]);
    setShowPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  const selectedRole = roles.find(r => r.role_key === role);
  const selectedStyle = getRoleStyle(selectedRole);

  // Available departments (not yet selected)
  const availableDepartments = departments.filter(d => 
    d.is_active && !selectedDepartments.some(sd => sd.id === d.id)
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <UserPlus size={20} className="text-primary" />
            Cadastrar Novo Membro
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-5 py-4">
          {/* Full Name */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <UserCog size={14} />
              Nome Completo *
            </Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex: João da Silva"
            />
          </div>

          {/* Email */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Mail size={14} />
              E-mail (Login) *
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
            />
          </div>

          {/* Phone */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Phone size={14} />
              Telefone (opcional)
            </Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(21) 99999-9999"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="flex items-center gap-2">
                <Lock size={14} />
                Senha *
              </Label>
              <button
                type="button"
                onClick={generatePassword}
                className="text-xs text-primary hover:underline"
              >
                Gerar senha automática
              </button>
            </div>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            {/* Password Strength */}
            {password && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${passwordStrength.color}`}
                      style={{ width: `${(passwordStrength.level / 5) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs ${
                    passwordStrength.color === 'bg-destructive' ? 'text-destructive' :
                    passwordStrength.color === 'bg-warning' ? 'text-warning' : 'text-success'
                  }`}>
                    {passwordStrength.text}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Lock size={14} />
              Confirmar Senha *
            </Label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                className={`pr-10 ${
                  confirmPassword && password !== confirmPassword 
                    ? 'border-destructive' 
                    : confirmPassword && password === confirmPassword
                      ? 'border-success'
                      : ''
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                Senhas não conferem
              </p>
            )}
            {confirmPassword && password === confirmPassword && (
              <p className="text-xs text-success mt-1 flex items-center gap-1">
                <CheckCircle size={12} />
                Senhas conferem
              </p>
            )}
          </div>

          {/* Role Selection */}
          <div>
            <Label className="flex items-center gap-2 mb-3">
              <Shield size={14} />
              Perfil de Acesso *
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {roles.map((r) => {
                const style = getRoleStyle(r);
                const Icon = style.Icon;
                const isSelected = role === r.role_key;
                
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.role_key)}
                    className={`
                      flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left
                      ${isSelected 
                        ? `${style.border} ${style.bgLight}` 
                        : 'border-border hover:border-muted-foreground/30'
                      }
                    `}
                  >
                    <div className={`w-9 h-9 rounded-lg ${style.bgLight} flex items-center justify-center`}>
                      <Icon size={18} className={style.text} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground text-sm">
                        {r.role_name}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle size={16} className="text-primary flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Role Description */}
          {selectedRole && (
            <div className={`p-4 rounded-xl ${selectedStyle.bgLight} border ${selectedStyle.border}`}>
              <p className={`text-sm ${selectedStyle.text}`}>
                {selectedRole.description || `Perfil de acesso: ${selectedRole.role_name}`}
              </p>
            </div>
          )}

          {/* Departments - Multi-select */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Building2 size={14} />
              Departamentos {isDepartmentRequired && '*'}
            </Label>
            
            {/* Selected departments */}
            {selectedDepartments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 p-3 bg-muted/50 rounded-lg">
                {selectedDepartments.map((dept) => (
                  <Badge
                    key={dept.id}
                    variant="outline"
                    className="pl-2 pr-1 py-1.5 gap-1 cursor-pointer group"
                    style={{ 
                      borderColor: dept.color,
                      backgroundColor: `${dept.color}15`
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(dept.id)}
                      className="flex items-center gap-1"
                      title={dept.isPrimary ? 'Departamento primário' : 'Definir como primário'}
                    >
                      {dept.isPrimary && <Star size={12} className="text-warning" fill="currentColor" />}
                      {dept.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveDepartment(dept.id)}
                      className="ml-1 p-0.5 hover:bg-destructive/20 rounded transition-colors"
                    >
                      <X size={14} className="text-muted-foreground hover:text-destructive" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Add department select */}
            {availableDepartments.length > 0 && (
              <Select onValueChange={handleAddDepartment} value="">
                <SelectTrigger>
                  <SelectValue placeholder="Adicionar departamento..." />
                </SelectTrigger>
                <SelectContent>
                  {availableDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: dept.color || '#8B5CF6' }}
                        />
                        {dept.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Validation message */}
            {isDepartmentRequired && selectedDepartments.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <AlertCircle size={12} />
                Pelo menos um departamento é obrigatório para este perfil
              </p>
            )}

            {selectedDepartments.length > 1 && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Star size={12} className="text-warning" />
                Clique no departamento para defini-lo como primário
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isLoading || !fullName || !email || !password || password !== confirmPassword || (isDepartmentRequired && selectedDepartments.length === 0)}
            className="gap-2 btn-gradient text-white"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <UserPlus size={16} />
                Criar Usuário
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// EDIT USER MODAL
// ==========================================
function EditUserModal({ open, onClose, user, departments, roles }: { 
  open: boolean; 
  onClose: () => void;
  user: any;
  departments: any[];
  roles: RoleDefinition[];
}) {
  const [role, setRole] = useState<string>('vendedor');
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<{ id: string; name: string; color: string; isPrimary: boolean }[]>([]);
  const [signatureName, setSignatureName] = useState('');
  const [signatureEnabled, setSignatureEnabled] = useState(true);
  
  // Commission and targets state
  const [commissionPercent, setCommissionPercent] = useState(0);
  const [salesTarget1, setSalesTarget1] = useState(0);
  const [salesTarget2, setSalesTarget2] = useState(0);
  const [salesTarget3, setSalesTarget3] = useState(0);
  const [bonusTarget1, setBonusTarget1] = useState(0);
  const [bonusTarget2, setBonusTarget2] = useState(0);
  const [bonusTarget3, setBonusTarget3] = useState(0);
  const [showCommissionSection, setShowCommissionSection] = useState(false);
  
  // Channels state
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [showChannelsSection, setShowChannelsSection] = useState(false);

  const queryClient = useQueryClient();

  const addUserToDept = useAddUserToDepartment();
  const removeUserFromDept = useRemoveUserFromDepartment();
  const setPrimaryDept = useSetPrimaryDepartment();

  // Channels hooks
  const { data: allChannels = [] } = useChannels();
  const { data: userChannelsConfig = [] } = useUserChannelsConfig(user?.id);
  const syncUserChannels = useSyncUserChannels();

  // Check if department is required (not admin)
  const isDepartmentRequired = role !== 'admin';

  // Fetch user email from auth
  const fetchUserEmail = async (userId: string) => {
    setLoadingEmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/get-user-details`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ userId })
        }
      );
      if (response.ok) {
        const data = await response.json();
        setEmail(data.email || '');
        setOriginalEmail(data.email || '');
      }
    } catch (error) {
      console.error('Error fetching user email:', error);
    } finally {
      setLoadingEmail(false);
    }
  };

  // Update state when user changes
  useEffect(() => {
    if (user && open) {
      setRole(user.role || 'vendedor');
      setIsActive(user.is_active !== false);
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setNewPassword('');
      setShowPasswordSection(false);
      setEmail('');
      setOriginalEmail('');
      setSignatureName(user.signature_name || '');
      setSignatureEnabled(user.signature_enabled !== false);
      fetchUserEmail(user.id);

      // Load commission and targets
      setCommissionPercent(user.commission_percent || 0);
      setSalesTarget1(user.sales_target_1 || 0);
      setSalesTarget2(user.sales_target_2 || 0);
      setSalesTarget3(user.sales_target_3 || 0);
      setBonusTarget1(user.bonus_target_1 || 0);
      setBonusTarget2(user.bonus_target_2 || 0);
      setBonusTarget3(user.bonus_target_3 || 0);
      setShowCommissionSection(false);
      setShowChannelsSection(false);

      // Load user's departments
      const userDepts = user.user_departments || [];
      setSelectedDepartments(userDepts.map((ud: any) => ({
        id: ud.department_id,
        name: ud.department?.name || '',
        color: ud.department?.color || '#8B5CF6',
        isPrimary: ud.is_primary
      })));
    }
  }, [user, open]);

  // Load user's channels when config loads
  useEffect(() => {
    if (userChannelsConfig && userChannelsConfig.length > 0) {
      setSelectedChannelIds(userChannelsConfig.map(uc => uc.channel_id));
    } else {
      setSelectedChannelIds([]);
    }
  }, [userChannelsConfig]);

  // Toggle channel selection
  const handleToggleChannel = (channelId: string) => {
    setSelectedChannelIds(prev => {
      if (prev.includes(channelId)) {
        return prev.filter(id => id !== channelId);
      } else {
        return [...prev, channelId];
      }
    });
  };

  // Add department to selection
  const handleAddDepartment = (deptId: string) => {
    const dept = departments.find(d => d.id === deptId);
    if (!dept) return;
    
    if (selectedDepartments.some(d => d.id === deptId)) {
      toast.error('Departamento já adicionado');
      return;
    }

    const isFirst = selectedDepartments.length === 0;
    setSelectedDepartments(prev => [...prev, {
      id: dept.id,
      name: dept.name,
      color: dept.color || '#8B5CF6',
      isPrimary: isFirst
    }]);
  };

  // Remove department from selection
  const handleRemoveDepartment = (deptId: string) => {
    if (isDepartmentRequired && selectedDepartments.length <= 1) {
      toast.error('Pelo menos um departamento é obrigatório');
      return;
    }

    const dept = selectedDepartments.find(d => d.id === deptId);
    const wasPrimary = dept?.isPrimary;
    
    setSelectedDepartments(prev => {
      const updated = prev.filter(d => d.id !== deptId);
      // If we removed the primary, make the first remaining one primary
      if (wasPrimary && updated.length > 0) {
        updated[0].isPrimary = true;
      }
      return updated;
    });
  };

  // Set primary department
  const handleSetPrimary = (deptId: string) => {
    setSelectedDepartments(prev => prev.map(d => ({
      ...d,
      isPrimary: d.id === deptId
    })));
  };

  const handleSubmit = async () => {
    if (!user) return;

    // Validate departments for non-admins
    if (isDepartmentRequired && selectedDepartments.length === 0) {
      toast.error('Pelo menos um departamento é obrigatório');
      return;
    }

    setIsLoading(true);
    try {
      // Update profile (keep department_id for backwards compatibility)
      const primaryDeptId = selectedDepartments.find(d => d.isPrimary)?.id || selectedDepartments[0]?.id || null;
      
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone,
          role,
          department_id: primaryDeptId,
          is_active: isActive,
          signature_name: signatureName || null,
          signature_enabled: signatureEnabled,
          commission_percent: commissionPercent || 0,
          sales_target_1: salesTarget1 || 0,
          sales_target_2: salesTarget2 || 0,
          sales_target_3: salesTarget3 || 0,
          bonus_target_1: bonusTarget1 || 0,
          bonus_target_2: bonusTarget2 || 0,
          bonus_target_3: bonusTarget3 || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Sync departments in user_departments table
      const currentDepts = user.user_departments?.map((ud: any) => ud.department_id) || [];
      const newDepts = selectedDepartments.map(d => d.id);
      
      // Remove departments that are no longer selected
      const deptsToRemove = currentDepts.filter((id: string) => !newDepts.includes(id));
      for (const deptId of deptsToRemove) {
        await supabase
          .from('user_departments')
          .delete()
          .eq('user_id', user.id)
          .eq('department_id', deptId);
      }

      // Add new departments
      const deptsToAdd = selectedDepartments.filter(d => !currentDepts.includes(d.id));
      for (const dept of deptsToAdd) {
        await supabase
          .from('user_departments')
          .insert({
            user_id: user.id,
            department_id: dept.id,
            is_primary: dept.isPrimary,
            tenant_id: user.tenant_id
          });
      }

      // Update primary status for existing departments
      const primaryDept = selectedDepartments.find(d => d.isPrimary);
      if (primaryDept) {
        // Set all to non-primary first
        await supabase
          .from('user_departments')
          .update({ is_primary: false })
          .eq('user_id', user.id);
        
        // Set the primary one
        await supabase
          .from('user_departments')
          .update({ is_primary: true })
          .eq('user_id', user.id)
          .eq('department_id', primaryDept.id);
      }

      // Update email/password via edge function if changed
      if (email !== originalEmail || newPassword) {
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await fetch(
          `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/update-user`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({
              userId: user.id,
              email: email !== originalEmail ? email : undefined,
              password: newPassword || undefined
            })
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao atualizar credenciais');
        }
      }

      // Sync user channels
      try {
        await syncUserChannels.mutateAsync({
          userId: user.id,
          channelIds: selectedChannelIds
        });
      } catch (channelError) {
        console.warn('Aviso ao sincronizar canais:', channelError);
        // Não bloqueia o salvamento se falhar (tabela pode não existir)
      }

      toast.success('Usuário atualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-departments'] });
      queryClient.invalidateQueries({ queryKey: ['all-user-departments'] });
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erro ao atualizar usuário');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  const selectedRole = roles.find(r => r.role_key === role);
  const selectedStyle = getRoleStyle(selectedRole);

  // Available departments (not yet selected)
  const availableDepartments = departments.filter(d => 
    d.is_active && !selectedDepartments.some(sd => sd.id === d.id)
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Editar Membro</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* User Avatar Header */}
          <div className="flex items-center gap-4 p-4 bg-muted rounded-xl">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-xl">
              {fullName?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-foreground text-lg">
                {fullName || 'Sem nome'}
              </div>
              <div className="text-sm text-muted-foreground">
                {email || '-'}
              </div>
            </div>
          </div>

          {/* Personal Info Section */}
          <div className="space-y-4">
            <h3 className="font-medium text-foreground flex items-center gap-2">
              <UserCog size={16} />
              Informações Pessoais
            </h3>
            
            {/* Full Name */}
            <div>
              <Label className="text-sm mb-2 block">Nome Completo</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nome do usuário"
              />
            </div>

            {/* Email */}
            <div>
              <Label className="text-sm mb-2 block flex items-center gap-2">
                <Mail size={14} />
                E-mail
              </Label>
              <div className="relative">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={loadingEmail ? "Carregando..." : "email@exemplo.com"}
                  disabled={loadingEmail}
                />
                {loadingEmail && (
                  <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Phone */}
            <div>
              <Label className="text-sm mb-2 block flex items-center gap-2">
                <Phone size={14} />
                Telefone
              </Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          {/* Password Section */}
          <div className="border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="w-full flex items-center justify-between p-4 bg-muted hover:bg-muted/80 transition-colors"
            >
              <span className="font-medium text-foreground flex items-center gap-2">
                <Lock size={16} />
                Alterar Senha
              </span>
              {showPasswordSection ? (
                <ChevronUp size={18} className="text-muted-foreground" />
              ) : (
                <ChevronDown size={18} className="text-muted-foreground" />
              )}
            </button>
            
            {showPasswordSection && (
              <div className="p-4 space-y-3 bg-card">
                <div>
                  <Label className="text-sm mb-2 block">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Deixe em branco para manter a atual"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mínimo 6 caracteres. Deixe em branco para não alterar.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Perfil de Acesso
            </label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => {
                  const style = getRoleStyle(r);
                  const Icon = style.Icon;
                  return (
                    <SelectItem key={r.id} value={r.role_key}>
                      <div className="flex items-center gap-2">
                        <Icon size={16} className={style.text} />
                        {r.role_name}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Departments - Multi-select */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Building2 size={14} />
              Departamentos {isDepartmentRequired && '*'}
            </Label>
            
            {/* Selected departments */}
            {selectedDepartments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 p-3 bg-muted/50 rounded-lg">
                {selectedDepartments.map((dept) => (
                  <Badge
                    key={dept.id}
                    variant="outline"
                    className="pl-2 pr-1 py-1.5 gap-1 cursor-pointer group"
                    style={{ 
                      borderColor: dept.color,
                      backgroundColor: `${dept.color}15`
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(dept.id)}
                      className="flex items-center gap-1"
                      title={dept.isPrimary ? 'Departamento primário' : 'Definir como primário'}
                    >
                      {dept.isPrimary && <Star size={12} className="text-warning" fill="currentColor" />}
                      {dept.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveDepartment(dept.id)}
                      className="ml-1 p-0.5 hover:bg-destructive/20 rounded transition-colors"
                      disabled={isDepartmentRequired && selectedDepartments.length <= 1}
                    >
                      <X size={14} className={`${isDepartmentRequired && selectedDepartments.length <= 1 ? 'text-muted-foreground/30' : 'text-muted-foreground hover:text-destructive'}`} />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Add department select */}
            {availableDepartments.length > 0 && (
              <Select onValueChange={handleAddDepartment} value="">
                <SelectTrigger>
                  <SelectValue placeholder="Adicionar departamento..." />
                </SelectTrigger>
                <SelectContent>
                  {availableDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: dept.color || '#8B5CF6' }}
                        />
                        {dept.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Validation message */}
            {isDepartmentRequired && selectedDepartments.length === 0 && (
              <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                <AlertCircle size={12} />
                Pelo menos um departamento é obrigatório para este perfil
              </p>
            )}

            {selectedDepartments.length > 1 && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Star size={12} className="text-warning" />
                Clique no departamento para defini-lo como primário
              </p>
            )}
          </div>

          {/* WhatsApp Channels Section */}
          <div className="border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowChannelsSection(!showChannelsSection)}
              className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Smartphone size={16} className="text-green-500" />
                <span className="font-medium">Canais WhatsApp</span>
                {selectedChannelIds.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedChannelIds.length} selecionado{selectedChannelIds.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              {showChannelsSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showChannelsSection && (
              <div className="p-4 pt-0 space-y-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Selecione os canais que este usuário poderá visualizar. Se nenhum canal for selecionado, o usuário verá canais do seu departamento.
                </p>

                {allChannels.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    Nenhum canal WhatsApp configurado
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {allChannels.map((channel) => (
                      <label
                        key={channel.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={selectedChannelIds.includes(channel.id)}
                          onCheckedChange={() => handleToggleChannel(channel.id)}
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            channel.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                          <span className="text-sm font-medium">{channel.name}</span>
                          <span className="text-xs text-muted-foreground">{channel.phone}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          channel.status === 'connected'
                            ? 'bg-green-500/20 text-green-600'
                            : 'bg-red-500/20 text-red-600'
                        }`}>
                          {channel.status === 'connected' ? 'Ativo' : 'Inativo'}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {selectedChannelIds.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedChannelIds([])}
                    className="text-xs"
                  >
                    Limpar seleção (usar departamento)
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Signature Settings Section */}
          <div className="border border-border rounded-xl p-4 space-y-4">
            <h3 className="font-medium text-foreground flex items-center gap-2">
              <PenLine size={16} />
              Assinatura de Mensagens
            </h3>
            
            {/* Nome da Assinatura */}
            <div>
              <Label className="text-sm mb-2 block">Nome na Assinatura</Label>
              <Input
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder={fullName || "Usar nome de cadastro"}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se vazio, usa o nome de cadastro: {fullName || '(não definido)'}
              </p>
            </div>
            
            {/* Switch Ativar/Desativar */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Assinatura Ativa</Label>
                <p className="text-xs text-muted-foreground">
                  Quando ativo, mensagens incluem: *Nome*: antes do texto
                </p>
              </div>
              <Switch
                checked={signatureEnabled}
                onCheckedChange={setSignatureEnabled}
              />
            </div>
          </div>

          {/* Commission and Targets Section */}
          <div className="border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCommissionSection(!showCommissionSection)}
              className="w-full flex items-center justify-between p-4 bg-muted hover:bg-muted/80 transition-colors"
            >
              <span className="font-medium text-foreground flex items-center gap-2">
                <Target size={16} />
                Comissão e Metas
              </span>
              {showCommissionSection ? (
                <ChevronUp size={18} className="text-muted-foreground" />
              ) : (
                <ChevronDown size={18} className="text-muted-foreground" />
              )}
            </button>
            
            {showCommissionSection && (
              <div className="p-4 space-y-4 bg-card">
                {/* Commission Percent */}
                <div>
                  <Label className="text-sm mb-2 flex items-center gap-2">
                    <DollarSign size={14} />
                    Percentual de Comissão
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={commissionPercent}
                      onChange={(e) => setCommissionPercent(parseFloat(e.target.value) || 0)}
                      className="w-24"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Trophy size={14} className="text-warning" />
                    Metas de Vendas
                  </h4>

                  {/* Target 1 */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Meta 1 (R$)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="100"
                        value={salesTarget1}
                        onChange={(e) => setSalesTarget1(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Bonificação (R$)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="10"
                        value={bonusTarget1}
                        onChange={(e) => setBonusTarget1(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  {/* Target 2 */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Meta 2 (R$)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="100"
                        value={salesTarget2}
                        onChange={(e) => setSalesTarget2(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Bonificação (R$)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="10"
                        value={bonusTarget2}
                        onChange={(e) => setBonusTarget2(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  {/* Target 3 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Meta 3 (R$)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="100"
                        value={salesTarget3}
                        onChange={(e) => setSalesTarget3(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Bonificação (R$)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="10"
                        value={bonusTarget3}
                        onChange={(e) => setBonusTarget3(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  Ao bater cada meta, o vendedor recebe a bonificação correspondente além da comissão.
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
            <div>
              <div className="font-medium text-foreground">
                Status da Conta
              </div>
              <div className="text-sm text-muted-foreground">
                {isActive ? 'Usuário pode acessar o sistema' : 'Usuário bloqueado'}
              </div>
            </div>
            <Switch 
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          {/* Permission Preview - Shows what pages/features this user can access */}
          <PermissionPreview 
            roleKey={role}
            permissions={selectedRole?.permissions as Record<string, Record<string, boolean>> || null}
            customPermissions={user.permissions}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isLoading || !fullName || (isDepartmentRequired && selectedDepartments.length === 0)}
            className="gap-2 btn-gradient text-white"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Check size={16} />
                Salvar Alterações
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UserManagement;
