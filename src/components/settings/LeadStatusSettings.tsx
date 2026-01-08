import { useState } from 'react';
import { Plus, Trash2, GripVertical, Loader2, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { useCreateLeadStatus, useUpdateLeadStatus, useDeleteLeadStatus } from '@/hooks/useLeadKanban';

const DEFAULT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
  '#6366F1', // indigo
];

export function LeadStatusSettings() {
  const { data: statuses = [], isLoading } = useLeadStatuses();
  const createStatus = useCreateLeadStatus();
  const updateStatus = useUpdateLeadStatus();
  const deleteStatus = useDeleteLeadStatus();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleStartEdit = (status: { id: string; name: string; color: string | null }) => {
    setEditingId(status.id);
    setEditName(status.name);
    setEditColor(status.color || DEFAULT_COLORS[0]);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;

    try {
      await updateStatus.mutateAsync({
        id: editingId,
        name: editName.trim(),
        color: editColor,
      });
      toast.success('Status atualizado com sucesso');
      setEditingId(null);
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditColor('');
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    try {
      await deleteStatus.mutateAsync(deleteConfirmId);
      toast.success('Status excluído com sucesso');
      setDeleteConfirmId(null);
    } catch {
      toast.error('Erro ao excluir status');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Status de Lead</CardTitle>
          <CardDescription>
            Configure os status disponíveis para organizar seus leads no kanban.
          </CardDescription>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="gap-2">
          <Plus size={16} />
          Novo Status
        </Button>
      </CardHeader>
      <CardContent>
        {statuses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum status cadastrado.</p>
            <p className="text-sm mt-1">Clique em "Novo Status" para começar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {statuses.map((status) => (
              <div
                key={status.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <GripVertical size={16} className="text-muted-foreground cursor-grab" />
                
                <div
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: status.color || DEFAULT_COLORS[0] }}
                />

                {editingId === status.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 h-8"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      {DEFAULT_COLORS.slice(0, 5).map((c) => (
                        <button
                          key={c}
                          onClick={() => setEditColor(c)}
                          className={cn(
                            'w-6 h-6 rounded-full border-2 transition-all',
                            editColor === c ? 'border-primary scale-110' : 'border-transparent'
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleSaveEdit}
                      disabled={updateStatus.isPending}
                    >
                      {updateStatus.isPending ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Check size={16} className="text-green-600" />
                      )}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={handleCancelEdit}>
                      <X size={16} className="text-muted-foreground" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium">{status.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleStartEdit(status)}
                    >
                      <Pencil size={16} className="text-muted-foreground" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleteConfirmId(status.id)}
                    >
                      <Trash2 size={16} className="text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add Status Modal */}
      <AddStatusModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        existingCount={statuses.length}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Status</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este status? Leads com este status serão movidos para "Sem Status".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteStatus.isPending ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function AddStatusModal({
  open,
  onOpenChange,
  existingCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCount: number;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLORS[existingCount % DEFAULT_COLORS.length]);
  const createStatus = useCreateLeadStatus();

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Digite um nome para o status');
      return;
    }

    try {
      await createStatus.mutateAsync({
        name: name.trim(),
        color,
        order_position: existingCount,
      });
      toast.success('Status criado com sucesso');
      setName('');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao criar status');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Status de Lead</DialogTitle>
          <DialogDescription>
            Crie um novo status para organizar seus leads no kanban.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="status-name">Nome do Status</Label>
            <Input
              id="status-name"
              placeholder="Ex: Qualificado, Em Negociação..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    color === c ? 'border-primary scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={createStatus.isPending}>
            {createStatus.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Criar Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
