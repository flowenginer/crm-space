import { useState } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Tag, 
  Loader2,
  X,
  Check
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
import { toast } from 'sonner';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag, Tag as TagType } from '@/hooks/useTags';

const predefinedColors = [
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#A855F7', // Violet
  '#64748B', // Slate
];

export function TagManagement() {
  const { data: tags = [], isLoading } = useTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [form, setForm] = useState({
    name: '',
    color: '#8B5CF6',
    description: '',
  });

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenModal = (tag?: TagType) => {
    if (tag) {
      setEditingTag(tag);
      setForm({
        name: tag.name,
        color: tag.color || '#8B5CF6',
        description: tag.description || '',
      });
    } else {
      setEditingTag(null);
      setForm({
        name: '',
        color: '#8B5CF6',
        description: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTag(null);
    setForm({ name: '', color: '#8B5CF6', description: '' });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Nome da etiqueta é obrigatório');
      return;
    }

    try {
      if (editingTag) {
        await updateTag.mutateAsync({
          id: editingTag.id,
          name: form.name.trim(),
          color: form.color,
          description: form.description.trim() || null,
        });
        toast.success('Etiqueta atualizada com sucesso');
      } else {
        await createTag.mutateAsync({
          name: form.name.trim(),
          color: form.color,
          description: form.description.trim() || null,
        });
        toast.success('Etiqueta criada com sucesso');
      }
      handleCloseModal();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar etiqueta');
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
        <Button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 btn-gradient"
        >
          <Plus size={18} />
          Nova Etiqueta
        </Button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTags.map((tag) => (
            <div
              key={tag.id}
              className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-all group"
            >
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
                    <p className="text-xs text-muted-foreground">
                      {tag.usage_count || 0} uso{(tag.usage_count || 0) !== 1 ? 's' : ''}
                    </p>
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
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {tag.description}
                </p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: tag.color || '#8B5CF6' }}
                >
                  {tag.name}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
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
              
              {/* Custom color input */}
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
                rows={3}
              />
            </div>

            {/* Preview */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Pré-visualização
              </label>
              <div className="bg-muted rounded-lg p-4 flex items-center gap-3">
                <span
                  className="px-3 py-1.5 rounded-full text-sm font-medium text-white"
                  style={{ backgroundColor: form.color }}
                >
                  {form.name || 'Nome da etiqueta'}
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
