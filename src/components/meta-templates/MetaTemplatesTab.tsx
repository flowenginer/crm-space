import { useState } from 'react';
import { 
  RefreshCw, 
  Plus, 
  Eye, 
  Trash2, 
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Pause,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
import { 
  useMetaTemplates, 
  useSyncMetaTemplates, 
  useDeleteMetaTemplate,
  type MetaMessageTemplate 
} from '@/hooks/useMetaTemplates';
import { MetaTemplateModal } from './MetaTemplateModal';
import { MetaTemplatePreview } from './MetaTemplatePreview';

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'APPROVED':
      return (
        <Badge className="bg-green-500/20 text-green-500 border-green-500/30 hover:bg-green-500/30">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Aprovado
        </Badge>
      );
    case 'PENDING':
      return (
        <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/30">
          <Clock className="w-3 h-3 mr-1" />
          Pendente
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge className="bg-red-500/20 text-red-500 border-red-500/30 hover:bg-red-500/30">
          <XCircle className="w-3 h-3 mr-1" />
          Rejeitado
        </Badge>
      );
    case 'PAUSED':
      return (
        <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30 hover:bg-orange-500/30">
          <Pause className="w-3 h-3 mr-1" />
          Pausado
        </Badge>
      );
    case 'DISABLED':
      return (
        <Badge className="bg-muted text-muted-foreground hover:bg-muted/80">
          <AlertCircle className="w-3 h-3 mr-1" />
          Desativado
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    MARKETING: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
    UTILITY: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    AUTHENTICATION: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
  };
  
  return (
    <Badge variant="outline" className={cn('text-xs', colors[category] || 'bg-muted')}>
      {category}
    </Badge>
  );
}

export function MetaTemplatesTab() {
  const { data: templates = [], isLoading } = useMetaTemplates();
  const syncMutation = useSyncMetaTemplates();
  const deleteMutation = useDeleteMetaTemplate();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<MetaMessageTemplate | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<MetaMessageTemplate | null>(null);

  const handleDelete = async () => {
    if (!deleteTemplate) return;
    try {
      await deleteMutation.mutateAsync({ 
        templateId: deleteTemplate.id,
        templateName: deleteTemplate.name 
      });
      setDeleteTemplate(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleSync = () => {
    syncMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Templates da API Oficial</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie seus templates aprovados pela Meta para envio de mensagens via API Cloud
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleSync}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', syncMutation.isPending && 'animate-spin')} />
            Sincronizar
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">Nenhum template encontrado</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Sincronize seus templates existentes da Meta ou crie novos templates 
            que serão enviados para aprovação.
          </p>
          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', syncMutation.isPending && 'animate-spin')} />
              Sincronizar da Meta
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Novo
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Idioma</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Qualidade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>{template.language}</TableCell>
                  <TableCell>
                    <CategoryBadge category={template.category} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={template.status} />
                  </TableCell>
                  <TableCell>
                    {template.quality_score ? (
                      <Badge variant="outline" className="text-xs">
                        {template.quality_score}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setPreviewTemplate(template)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTemplate(template)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <MetaTemplateModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal} 
      />

      <MetaTemplatePreview
        template={previewTemplate}
        open={!!previewTemplate}
        onOpenChange={() => setPreviewTemplate(null)}
      />

      <AlertDialog open={!!deleteTemplate} onOpenChange={() => setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o template "{deleteTemplate?.name}"? 
              Esta ação irá remover o template tanto localmente quanto na Meta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
