import { Loader2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import type { CampaignContact } from '@/hooks/useMarketingDashboard';

interface CampaignContactsListProps {
  contacts: CampaignContact[] | undefined;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Ativo', variant: 'default' },
  responded: { label: 'Respondeu', variant: 'secondary' },
  completed: { label: 'Completou', variant: 'outline' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

export function CampaignContactsList({
  contacts,
  total,
  page,
  pageSize,
  onPageChange,
  isLoading,
}: CampaignContactsListProps) {
  const navigate = useNavigate();
  const totalPages = Math.ceil(total / pageSize);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!contacts || contacts.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Nenhum contato na campanha
      </div>
    );
  }

  const handleViewConversation = (conversationId: string | null) => {
    if (conversationId) {
      navigate(`/conversations?id=${conversationId}`);
    }
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contato</TableHead>
            <TableHead>Step Atual</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Entrou em</TableHead>
            <TableHead>Respondeu em</TableHead>
            <TableHead>Status Lead</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => {
            const status = statusConfig[contact.status] || statusConfig.active;

            return (
              <TableRow key={contact.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">{contact.contactName}</p>
                    <p className="text-xs text-muted-foreground">{contact.contactPhone}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {contact.currentStep + 1}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(parseISO(contact.createdAt), 'dd/MM/yy HH:mm', { locale: ptBR })}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {contact.respondedAt
                    ? format(parseISO(contact.respondedAt), 'dd/MM/yy HH:mm', { locale: ptBR })
                    : '-'
                  }
                </TableCell>
                <TableCell>
                  {contact.leadStatus ? (
                    <Badge variant="outline">{contact.leadStatus}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewConversation(contact.conversationId)}
                    disabled={!contact.conversationId}
                    className="h-8 px-2"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Ver conversa
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando {page * pageSize + 1} - {Math.min((page + 1) * pageSize, total)} de {total} contatos
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
