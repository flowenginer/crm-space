import { useState } from 'react';
import {
  Shield,
  Plus,
  Edit3,
  Trash2,
  Users,
  MoreVertical,
  Loader2,
  ChevronDown,
  ChevronRight,
  Save,
  Settings2,
  LayoutDashboard,
  MessageSquare,
  Radio,
  FileText,
  Clock,
  Workflow,
  TrendingUp,
  Smartphone,
  UserCircle,
  Megaphone,
  BarChart3,
  Settings,
  LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useRoles, usePermissionDefinitions, useCreateRole, useUpdateRole, useDeleteRole, RoleDefinition } from '@/hooks/useRoles';

// Configuração de categorias com ícones e labels
const categoryConfig: Record<string, { label: string; icon: LucideIcon; order: number }> = {
  dashboard: { label: 'Dashboard', icon: LayoutDashboard, order: 1 },
  conversations: { label: 'Conversas', icon: MessageSquare, order: 2 },
  live: { label: 'Ao Vivo', icon: Radio, order: 3 },
  templates: { label: 'Mensagens Rápidas', icon: FileText, order: 4 },
  schedules: { label: 'Agendamentos', icon: Clock, order: 5 },
  automations: { label: 'Automações', icon: Workflow, order: 6 },
  crm: { label: 'CRM', icon: TrendingUp, order: 7 },
  channels: { label: 'Canais WhatsApp', icon: Smartphone, order: 8 },
  contacts: { label: 'Contatos', icon: UserCircle, order: 9 },
  marketing: { label: 'Marketing', icon: Megaphone, order: 10 },
  reports: { label: 'Relatórios', icon: BarChart3, order: 11 },
  settings: { label: 'Configurações', icon: Settings, order: 12 },
};

const colorOptions = [
  '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'
];

