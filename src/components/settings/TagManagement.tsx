import { useState, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Tag, 
  Loader2,
  Check,
  Globe,
  Lock,
  Building2
} from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { SortableTagCard } from './SortableTagCard';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag, useReorderTags, Tag as TagType, TagVisibility } from '@/hooks/useTags';
import { useDepartments } from '@/hooks/useDepartments';
import { useContactsFilterCounts } from '@/hooks/usePaginatedContacts';

const predefinedColors = [
  '#8B5CF6', '#EC4899', '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#A855F7', '#64748B',
];

export function TagManagement() {
  const { data: tags = [], isLoading } = useTags();
  const { data: departments = [] } = useDepartments();
  const { data: filterCounts } = useContactsFilterCounts();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const reorderTags = useReorderTags();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Criar mapa de contagens reais das etiquetas
  const tagCountMap = useMemo(() => {
    const map = new Map<string, number>();
    if (filterCounts?.byTag) {
      Object.entries(filterCounts.byTag).forEach(([tagId, count]) => {
        map.set(tagId, count as number);
      });
    }
    return map;
  }, [filterCounts]);

  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<TagVisibility | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [form, setForm] = useState({
    name: '',
    color: '#8B5CF6',
    description: '',
    visibility: 'public' as TagVisibility,
    department_id: '',
  });

  const isSearchActive = searchQuery.length > 0 || visibilityFilter !== 'all';

  const filteredTags = tags.filter(tag => {
    const matchesSearch = tag.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVisibility = visibilityFilter === 'all' || tag.visibility === visibilityFilter;
    return matchesSearch && matchesVisibility;
  });

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filteredTags.findIndex(t => t.id === active.id);
    const newIndex = filteredTags.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(filteredTags, oldIndex, newIndex);
    const updates = reordered.map((tag, index) => ({
      id: tag.id,
      order_position: index + 1,
    }));
    reorderTags.mutate(updates);
  }, [filteredTags, reorderTags]);

  // Counters by visibility
  const publicCount = tags.filter(t => t.visibility === 'public').length;
  const privateCount = tags.filter(t => t.visibility === 'private').length;
  const departmentCount = tags.filter(t => t.visibility === 'department').length;

  const handleOpenModal = (tag?: TagType) => {
    if (tag) {
      setEditingTag(tag);
      setForm({
        name: tag.name,
        color: tag.color || '#8B5CF6',
        description: tag.description || '',
        visibility: tag.visibility || 'public',
        department_id: tag.department_id || '',
      });
    } else {
      setEditingTag(null);
      setForm({
        name: '',
        color: '#8B5CF6',
        description: '',
        visibility: 'public',
        department_id: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTag(null);
    setForm({ name: '', color: '#8B5CF6', description: '', visibility: 'public', department_id: '' });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Nome da etiqueta é obrigatório');
      return;
    }

    if (form.visibility === 'department' && !form.department_id) {
      toast.error('Selecione um departamento');
      return;
    }

    try {
      if (editingTag) {
        await updateTag.mutateAsync({
          id: editingTag.id,
          name: form.name.trim(),
          color: form.color,
          description: form.description.trim() || null,
          visibility: form.visibility,
          department_id: form.visibility === 'department' ? form.department_id : null,
        });
        toast.success('Etiqueta atualizada com sucesso');
      } else {
        await createTag.mutateAsync({
          name: form.name.trim(),
          color: form.color,
          description: form.description.trim() || null,
          visibility: form.visibility,
          department_id: form.visibility === 'department' ? form.department_id : null,
        });
        toast.success('Etiqueta criada com sucesso');
      }
      handleCloseModal();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Já existe uma etiqueta com este nome');
      } else {
        toast.error(error.message || 'Erro ao salvar etiqueta');
      }
    }
  };

  const handleDelete = async (tag: TagType) => {
    if (!confirm(`Tem certeza que deseja excluir a etiqueta "${tag.name}"?`)) return;

    try {
      await deleteTag.mutateAsync(tag.id);
      toast.success('Etiqueta excluída');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir etiqueta');
    }
  };

  const getVisibilityIcon = (visibility: TagVisibility) => {
    switch (visibility) {
      case 'private': return <Lock size={12} className="text-purple-500" />;
      case 'department': return <Building2 size={12} className="text-blue-500" />;
      default: return <Globe size={12} className="text-green-500" />;
    }
  };

  const getVisibilityLabel = (tag: TagType) => {
    switch (tag.visibility) {
      case 'private': return 'Privada';
      case 'department': return tag.department?.name || 'Departamento';
      default: return 'Pública';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Gerenciar Etiquetas</h2>
          <p className="text-muted-foreground text-sm">
            Crie e organize etiquetas para categorizar contatos e conversas
          </p>
        </div>
        <Button onClick={() => handleOpenModal()} className="flex items-center gap-2 btn-gradient">
          <Plus size={18} />
          Nova Etiqueta
        </Button>
      </div>

      {/* Visibility Stats - Clickable Filters */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setVisibilityFilter('all')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
            visibilityFilter === 'all'
              ? 'bg-primary/20 border border-primary/40 ring-2 ring-primary/20'
              : 'bg-muted/50 border border-border hover:bg-muted'
          }`}
        >
          <Tag size={14} className={visibilityFilter === 'all' ? 'text-primary' : 'text-muted-foreground'} />
          <span className={`text-sm font-medium ${visibilityFilter === 'all' ? 'text-primary' : 'text-muted-foreground'}`}>{tags.length}</span>
          <span className="text-xs text-muted-foreground">Todas</span>
        </button>
        <button
          onClick={() => setVisibilityFilter(visibilityFilter === 'public' ? 'all' : 'public')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
            visibilityFilter === 'public'
              ? 'bg-green-500/20 border border-green-500/40 ring-2 ring-green-500/20'
              : 'bg-green-500/10 border border-green-500/20 hover:bg-green-500/20'
          }`}
        >
          <Globe size={14} className="text-green-500" />
          <span className="text-sm text-green-500 font-medium">{publicCount}</span>
          <span className="text-xs text-muted-foreground">Públicas</span>
        </button>
        <button
          onClick={() => setVisibilityFilter(visibilityFilter === 'private' ? 'all' : 'private')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
            visibilityFilter === 'private'
              ? 'bg-purple-500/20 border border-purple-500/40 ring-2 ring-purple-500/20'
              : 'bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20'
          }`}
        >
          <Lock size={14} className="text-purple-500" />
          <span className="text-sm text-purple-500 font-medium">{privateCount}</span>
          <span className="text-xs text-muted-foreground">Privadas</span>
        </button>
        <button
          onClick={() => setVisibilityFilter(visibilityFilter === 'department' ? 'all' : 'department')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
            visibilityFilter === 'department'
              ? 'bg-blue-500/20 border border-blue-500/40 ring-2 ring-blue-500/20'
              : 'bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20'
          }`}
        >
          <Building2 size={14} className="text-blue-500" />
          <span className="text-sm text-blue-500 font-medium">{departmentCount}</span>
          <span className="text-xs text-muted-foreground">Departamento</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar etiquetas..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tags Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredTags.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <Tag size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {searchQuery ? 'Nenhuma etiqueta encontrada' : 'Nenhuma etiqueta cadastrada'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery 
              ? 'Tente buscar com outros termos' 
              : 'Crie sua primeira etiqueta para organizar seus contatos'}
          </p>
          {!searchQuery && (
            <Button onClick={() => handleOpenModal()} className="btn-gradient">
              <Plus size={18} className="mr-2" />
              Criar Etiqueta
            </Button>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredTags.map(t => t.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTags.map((tag) => (
                <SortableTagCard key={tag.id} id={tag.id} disabled={isSearchActive}>
                  <div className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-all group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${tag.color}20` }}
                        >
                          <Tag size={20} style={{ color: tag.color || '#8B5CF6' }} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{tag.name}</h3>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {getVisibilityIcon(tag.visibility)}
                            <span>{getVisibilityLabel(tag)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenModal(tag)}
                          className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                        >
                          <Edit3 size={14} className="text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDelete(tag)}
                          className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} className="text-destructive" />
                        </button>
                      </div>
                    </div>
                    
                    {tag.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {tag.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: tag.color || '#8B5CF6' }}
                      >
                        {tag.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {tagCountMap.get(tag.id) || 0} uso{(tagCountMap.get(tag.id) || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </SortableTagCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTag ? 'Editar Etiqueta' : 'Nova Etiqueta'}
            </DialogTitle>
            <DialogDescription>
              {editingTag 
                ? 'Atualize as informações da etiqueta' 
                : 'Crie uma nova etiqueta para organizar seus contatos e conversas'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nome da Etiqueta *
              </label>
              <Input
                placeholder="Ex: Cliente VIP, Urgente, Follow-up..."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Cor
              </label>
              <div className="flex flex-wrap gap-2">
                {predefinedColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setForm({ ...form, color })}
                    className="w-8 h-8 rounded-lg transition-all hover:scale-110 flex items-center justify-center"
                    style={{ backgroundColor: color }}
                  >
                    {form.color === color && (
                      <Check size={16} className="text-white" />
                    )}
                  </button>
                ))}
              </div>
              
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0"
                />
                <Input
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="flex-1 font-mono text-sm"
                  placeholder="#8B5CF6"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Descrição (opcional)
              </label>
              <Textarea
                placeholder="Descreva quando usar esta etiqueta..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Visibilidade
              </label>
              <div className="space-y-2">
                {/* Public Option */}
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer border-2 transition-colors ${
                    form.visibility === 'public' ? 'border-green-500' : 'border-transparent'
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={form.visibility === 'public'}
                    onChange={(e) => setForm({ ...form, visibility: e.target.value as TagVisibility })}
                    className="sr-only"
                  />
                  <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Globe size={18} className="text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm">Pública</div>
                    <div className="text-xs text-muted-foreground">Visível para toda a equipe</div>
                  </div>
                  {form.visibility === 'public' && <Check size={16} className="text-green-500 flex-shrink-0" />}
                </label>

                {/* Private Option */}
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer border-2 transition-colors ${
                    form.visibility === 'private' ? 'border-purple-500' : 'border-transparent'
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={form.visibility === 'private'}
                    onChange={(e) => setForm({ ...form, visibility: e.target.value as TagVisibility })}
                    className="sr-only"
                  />
                  <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <Lock size={18} className="text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm">Privada</div>
                    <div className="text-xs text-muted-foreground">Visível apenas para você</div>
                  </div>
                  {form.visibility === 'private' && <Check size={16} className="text-purple-500 flex-shrink-0" />}
                </label>

                {/* Department Option */}
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer border-2 transition-colors ${
                    form.visibility === 'department' ? 'border-blue-500' : 'border-transparent'
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value="department"
                    checked={form.visibility === 'department'}
                    onChange={(e) => setForm({ ...form, visibility: e.target.value as TagVisibility })}
                    className="sr-only"
                  />
                  <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Building2 size={18} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm">Departamento</div>
                    <div className="text-xs text-muted-foreground">Visível para o departamento selecionado</div>
                  </div>
                  {form.visibility === 'department' && <Check size={16} className="text-blue-500 flex-shrink-0" />}
                </label>
              </div>

              {/* Department Selector */}
              {form.visibility === 'department' && (
                <div className="mt-3">
                  <Select value={form.department_id} onValueChange={(value) => setForm({ ...form, department_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o departamento" />
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
              )}
            </div>

            {/* Preview */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Pré-visualização
              </label>
              <div className="bg-muted rounded-lg p-4 flex items-center gap-3">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white"
                  style={{ backgroundColor: form.color }}
                >
                  {form.name || 'Nome da etiqueta'}
                  {form.visibility === 'private' && <Lock size={12} />}
                  {form.visibility === 'department' && <Building2 size={12} />}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              className="btn-gradient"
              disabled={createTag.isPending || updateTag.isPending}
            >
              {(createTag.isPending || updateTag.isPending) ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : null}
              {editingTag ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TagManagement;
