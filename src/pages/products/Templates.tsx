import { useState } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  LayoutTemplate,
  Package,
  Scale,
  Ruler,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { TemplateModal } from '@/components/products/TemplateModal';
import {
  useProductTemplates,
  useDeleteProductTemplate,
  useUpdateProductTemplate,
} from '@/hooks/useProductTemplates';

export default function Templates() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Bulk selection
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  const { data: templates, isLoading } = useProductTemplates();
  const deleteTemplate = useDeleteProductTemplate();
  const updateTemplate = useUpdateProductTemplate();

  const filteredTemplates = templates?.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (id: string) => {
    setEditingTemplate(id);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (deletingId) {
      await deleteTemplate.mutateAsync(deletingId);
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    await updateTemplate.mutateAsync({ id, is_active: !currentStatus });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTemplate(null);
  };

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (selectedTemplates.length === (filteredTemplates?.length || 0)) {
      setSelectedTemplates([]);
    } else {
      setSelectedTemplates(filteredTemplates?.map(t => t.id) || []);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedTemplates(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id) 
        : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    let deleted = 0;
    for (const id of selectedTemplates) {
      try {
        await deleteTemplate.mutateAsync(id);
        deleted++;
      } catch (e) {
        console.error('Error deleting template', id, e);
      }
    }
    setSelectedTemplates([]);
    setShowBulkDeleteDialog(false);
    toast.success(`${deleted} template(s) excluído(s)`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LayoutTemplate className="h-6 w-6 text-primary" />
            Templates de Produto
          </h1>
          <p className="text-muted-foreground">
            Configure modelos para agilizar o cadastro de produtos com variações pré-definidas
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Template
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Templates</CardTitle>
            <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates Ativos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {templates?.filter((t) => t.is_active).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates Inativos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {templates?.filter((t) => !t.is_active).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={(filteredTemplates?.length || 0) > 0 && selectedTemplates.length === (filteredTemplates?.length || 0)}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-center">Peso (kg)</TableHead>
              <TableHead className="text-center">Dimensões (cm)</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-[120px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : filteredTemplates?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum template encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredTemplates?.map((template) => (
                <TableRow key={template.id}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedTemplates.includes(template.id)}
                      onCheckedChange={() => handleSelectOne(template.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {template.description || '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Scale className="h-3 w-3 text-muted-foreground" />
                      {template.default_weight_kg || 0}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Ruler className="h-3 w-3 text-muted-foreground" />
                      {template.default_height_cm || 0} x {template.default_width_cm || 0} x {template.default_length_cm || 0}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <button
                      onClick={() => handleToggleStatus(template.id, template.is_active)}
                      className="flex items-center gap-1.5 mx-auto"
                    >
                      {template.is_active ? (
                        <>
                          <ToggleRight className="h-5 w-5 text-green-500" />
                          <span className="text-sm text-green-600">Ativo</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Inativo</span>
                        </>
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(template.id)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeletingId(template.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Modal */}
      <TemplateModal
        open={isModalOpen}
        onOpenChange={handleCloseModal}
        templateId={editingTemplate}
      />

      {/* Bulk Selection Bar */}
      {selectedTemplates.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border shadow-lg rounded-lg px-4 py-3 flex items-center gap-4">
          <span className="text-sm font-medium">{selectedTemplates.length} selecionado(s)</span>
          <Button variant="ghost" size="sm" onClick={() => setSelectedTemplates([])}>
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
          <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir {selectedTemplates.length} template(s)?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Os templates serão removidos permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBulkDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir Todos
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O template será removido permanentemente.
              Os produtos que utilizam este template não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