export function RoleManagement() {
  const { data: roles = [], isLoading: loadingRoles } = useRoles();
  const { data: permissionDefs = [], isLoading: loadingPermissions } = usePermissionDefinitions();
  
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  
  const [form, setForm] = useState({
    role_key: '',
    role_name: '',
    description: '',
    color: '#8B5CF6',
    permissions: {} as Record<string, Record<string, boolean>>,
  });

  // Group permissions by category and sort by order
  const permissionsByCategory = permissionDefs.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, typeof permissionDefs>);

  // Sort categories by defined order
  const sortedCategories = Object.keys(permissionsByCategory).sort((a, b) => {
    const orderA = categoryConfig[a]?.order ?? 99;
    const orderB = categoryConfig[b]?.order ?? 99;
    return orderA - orderB;
  });

  const handleOpenCreate = () => {
    setEditingRole(null);
    setForm({
      role_key: '',
      role_name: '',
      description: '',
      color: '#8B5CF6',
      permissions: {},
    });
    setExpandedCategories([]);
    setShowModal(true);
  };

  const handleOpenEdit = (role: RoleDefinition) => {
    setEditingRole(role);
    setForm({
      role_key: role.role_key,
      role_name: role.role_name,
      description: role.description || '',
      color: role.color || '#8B5CF6',
      permissions: (role.permissions || {}) as Record<string, Record<string, boolean>>,
    });
    setExpandedCategories(Object.keys(permissionsByCategory));
    setShowModal(true);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handlePermissionChange = (category: string, key: string, value: boolean) => {
    setForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [category]: {
          ...(prev.permissions[category] || {}),
          [key]: value,
        },
      },
    }));
  };

  const handleToggleAllCategory = (category: string, permissions: typeof permissionDefs) => {
    const allEnabled = permissions.every(p => {
      const key = p.permission_key.split('.')[1];
      return form.permissions[category]?.[key] === true;
    });

    const newCategoryPerms: Record<string, boolean> = {};
    permissions.forEach(p => {
      const key = p.permission_key.split('.')[1];
      newCategoryPerms[key] = !allEnabled;
    });

    setForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [category]: newCategoryPerms,
      },
    }));
  };

  const handleSave = async () => {
    if (!form.role_name || !form.role_key) {
      toast.error('Nome e chave do perfil são obrigatórios');
      return;
    }

    try {
      if (editingRole) {
        await updateRole.mutateAsync({
          id: editingRole.id,
          role_name: form.role_name,
          description: form.description || null,
          color: form.color,
          permissions: form.permissions,
        });
        toast.success('Perfil atualizado com sucesso');
      } else {
        await createRole.mutateAsync({
          role_key: form.role_key.toLowerCase().replace(/\s+/g, '_'),
          role_name: form.role_name,
          description: form.description || null,
          color: form.color,
          icon: 'User',
          permissions: form.permissions,
          is_system: false,
          order_position: roles.length,
        });
        toast.success('Perfil criado com sucesso');
      }
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar perfil');
    }
  };

  const handleDelete = async (role: RoleDefinition) => {
    if (role.is_system) {
      toast.error('Perfis do sistema não podem ser excluídos');
      return;
    }
    if (role.user_count && role.user_count > 0) {
      toast.error('Não é possível excluir um perfil com usuários vinculados');
      return;
    }
    if (!confirm(`Tem certeza que deseja excluir o perfil "${role.role_name}"?`)) return;

    try {
      await deleteRole.mutateAsync(role.id);
      toast.success('Perfil excluído com sucesso');
    } catch (error) {
      toast.error('Erro ao excluir perfil');
    }
  };

  // Count enabled permissions for a role
  const countEnabledPermissions = (permissions: Record<string, Record<string, boolean>> | undefined) => {
    if (!permissions) return 0;
    return Object.values(permissions).reduce((total, categoryPerms) => {
      return total + Object.values(categoryPerms).filter(Boolean).length;
    }, 0);
  };

  const isLoading = loadingRoles || loadingPermissions;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Gerencie perfis de acesso e permissões do sistema
        </p>
        <Button onClick={handleOpenCreate} className="btn-gradient">
          <Plus size={18} className="mr-2" />
          Novo Perfil
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : roles.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <Shield size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum perfil cadastrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => (
            <div
              key={role.id}
              className="bg-card rounded-2xl border border-border p-6 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${role.color}20` }}
                >
                  <Shield size={24} style={{ color: role.color || '#8B5CF6' }} />
                </div>
                <div className="flex items-center gap-2">
                  {role.is_system && (
                    <span className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">
                      Sistema
                    </span>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                        <MoreVertical size={16} className="text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenEdit(role)}>
                        <Edit3 size={14} className="mr-2" />
                        Editar
                      </DropdownMenuItem>
                      {!role.is_system && (
                        <DropdownMenuItem
                          onClick={() => handleDelete(role)}
                          className="text-destructive"
                        >
                          <Trash2 size={14} className="mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-foreground mb-1">{role.role_name}</h3>
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {role.description || 'Sem descrição'}
              </p>
              
              <p className="text-xs text-primary mb-4">
                {countEnabledPermissions(role.permissions as any)} permissões ativas
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users size={16} />
                  <span>{role.user_count || 0} usuários</span>
                </div>
                <button
                  onClick={() => handleOpenEdit(role)}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <Settings2 size={14} />
                  Permissões
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de criação/edição */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? 'Editar Perfil' : 'Novo Perfil'}
            </DialogTitle>
            <DialogDescription>
              Configure as informações e permissões do perfil
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-2">
            {/* Informações básicas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nome do Perfil *
                </label>
                <Input
                  value={form.role_name}
                  onChange={(e) => setForm({ ...form, role_name: e.target.value })}
                  placeholder="Ex: Supervisor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Chave (identificador) *
                </label>
                <Input
                  value={form.role_key}
                  onChange={(e) => setForm({ ...form, role_key: e.target.value })}
                  placeholder="Ex: supervisor"
                  disabled={!!editingRole}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Descrição
              </label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descreva as responsabilidades deste perfil..."
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Cor
              </label>
              <div className="flex gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color })}
                    className={`w-8 h-8 rounded-lg transition-all ${
                      form.color === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Permissões */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Shield size={16} />
                Permissões por Módulo
              </h4>

              <div className="space-y-2">
                {sortedCategories.map((category) => {
                  const permissions = permissionsByCategory[category];
                  const config = categoryConfig[category] || { 
                    label: category, 
                    icon: Shield,
                    order: 99 
                  };
                  const Icon = config.icon;
                  const isExpanded = expandedCategories.includes(category);
                  const enabledCount = permissions.filter(p => {
                    const key = p.permission_key.split('.')[1];
                    return form.permissions[category]?.[key] === true;
                  }).length;
                  const allEnabled = enabledCount === permissions.length;

                  return (
                    <div key={category} className="border border-border rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown size={18} className="text-muted-foreground" />
                          ) : (
                            <ChevronRight size={18} className="text-muted-foreground" />
                          )}
                          <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${form.color}20` }}
                          >
                            <Icon size={16} style={{ color: form.color }} />
                          </div>
                          <span className="font-medium text-foreground">
                            {config.label}
                          </span>
                          <span 
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              enabledCount > 0 
                                ? 'bg-primary/10 text-primary' 
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {enabledCount}/{permissions.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleAllCategory(category, permissions);
                            }}
                            className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                              allEnabled 
                                ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' 
                                : 'bg-primary/10 text-primary hover:bg-primary/20'
                            }`}
                          >
                            {allEnabled ? 'Remover Todos' : 'Liberar Todos'}
                          </button>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-4 bg-card border-t border-border">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {permissions.map((perm) => {
                              const key = perm.permission_key.split('.')[1];
                              const isEnabled = form.permissions[category]?.[key] === true;

                              return (
                                <label
                                  key={perm.id}
                                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                    isEnabled 
                                      ? 'border-primary bg-primary/5' 
                                      : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
                                  }`}
                                >
                                  <Checkbox
                                    checked={isEnabled}
                                    onCheckedChange={(checked) =>
                                      handlePermissionChange(category, key, checked === true)
                                    }
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium text-foreground block">
                                      {perm.permission_name}
                                    </span>
                                    {perm.description && (
                                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                        {perm.description}
                                      </p>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={createRole.isPending || updateRole.isPending}>
              {(createRole.isPending || updateRole.isPending) && (
                <Loader2 size={16} className="mr-2 animate-spin" />
              )}
              <Save size={16} className="mr-2" />
              {editingRole ? 'Salvar Alterações' : 'Criar Perfil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
