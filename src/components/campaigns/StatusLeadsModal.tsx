import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLeadsByStatus } from '@/hooks/useMetaAdsAnalytics';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MessageSquare, ExternalLink, Image as ImageIcon } from 'lucide-react';

interface StatusLeadsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusName: string | null;
  statusColor?: string;
  dateRange?: { from: Date; to: Date };
}

export function StatusLeadsModal({
  open,
  onOpenChange,
  statusName,
  statusColor,
  dateRange,
}: StatusLeadsModalProps) {
  const navigate = useNavigate();
  const { data: leads, isLoading } = useLeadsByStatus(statusName, dateRange);

  const handleOpenConversation = (conversationId: string) => {
    navigate(`/conversations?id=${conversationId}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: statusColor || '#8B5CF6' }}
            />
            Leads em "{statusName === 'new' ? 'Novo' : statusName}"
            {leads && (
              <Badge variant="secondary">{leads.length} leads</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !leads || leads.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <p>Nenhum lead encontrado neste status</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Anúncio</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.conversationId}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{lead.contactName || 'Sem nome'}</p>
                        <p className="text-xs text-muted-foreground">{lead.contactPhone}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {lead.thumbnailUrl ? (
                          <img
                            src={lead.thumbnailUrl}
                            alt="Preview"
                            className="w-8 h-8 rounded object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="text-sm truncate max-w-[200px]">
                          {lead.headline || lead.sourceId?.slice(0, 15) + '...' || 'Sem info'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(lead.createdAt), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenConversation(lead.conversationId)}
                        className="gap-1.5"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
