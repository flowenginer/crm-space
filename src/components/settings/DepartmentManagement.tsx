import { useState } from 'react';
import {
  Building2,
  Plus,
  Edit3,
  Trash2,
  Users,
  MoreVertical,
  Loader2,
  Save,
  Search,
  ChevronRight,
  UserPlus,
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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  Department,
} from '@/hooks/useDepartments';
import { useTeam } from '@/hooks/useTeam';

const colorOptions = [
  '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6',
  '#84CC16', '#F97316', '#06B6D4', '#A855F7'
];

const iconOptions = [
  'Building', 'Building2', 'Users', 'Headphones', 'ShoppingCart', 'CreditCard',
  'Settings', 'Megaphone', 'BarChart', 'Package', 'Truck', 'Heart'
];

export function DepartmentManagement() {
  const { data: departments = [], isLoading } = useDepartments();
  const { data: teamMembers = [] } = useTeam();
  
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const deleteDepartment = useDeleteDepartment();

  const [showModal, setShowModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [form, setForm] = useState({
    name: '',
    description: '',
    color: '#8B5CF6',
    icon: 'Building2',
    is_active: true,
  });

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenCreate = () => {
    setEditingDept(null);
    setForm({
      name: '',
      description: '',
      color: '#8B5CF6',
      icon: 'Building2',
      is_active: true,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (dept: Department) => {
    setEditingDept(dept);
    setForm({
      name: dept.name,
      description: dept.description || '',
      color: dept.color || '#8B5CF6',
      icon: dept.icon || 'Building2',
      is_active: dept.is_active ?? true,
    });
    setShowModal(true);
  };

  const handleViewMembers = (dept: Department) => {
    setSelectedDept(dept);
    setShowMembersModal(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      toast.error('Nome do departamento é obrigatório');
      return;
    }

    try {
      if (editingDept) {
        await updateDepartment.mutateAsync({
          id: editingDept.id,
          name: form.name,
          description: form.description || null,
          color: form.color,
          icon: form.icon,
          is_active: form.is_active,
        });
        toast.success('Departamento atualizado com sucesso');
      } else {
        await createDepartment.mutateAsync({
          name: form.name,
          description: form.description || null,
          color: form.color,
          icon: form.icon,
          is_active: form.is_active,
        });
        toast.success('Departamento criado com sucesso');
      }
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar departamento');
    }
  };

  const handleDelete = async (dept: Department) => {
    if (dept.member_count && dept.member_count > 0) {
      toast.error('Não é possível excluir um departamento com membros vinculados');
      return;
    }
    if (!confirm(`Tem certeza que deseja excluir o departamento "${dept.name}"?`)) return;

    try {
      await deleteDepartment.mutateAsync(dept.id);
      toast.success('Departamento excluído com sucesso');
    } catch (error) {
      toast.error('Erro ao excluir departamento');
    }
  };

  const handleToggleActive = async (dept: Department) => {
    try {
      await updateDepartment.mutateAsync({
        id: dept.id,
        is_active: !dept.is_active,
      });
      toast.success(`Departamento ${dept.is_active ? 'desativado' : 'ativado'}`);
    } catch (error) {
      toast.error('Erro ao atualizar departamento');
    }
  };

  const deptMembers = selectedDept
    ? teamMembers.filter(m => m.department_id === selectedDept.id)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Organize sua equipe em departamentos
        </p>
        <Button onClick={handleOpenCreate} className="btn-gradient">
          <Plus size={18} className="mr-2" />
          Novo Departamento
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar departamentos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredDepartments.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <Building2 size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {searchQuery ? 'Nenhum departamento encontrado' : 'Nenhum departamento cadastrado'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDepartments.map((dept) => (
            <div
              key={dept.id}
              className={`bg-card rounded-2xl border border-border p-6 shadow-sm hover:shadow-md transition-all ${
                !dept.is_active ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${dept.color}20` }}
                >
                  <Building2 size={24} style={{ color: dept.color || '#8B5CF6' }} />
                </div>
                <div className="flex items-center gap-2">
                  {!dept.is_active && (
                    <span className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">
                      Inativo
                    </span>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                        <MoreVertical size={16} className="text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenEdit(dept)}>
                        <Edit3 size={14} className="mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleViewMembers(dept)}>
                        <Users size={14} className="mr-2" />
                        Ver Membros
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleActive(dept)}>
                        {dept.is_active ? (
                          <>
                            <span className="w-3.5 h-3.5 mr-2 rounded-full bg-muted-foreground" />
                            Desativar
                          </>
                        ) : (
                          <>
                            <span className="w-3.5 h-3.5 mr-2 rounded-full bg-status-success" />
                            Ativar
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(dept)}
                        className="text-destructive"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-foreground mb-1">{dept.name}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {dept.description || 'Sem descrição'}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users size={16} />
                  <span>
                    {dept.member_count || 0} {dept.member_count === 1 ? 'membro' : 'membros'}
                  </span>
                </div>
                <button
                  onClick={() => handleViewMembers(dept)}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Ver mais
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de criação/edição */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDept ? 'Editar Departamento' : 'Novo Departamento'}
            </DialogTitle>
            <DialogDescription>
              Configure as informações do departamento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nome *
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Vendas"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Descrição
              </label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descreva as responsabilidades deste departamento..."
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Cor
              </label>
              <div className="flex flex-wrap gap-2">
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

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Departamento Ativo
                </label>
                <p className="text-xs text-muted-foreground">
                  Departamentos inativos não aparecem nas opções de seleção
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={createDepartment.isPending || updateDepartment.isPending}
            >
              {(createDepartment.isPending || updateDepartment.isPending) && (
                <Loader2 size={16} className="mr-2 animate-spin" />
              )}
              <Save size={16} className="mr-2" />
              {editingDept ? 'Salvar Alterações' : 'Criar Departamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de membros */}
      <Dialog open={showMembersModal} onOpenChange={setShowMembersModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${selectedDept?.color}20` }}
              >
                <Building2 size={16} style={{ color: selectedDept?.color || '#8B5CF6' }} />
              </div>
              {selectedDept?.name}
            </DialogTitle>
            <DialogDescription>
              {deptMembers.length} {deptMembers.length === 1 ? 'membro' : 'membros'} neste departamento
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {deptMembers.length === 0 ? (
              <div className="text-center py-8">
                <Users size={40} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Nenhum membro neste departamento</p>
                <Button variant="outline" size="sm" className="mt-4">
                  <UserPlus size={16} className="mr-2" />
                  Adicionar Membro
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {deptMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.full_name || ''}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-primary font-semibold">
                          {(member.full_name || 'U')[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {member.full_name || 'Sem nome'}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.role || 'Usuário'}</p>
                    </div>
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        member.is_online ? 'bg-status-success' : 'bg-muted-foreground'
                      }`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMembersModal(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
