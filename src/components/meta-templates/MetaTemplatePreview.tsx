import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Pause, 
  Ban,
  FileText,
  MessageSquare,
  MousePointerClick,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  type MetaMessageTemplate,
  getTemplateBody,
  getTemplateHeader,
  getTemplateFooter,
} from '@/hooks/useMetaTemplates';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MetaTemplatePreviewProps {
  template: MetaMessageTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MetaTemplatePreview({ template, open, onOpenChange }: MetaTemplatePreviewProps) {
  if (!template) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'PENDING': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'REJECTED': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'PAUSED': return <Pause className="h-4 w-4 text-orange-500" />;
      case 'DISABLED': return <Ban className="h-4 w-4 text-muted-foreground" />;
      default: return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'Aprovado';
      case 'PENDING': return 'Pendente';
      case 'REJECTED': return 'Rejeitado';
      case 'PAUSED': return 'Pausado';
      case 'DISABLED': return 'Desativado';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-500/20 text-green-500 border-green-500/30';
      case 'PENDING': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      case 'REJECTED': return 'bg-red-500/20 text-red-500 border-red-500/30';
      case 'PAUSED': return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
      case 'DISABLED': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'MARKETING': return 'bg-purple-500/20 text-purple-500 border-purple-500/30';
      case 'UTILITY': return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      case 'AUTHENTICATION': return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const buttonsComponent = template.components.find(c => c.type === 'BUTTONS');
  const headerComponent = template.components.find(c => c.type === 'HEADER');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {template.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status and Category */}
          <div className="flex flex-wrap gap-2">
            <Badge 
              variant="outline" 
              className={cn('flex items-center gap-1', getStatusColor(template.status))}
            >
              {getStatusIcon(template.status)}
              {getStatusLabel(template.status)}
            </Badge>
            <Badge 
              variant="outline" 
              className={getCategoryColor(template.category)}
            >
              {template.category}
            </Badge>
            <Badge variant="outline">
              {template.language}
            </Badge>
            {template.quality_score && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                Qualidade: {template.quality_score}
              </Badge>
            )}
          </div>

          {/* Rejection Reason */}
          {template.status === 'REJECTED' && template.rejection_reason && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
              <p className="text-sm font-medium text-red-500 mb-1">Motivo da Rejeição:</p>
              <p className="text-sm text-red-400">{template.rejection_reason}</p>
            </div>
          )}

          {/* Template Preview */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 border-b">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Pré-visualização da Mensagem
              </span>
            </div>
            <div className="p-4 space-y-3">
              {/* Header */}
              {getTemplateHeader(template.components) && (
                <div className="font-semibold">
                  {headerComponent?.format === 'IMAGE' && (
                    <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center mb-2">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  {getTemplateHeader(template.components)}
                </div>
              )}

              {/* Body */}
              <div className="text-sm whitespace-pre-wrap">
                {getTemplateBody(template.components)}
              </div>

              {/* Footer */}
              {getTemplateFooter(template.components) && (
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  {getTemplateFooter(template.components)}
                </div>
              )}

              {/* Buttons */}
              {buttonsComponent?.buttons && buttonsComponent.buttons.length > 0 && (
                <div className="pt-2 border-t space-y-2">
                  {buttonsComponent.buttons.map((button, idx) => (
                    <Button 
                      key={idx}
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-center gap-2"
                      disabled
                    >
                      <MousePointerClick className="h-3.5 w-3.5" />
                      {button.text}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="text-xs text-muted-foreground space-y-1">
            {template.meta_template_id && (
              <p>ID Meta: {template.meta_template_id}</p>
            )}
            {template.last_synced_at && (
              <p>
                Última sincronização:{' '}
                {format(new Date(template.last_synced_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
            <p>
              Criado em:{' '}
              {format(new Date(template.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
