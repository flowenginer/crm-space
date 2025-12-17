import { useState } from 'react';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Clock,
  MessageSquare,
  UserRoundPlus,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  useRescueTemplates,
  useDeleteRescueTemplate,
  type RescueTemplate,
} from '@/hooks/useRescueTemplates';
import { RescueTemplateModal } from '@/components/rescue/RescueTemplateModal';

export default function RescueTemplates() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RescueTemplate | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useRescueTemplates();
  const deleteTemplate = useDeleteRescueTemplate();

  const filteredTemplates = templates.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const handleEdit = (template: RescueTemplate) => {
    setEditingTemplate(template);
    setShowModal(true);
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTemplateId) return;
    try {
      await deleteTemplate.mutateAsync(deleteTemplateId);
      toast.success('Template excluído!');
      setDeleteTemplateId(null);
    } catch (error) {
      toast.error('Erro ao excluir template');
    }
  };

  const formatTimer = (minutes: number): string => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins}min`;
  };

  const getFinalActionLabel = (template: RescueTemplate): string => {
    switch (template.final_action) {
      case 'close':
        return 'Fechar conversa';
      case 'transfer':
        return 'Transferir';
      case 'none':
      default:
        return 'Nenhuma';
    }
  };

  return (
    <div className="flex h-[calc(100vh-72px)]">
      {/* Main Content */}
      <div className="flex-1 bg-background flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserRoundPlus size={24} className="text-primary" />
            <h1 className="text-xl font-bold text-foreground">
              Templates de Resgate
            </h1>
            <Badge variant="secondary" className="font-medium">
              {filteredTemplates.length}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>

            <Button onClick={handleNewTemplate} size="sm">
              <Plus size={16} className="mr-1" />
              NOVO TEMPLATE
            </Button>
          </div>
        </div>

        {/* Table */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-8" />
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-20" />
                    </div>
                  ))}
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="p-8 text-center">
                  <UserRoundPlus size={48} className="mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum template criado</h3>
                  <p className="text-muted-foreground mb-4">
                    Crie templates de resgate para recuperar leads inativos automaticamente.
                  </p>
                  <Button onClick={handleNewTemplate}>
                    <Plus size={16} className="mr-1" />
                    Criar Template
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead className="w-48">Título</TableHead>
                      <TableHead>Mensagens</TableHead>
                      <TableHead className="w-32 text-center">Timers</TableHead>
                      <TableHead className="w-32 text-center">Ação Final</TableHead>
                      <TableHead className="w-24 text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTemplates.map((template, index) => (
                      <TableRow key={template.id} className="group">
                        <TableCell className="text-center text-muted-foreground font-mono text-sm">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-foreground">
                            {template.title}
                          </div>
                          {template.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {template.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MessageSquare size={14} className="text-muted-foreground" />
                            <span className="text-sm">
                              {template.steps.length} mensagem(ns)
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 truncate max-w-[300px]">
                            {template.steps[0]?.message.substring(0, 50)}...
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Clock size={14} className="text-muted-foreground" />
                            <span className="text-sm">
                              {template.steps.map(s => formatTimer(s.timer_minutes)).join(' → ')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {getFinalActionLabel(template)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(template)}
                            >
                              <Edit3 size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTemplateId(template.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Template Modal */}
      <RescueTemplateModal
        open={showModal}
        onOpenChange={setShowModal}
        template={editingTemplate}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O template será desativado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTemplate.isPending}
            >
              {deleteTemplate.isPending && <Loader2 size={14} className="mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
