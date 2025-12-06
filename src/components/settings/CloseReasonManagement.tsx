import { useState } from 'react';
import { useCloseReasons, useCreateCloseReason, useUpdateCloseReason, useDeleteCloseReason } from '@/hooks/useCloseReasons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Plus, Edit3, Trash2, Loader2, GripVertical, XCircle } from 'lucide-react';

const COLORS = [
  '#22C55E', '#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6',
  '#EC4899', '#14B8A6', '#6B7280', '#1F2937', '#0EA5E9',
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function CloseReasonManagement() {
  const { data: reasons = [], isLoading } = useCloseReasons();
  const createReason = useCreateCloseReason();
  const updateReason = useUpdateCloseReason();
  const deleteReason = useDeleteCloseReason();

  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', color: '#8B5CF6' });

  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm({ name: '', color: '#8B5CF6' });
    setShowModal(true);
  };

  const handleOpenEdit = (reason: any) => {
    setEditingItem(reason);
    setForm({ name: reason.name, color: reason.color });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    if (editingItem) {
      await updateReason.mutateAsync({
        id: editingItem.id,
        name: form.name,
        color: form.color,
      });
    } else {
      await createReason.mutateAsync({
        name: form.name,
        value: generateSlug(form.name),
        color: form.color,
      });
    }
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await deleteReason.mutateAsync(deletingId);
    setShowDeleteDialog(false);
    setDeletingId(null);
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    await updateReason.mutateAsync({ id, is_active: !currentActive });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Motivos de Fechamento</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os motivos disponíveis ao fechar uma conversa
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Motivo
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {reasons.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <XCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum motivo cadastrado</p>
              <Button variant="link" onClick={handleOpenCreate}>
                Criar primeiro motivo
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {reasons.map((reason) => (
                <div
                  key={reason.id}
                  className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: reason.color }}
                    />
                    <div className="min-w-0">
                      <p className={`font-medium truncate ${!reason.is_active ? 'text-muted-foreground line-through' : ''}`}>
                        {reason.name}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {reason.value}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={reason.is_active}
                      onCheckedChange={() => handleToggleActive(reason.id, reason.is_active)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(reason)}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setDeletingId(reason.id);
                        setShowDeleteDialog(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar Motivo' : 'Novo Motivo'}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? 'Altere as informações do motivo de fechamento'
                : 'Adicione um novo motivo de fechamento de conversa'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do motivo *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Venda realizada"
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color })}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      form.color === color
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110'
                        : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Pré-visualização</Label>
              <div className="p-3 bg-muted rounded-lg">
                <span
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-white"
                  style={{ backgroundColor: form.color }}
                >
                  {form.name || 'Nome do motivo'}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.name.trim() || createReason.isPending || updateReason.isPending}
            >
              {(createReason.isPending || updateReason.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {editingItem ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir motivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O motivo será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteReason.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
