import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, GripVertical, Package, Clock, CheckCircle, Truck, XCircle, FileEdit, Loader, PackageCheck, Flag, AlertTriangle } from 'lucide-react';
import { 
  useOrderStatuses, 
  useCreateOrderStatus, 
  useUpdateOrderStatus, 
  useDeleteOrderStatus,
  useReorderOrderStatuses,
  OrderStatus 
} from '@/hooks/useOrderStatuses';

const AVAILABLE_ICONS = [
  { value: 'Package', label: 'Pacote', icon: Package },
  { value: 'Clock', label: 'Relógio', icon: Clock },
  { value: 'CheckCircle', label: 'Check', icon: CheckCircle },
  { value: 'Truck', label: 'Caminhão', icon: Truck },
  { value: 'XCircle', label: 'Cancelado', icon: XCircle },
  { value: 'FileEdit', label: 'Rascunho', icon: FileEdit },
  { value: 'Loader', label: 'Processando', icon: Loader },
  { value: 'PackageCheck', label: 'Entregue', icon: PackageCheck },
  { value: 'Flag', label: 'Bandeira', icon: Flag },
  { value: 'AlertTriangle', label: 'Alerta', icon: AlertTriangle },
];

const COLORS = [
  '#6b7280', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#f97316'
];

function getIconComponent(iconName: string) {
  const found = AVAILABLE_ICONS.find(i => i.value === iconName);
  return found?.icon || Package;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function OrderStatusManagement() {
  const { data: statuses = [], isLoading } = useOrderStatuses();
  const createStatus = useCreateOrderStatus();
  const updateStatus = useUpdateOrderStatus();
  const deleteStatus = useDeleteOrderStatus();
  const reorderStatuses = useReorderOrderStatuses();

  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<OrderStatus | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({ 
    name: '', 
    color: '#3b82f6', 
    icon: 'Package',
    is_final: false,
    can_edit_order: true
  });
  const [draggedItem, setDraggedItem] = useState<OrderStatus | null>(null);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm({ name: '', color: '#3b82f6', icon: 'Package', is_final: false, can_edit_order: true });
    setShowModal(true);
  };

  const handleOpenEdit = (status: OrderStatus) => {
    setEditingItem(status);
    setForm({ 
      name: status.name, 
      color: status.color, 
      icon: status.icon,
      is_final: status.is_final,
      can_edit_order: status.can_edit_order
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    if (editingItem) {
      await updateStatus.mutateAsync({
        id: editingItem.id,
        name: form.name,
        color: form.color,
        icon: form.icon,
        is_final: form.is_final,
        can_edit_order: form.can_edit_order,
      });
    } else {
      await createStatus.mutateAsync({
        name: form.name,
        value: generateSlug(form.name),
        color: form.color,
        icon: form.icon,
        is_final: form.is_final,
        can_edit_order: form.can_edit_order,
      });
    }
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (deletingId) {
      await deleteStatus.mutateAsync(deletingId);
      setShowDeleteDialog(false);
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (status: OrderStatus) => {
    await updateStatus.mutateAsync({
      id: status.id,
      is_active: !status.is_active,
    });
  };

  const handleDragStart = (status: OrderStatus) => {
    setDraggedItem(status);
  };

  const handleDragOver = (e: React.DragEvent, targetStatus: OrderStatus) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetStatus.id) return;
  };

  const handleDrop = async (targetStatus: OrderStatus) => {
    if (!draggedItem || draggedItem.id === targetStatus.id) return;

    const oldIndex = statuses.findIndex(s => s.id === draggedItem.id);
    const newIndex = statuses.findIndex(s => s.id === targetStatus.id);

    const reordered = [...statuses];
    reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, draggedItem);

    const updates = reordered.map((item, index) => ({
      id: item.id,
      order_position: index + 1,
    }));

    await reorderStatuses.mutateAsync(updates);
    setDraggedItem(null);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Status de Pedidos</h3>
          <p className="text-sm text-muted-foreground">
            Configure os status disponíveis para pedidos. Arraste para reordenar.
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Status
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {statuses.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum status cadastrado. Clique em "Novo Status" para adicionar.
            </div>
          ) : (
            <div className="divide-y">
              {statuses.map((status) => {
                const IconComponent = getIconComponent(status.icon);
                return (
                  <div
                    key={status.id}
                    draggable
                    onDragStart={() => handleDragStart(status)}
                    onDragOver={(e) => handleDragOver(e, status)}
                    onDrop={() => handleDrop(status)}
                    className={`flex items-center gap-4 p-4 hover:bg-muted/50 cursor-move ${
                      draggedItem?.id === status.id ? 'opacity-50' : ''
                    }`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: status.color }}
                    >
                      <IconComponent className="h-4 w-4 text-white" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{status.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {status.value}
                        </Badge>
                        {status.is_final && (
                          <Badge variant="secondary" className="text-xs">
                            Final
                          </Badge>
                        )}
                        {!status.can_edit_order && (
                          <Badge variant="outline" className="text-xs text-orange-500 border-orange-500">
                            Bloqueado
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <Switch
                      checked={status.is_active}
                      onCheckedChange={() => handleToggleActive(status)}
                    />
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(status)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDeletingId(status.id);
                        setShowDeleteDialog(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Criar/Editar */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar Status' : 'Novo Status'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Status</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Em Preparação"
              />
            </div>

            <div className="space-y-2">
              <Label>Ícone</Label>
              <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ICONS.map((icon) => {
                    const Icon = icon.icon;
                    return (
                      <SelectItem key={icon.value} value={icon.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{icon.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      form.color === color ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Status Final</Label>
                <p className="text-xs text-muted-foreground">
                  Marcar como status final (entregue, cancelado, etc.)
                </p>
              </div>
              <Switch
                checked={form.is_final}
                onCheckedChange={(v) => setForm({ ...form, is_final: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Permite Editar Pedido</Label>
                <p className="text-xs text-muted-foreground">
                  Permitir edição do pedido neste status
                </p>
              </div>
              <Switch
                checked={form.can_edit_order}
                onCheckedChange={(v) => setForm({ ...form, can_edit_order: v })}
              />
            </div>

            {/* Preview */}
            <div className="pt-4 border-t">
              <Label className="mb-2 block">Preview</Label>
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: form.color }}
                >
                  {(() => {
                    const Icon = getIconComponent(form.icon);
                    return <Icon className="h-4 w-4 text-white" />;
                  })()}
                </div>
                <span className="font-medium">{form.name || 'Nome do Status'}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>
              {editingItem ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Status</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este status? Esta ação não pode ser desfeita.
              Certifique-se de que não há pedidos usando este status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
