import { useState } from 'react';
import {
  Shield,
  Plus,
  Edit3,
  Trash2,
  Users,
  MoreVertical,
  Loader2,
  Settings2,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole, RoleDefinition } from '@/hooks/useRoles';
import { MenuPermissionsTree } from './MenuPermissionsTree';

const colorOptions = [
  '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'
];

export function RoleManagement() {
  const { data: roles = [], isLoading: loadingRoles } = useRoles();
  
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  
  const [form, setForm] = useState({
    role_key: '',
    role_name: '',
    description: '',
    color: '#8B5CF6',
    permissions: {} as Record<string, Record<string, boolean>>,
    menuPermissions: {} as Record<string, boolean>,
  });

  const handleOpenCreate = () => {
    setEditingRole(null);
    setForm({
      role_key: '',
      role_name: '',
      description: '',
      color: '#8B5CF6',
      permissions: {},
      menuPermissions: {},
    });
    setShowModal(true);
  };

  const handleOpenEdit = (role: RoleDefinition) => {
    setEditingRole(role);
    const rolePerms = (role.permissions || {}) as Record<string, any>;
    // Extrair menuPermissions se existir, senão usar objeto vazio
    const menuPerms = rolePerms.menu || {};
    setForm({
      role_key: role.role_key,
      role_name: role.role_name,
      description: role.description || '',
      color: role.color || '#8B5CF6',
      permissions: rolePerms as Record<string, Record<string, boolean>>,
      menuPermissions: menuPerms as Record<string, boolean>,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.role_name || !form.role_key) {
      toast.error('Nome e chave do perfil são obrigatórios');
      return;
    }

    // Converter menuPermissions para formato estruturado category.action
    // Isso garante compatibilidade com o sistema de permissões
    const structuredPermissions: Record<string, Record<string, boolean>> = {};
    
    Object.entries(form.menuPermissions).forEach(([key, value]) => {
      // key pode ser "templates.view", "dashboard.view", etc
      const parts = key.split('.');
      if (parts.length === 2) {
        const [category, action] = parts;
        if (!structuredPermissions[category]) {
          structuredPermissions[category] = {};
        }
        structuredPermissions[category][action] = value;
      }
    });

    // Combinar permissões estruturadas + manter formato menu para compatibilidade
    const combinedPermissions = {
      ...form.permissions,
      ...structuredPermissions,
      menu: form.menuPermissions,
    };

    try {
      if (editingRole) {
        await updateRole.mutateAsync({
          id: editingRole.id,
          role_name: form.role_name,
          description: form.description || null,
          color: form.color,
          permissions: combinedPermissions,
        });
        toast.success('Perfil atualizado com sucesso');
      } else {
        await createRole.mutateAsync({
          role_key: form.role_key.toLowerCase().replace(/\s+/g, '_'),
          role_name: form.role_name,
          description: form.description || null,
          color: form.color,
          icon: 'User',
          permissions: combinedPermissions,
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

  const isLoading = loadingRoles;

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

            {/* Permissões baseadas no Menu */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Shield size={16} />
                Acesso aos Módulos
              </h4>
              <p className="text-xs text-muted-foreground mb-4">
                Configure quais módulos e funcionalidades este perfil terá acesso. A estrutura segue o menu lateral.
              </p>

              <div className="border border-border rounded-xl p-4">
                <MenuPermissionsTree
                  permissions={form.menuPermissions}
                  onChange={(newPerms) => setForm(prev => ({ ...prev, menuPermissions: newPerms }))}
                  color={form.color}
                />
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
