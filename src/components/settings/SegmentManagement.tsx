import { useState, useMemo } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Layers, 
  Loader2,
  Check,
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
import { 
  useAllSegments, 
  useCreateSegment, 
  useUpdateSegment, 
  useDeleteSegment,
  useSegmentCounts,
  Segment 
} from '@/hooks/useSegments';

const predefinedColors = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F97316', '#EAB308', 
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6', '#A855F7', '#64748B',
];

export function SegmentManagement() {
  const { data: segments = [], isLoading } = useAllSegments();
  const { data: segmentCounts = {} } = useSegmentCounts();
  const createSegment = useCreateSegment();
  const updateSegment = useUpdateSegment();
  const deleteSegment = useDeleteSegment();

  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [form, setForm] = useState({
    name: '',
    color: '#6366F1',
    description: '',
  });

  const filteredSegments = useMemo(() => {
    return segments.filter(segment =>
      segment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      segment.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [segments, searchQuery]);

  const handleOpenModal = (segment?: Segment) => {
    if (segment) {
      setEditingSegment(segment);
      setForm({
        name: segment.name,
        color: segment.color || '#6366F1',
        description: segment.description || '',
      });
    } else {
      setEditingSegment(null);
      setForm({
        name: '',
        color: '#6366F1',
        description: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSegment(null);
    setForm({ name: '', color: '#6366F1', description: '' });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Nome do segmento é obrigatório');
      return;
    }

    try {
      if (editingSegment) {
        await updateSegment.mutateAsync({
          id: editingSegment.id,
          name: form.name.trim(),
          color: form.color,
          description: form.description.trim() || null,
        });
        toast.success('Segmento atualizado com sucesso');
      } else {
        await createSegment.mutateAsync({
          name: form.name.trim(),
          color: form.color,
          description: form.description.trim() || null,
        });
        toast.success('Segmento criado com sucesso');
      }
      handleCloseModal();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Já existe um segmento com este nome');
      } else {
        toast.error(error.message || 'Erro ao salvar segmento');
      }
    }
  };

  const handleDelete = async (segment: Segment) => {
    const count = segmentCounts[segment.id] || 0;
    const message = count > 0 
      ? `Este segmento está sendo usado por ${count} contato(s). Tem certeza que deseja excluí-lo?`
      : `Tem certeza que deseja excluir o segmento "${segment.name}"?`;
    
    if (!confirm(message)) return;

    try {
      await deleteSegment.mutateAsync(segment.id);
      toast.success('Segmento excluído');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir segmento');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Gerenciar Segmentos</h2>
          <p className="text-muted-foreground text-sm">
            Crie segmentos para classificar leads por área de atuação (energia solar, construção, agro, etc.)
          </p>
        </div>
        <Button onClick={() => handleOpenModal()} className="flex items-center gap-2 btn-gradient">
          <Plus size={18} />
          Novo Segmento
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
          <Layers size={14} className="text-primary" />
          <span className="text-sm font-medium text-primary">{segments.length}</span>
          <span className="text-xs text-muted-foreground">segmentos</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar segmentos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Segments Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredSegments.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <Layers size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {searchQuery ? 'Nenhum segmento encontrado' : 'Nenhum segmento cadastrado'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery 
              ? 'Tente buscar com outros termos' 
              : 'Crie seu primeiro segmento para classificar seus leads'}
          </p>
          {!searchQuery && (
            <Button onClick={() => handleOpenModal()} className="btn-gradient">
              <Plus size={18} className="mr-2" />
              Criar Segmento
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSegments.map((segment) => (
            <div
              key={segment.id}
              className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${segment.color}20` }}
                  >
                    <Layers size={20} style={{ color: segment.color || '#6366F1' }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{segment.name}</h3>
                    <span className="text-xs text-muted-foreground">
                      {segmentCounts[segment.id] || 0} lead{(segmentCounts[segment.id] || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleOpenModal(segment)}
                    className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                  >
                    <Edit3 size={14} className="text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleDelete(segment)}
                    className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} className="text-destructive" />
                  </button>
                </div>
              </div>
              
              {segment.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {segment.description}
                </p>
              )}

              <div className="flex items-center justify-between">
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: segment.color || '#6366F1' }}
                >
                  {segment.name}
                </span>
                {!segment.is_active && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    Inativo
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSegment ? 'Editar Segmento' : 'Novo Segmento'}
            </DialogTitle>
            <DialogDescription>
              {editingSegment 
                ? 'Atualize as informações do segmento' 
                : 'Crie um novo segmento para classificar seus leads por área de atuação'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nome do Segmento *
              </label>
              <Input
                placeholder="Ex: Energia Solar, Construção, Agro..."
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
                  placeholder="#6366F1"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Descrição (opcional)
              </label>
              <Textarea
                placeholder="Descreva este segmento..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>

            {/* Preview */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Pré-visualização
              </label>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${form.color}20` }}
                >
                  <Layers size={20} style={{ color: form.color }} />
                </div>
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: form.color }}
                >
                  {form.name || 'Nome do Segmento'}
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
              disabled={createSegment.isPending || updateSegment.isPending}
              className="btn-gradient"
            >
              {(createSegment.isPending || updateSegment.isPending) && (
                <Loader2 size={16} className="mr-2 animate-spin" />
              )}
              {editingSegment ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
