import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDepartments } from '@/hooks/useDepartments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Role configuration
const roleConfig: Record<string, {
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  bgLight: string;
  text: string;
  border: string;
  description: string;
  permissions: { label: string; allowed: boolean }[];
}> = {
  admin: {
    label: 'Administrador',
    shortLabel: 'Admin',
    icon: Shield,
    bgLight: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/30',
    description: 'Acesso total ao sistema. Pode gerenciar usuários, configurações e todos os módulos.',
    permissions: [
      { label: 'Criar e gerenciar usuários', allowed: true },
      { label: 'Ver toda a equipe', allowed: true },
      { label: 'Configurações do sistema', allowed: true },
      { label: 'Conectar canais WhatsApp', allowed: true },
      { label: 'Ver todos os relatórios', allowed: true },
      { label: 'Importar/Exportar dados', allowed: true },
    ]
  },
  supervisor: {
    label: 'Supervisor',
    shortLabel: 'Supervisor',
    icon: UserCog,
    bgLight: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/30',
    description: 'Gerencia equipe do departamento. Vê relatórios e pode transferir atendimentos.',
    permissions: [
      { label: 'Criar e gerenciar usuários', allowed: false },
      { label: 'Ver toda a equipe', allowed: true },
      { label: 'Configurações do sistema', allowed: false },
      { label: 'Conectar canais WhatsApp', allowed: false },
      { label: 'Ver todos os relatórios', allowed: true },
      { label: 'Importar/Exportar dados', allowed: true },
    ]
  },
  vendedor: {
    label: 'Vendedor',
    shortLabel: 'Vendedor',
    icon: ShoppingCart,
    bgLight: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/30',
    description: 'Atende clientes, cria orçamentos e acompanha negociações.',
    permissions: [
      { label: 'Criar e gerenciar usuários', allowed: false },
      { label: 'Ver toda a equipe', allowed: false },
      { label: 'Configurações do sistema', allowed: false },
      { label: 'Conectar canais WhatsApp', allowed: false },
      { label: 'Ver todos os relatórios', allowed: false },
      { label: 'Importar/Exportar dados', allowed: false },
    ]
  },
  designer: {
    label: 'Designer',
    shortLabel: 'Designer',
    icon: Palette,
    bgLight: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/30',
    description: 'Acessa área de produção, layouts e artes. Não atende clientes diretamente.',
    permissions: [
      { label: 'Criar e gerenciar usuários', allowed: false },
      { label: 'Ver toda a equipe', allowed: false },
      { label: 'Configurações do sistema', allowed: false },
      { label: 'Conectar canais WhatsApp', allowed: false },
      { label: 'Ver todos os relatórios', allowed: false },
      { label: 'Criar templates e artes', allowed: true },
    ]
  }
};

type RoleKey = keyof typeof roleConfig;

