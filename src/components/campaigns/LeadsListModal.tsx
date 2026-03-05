import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  User,
  Phone,
  Calendar,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';

export interface LeadInfo {
  id: string;
  fullName: string;
  phone: string;
  status: string;
  statusColor: string;
  segment?: string;
  negotiatedValue: number;
  createdAt: string;
  wasResponded?: boolean;
  tags?: { name: string; color: string }[];
}

interface LeadsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  leads: LeadInfo[];
  isLoading?: boolean;
  onLeadClick?: (leadId: string) => void;
}

const PAGE_SIZE = 15;

export function LeadsListModal({
  isOpen,
  onClose,
  title,
  subtitle,
  leads,
  isLoading,
  onLeadClick,
}: LeadsListModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  // Filter leads by search term
  const filteredLeads = leads.filter((lead) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      lead.fullName.toLowerCase().includes(searchLower) ||
      lead.phone.includes(searchTerm) ||
      lead.status.toLowerCase().includes(searchLower)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredLeads.length / PAGE_SIZE);
  const paginatedLeads = filteredLeads.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );

  const formatCurrency = (value: number) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '-';
    // Format: +55 (11) 99999-9999
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 12) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return phone;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </DialogHeader>

        {/* Search and Stats */}
        <div className="flex items-center justify-between gap-4 py-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou status..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(0);
              }}
              className="pl-9"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''} encontrado{filteredLeads.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Table */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="h-[400px] flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : paginatedLeads.length === 0 ? (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum lead encontrado</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Etiquetas</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onLeadClick?.(lead.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium">{lead.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span className="text-sm">{formatPhone(lead.phone)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: lead.statusColor,
                          color: lead.statusColor,
                          backgroundColor: `${lead.statusColor}15`,
                        }}
                      >
                        {lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {lead.segment || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {lead.tags && lead.tags.length > 0 ? (
                          lead.tags.map((tag, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs"
                              style={{
                                borderColor: tag.color,
                                color: tag.color,
                                backgroundColor: `${tag.color}15`,
                              }}
                            >
                              {tag.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={lead.negotiatedValue > 0 ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
                        {formatCurrency(lead.negotiatedValue)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground text-sm">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(lead.createdAt), 'dd/MM/yy HH:mm', { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLeadClick?.(lead.id);
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Página {currentPage + 1} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage === totalPages - 1}
              >
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