export function UserManagement() {
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<RoleKey | ''>('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const queryClient = useQueryClient();
  const { data: departments = [] } = useDepartments();

  // Fetch users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', search, filterRole],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select(`
          *,
          department:departments(id, name)
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

  // Count users by role
  const userCounts = {
    admin: users.filter(u => u.role === 'admin').length,
    supervisor: users.filter(u => u.role === 'supervisor').length,
    vendedor: users.filter(u => u.role === 'vendedor').length,
    designer: users.filter(u => u.role === 'designer').length,
  };

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

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(Object.keys(roleConfig) as RoleKey[]).map((roleKey) => {
          const config = roleConfig[roleKey];
          const Icon = config.icon;
          const count = userCounts[roleKey as keyof typeof userCounts] || 0;
          const isActive = filterRole === roleKey;
          
          return (
            <button
              key={roleKey}
              onClick={() => setFilterRole(isActive ? '' : roleKey)}
              className={`
                p-4 rounded-xl border-2 transition-all text-left
                ${isActive 
                  ? `${config.border} ${config.bgLight}` 
                  : 'border-border bg-card hover:border-muted-foreground/30'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl ${config.bgLight} flex items-center justify-center`}>
                  <Icon size={24} className={config.text} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{count}</div>
                  <div className="text-sm text-muted-foreground">{config.shortLabel}</div>
                </div>
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
              const config = roleConfig[invite.role as RoleKey] || roleConfig.vendedor;
              const Icon = config.icon;
              
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
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${config.bgLight} ${config.text}`}>
                      <Icon size={12} />
                      {config.shortLabel}
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
                  Departamento
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
                  const config = roleConfig[user.role as RoleKey] || roleConfig.vendedor;
                  const Icon = config.icon;
                  
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
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${config.bgLight} ${config.text}`}>
                          <Icon size={14} />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground hidden lg:table-cell">
                        {user.department?.name || '-'}
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
                            <button 
                              className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                              title="Desativar"
                            >
                              <Trash2 size={16} className="text-destructive" />
                            </button>
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
      />
    </div>
  );
}

// ==========================================
// CREATE USER MODAL (Direct user creation)
// ==========================================
function CreateUserModal({ open, onClose, departments }: { 
  open: boolean; 
  onClose: () => void;
  departments: any[];
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<RoleKey>('vendedor');
  const [departmentId, setDepartmentId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

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

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Você precisa estar logado para criar usuários');
      }

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
            department_id: departmentId || null,
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
    setDepartmentId('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  const selectedConfig = roleConfig[role];

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
              {(Object.keys(roleConfig) as RoleKey[]).map((roleKey) => {
                const config = roleConfig[roleKey];
                const Icon = config.icon;
                const isSelected = role === roleKey;
                
                return (
                  <button
                    key={roleKey}
                    type="button"
                    onClick={() => setRole(roleKey)}
                    className={`
                      flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left
                      ${isSelected 
                        ? `${config.border} ${config.bgLight}` 
                        : 'border-border hover:border-muted-foreground/30'
                      }
                    `}
                  >
                    <div className={`w-9 h-9 rounded-lg ${config.bgLight} flex items-center justify-center`}>
                      <Icon size={18} className={config.text} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground text-sm">
                        {config.shortLabel}
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
          <div className={`p-4 rounded-xl ${selectedConfig.bgLight} border ${selectedConfig.border}`}>
            <p className={`text-sm ${selectedConfig.text}`}>
              {selectedConfig.description}
            </p>
          </div>

          {/* Department */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Building2 size={14} />
              Departamento
            </Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um departamento (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isLoading || !fullName || !email || !password || password !== confirmPassword}
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
function EditUserModal({ open, onClose, user, departments }: { 
  open: boolean; 
  onClose: () => void;
  user: any;
  departments: any[];
}) {
  const [role, setRole] = useState<RoleKey>('vendedor');
  const [departmentId, setDepartmentId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [showPermissions, setShowPermissions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const queryClient = useQueryClient();

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
      setDepartmentId(user.department_id || '');
      setIsActive(user.is_active !== false);
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setNewPassword('');
      setShowPasswordSection(false);
      setEmail('');
      setOriginalEmail('');
      fetchUserEmail(user.id);
    }
  }, [user, open]);

  const handleSubmit = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone,
          role,
          department_id: departmentId || null,
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

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

      toast.success('Usuário atualizado com sucesso!');
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

  const selectedConfig = roleConfig[role] || roleConfig.vendedor;

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
            <Select value={role} onValueChange={(value) => setRole(value as RoleKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(roleConfig) as RoleKey[]).map((roleKey) => {
                  const config = roleConfig[roleKey];
                  const Icon = config.icon;
                  return (
                    <SelectItem key={roleKey} value={roleKey}>
                      <div className="flex items-center gap-2">
                        <Icon size={16} className={config.text} />
                        {config.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Departamento
            </label>
            <Select value={departmentId || "none"} onValueChange={(val) => setDepartmentId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Active Status */}
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

          {/* Permissions Collapsible */}
          <div className="border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPermissions(!showPermissions)}
              className="w-full flex items-center justify-between p-4 bg-muted hover:bg-muted/80 transition-colors"
            >
              <span className="font-medium text-foreground">
                Permissões do Perfil
              </span>
              {showPermissions ? (
                <ChevronUp size={18} className="text-muted-foreground" />
              ) : (
                <ChevronDown size={18} className="text-muted-foreground" />
              )}
            </button>
            
            {showPermissions && (
              <div className="p-4 space-y-2 bg-card">
                {selectedConfig.permissions.map((perm, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-2">
                    {perm.allowed ? (
                      <div className="w-5 h-5 rounded-full bg-success/10 flex items-center justify-center">
                        <Check size={12} className="text-success" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-destructive/10 flex items-center justify-center">
                        <X size={12} className="text-destructive" />
                      </div>
                    )}
                    <span className={`text-sm ${perm.allowed ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {perm.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isLoading || !fullName}
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
