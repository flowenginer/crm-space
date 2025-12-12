import { useState } from 'react';
import { Quote, useUpdateQuoteStatus } from '@/hooks/useQuotes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface QuoteKanbanProps {
  quotes: Quote[];
  onViewQuote: (quote: Quote) => void;
}

const statusColumns = [
  { status: 'draft', label: 'Rascunho', color: 'bg-gray-500' },
  { status: 'sent', label: 'Enviado', color: 'bg-blue-500' },
  { status: 'approved', label: 'Aprovado', color: 'bg-green-500' },
  { status: 'rejected', label: 'Rejeitado', color: 'bg-red-500' },
  { status: 'converted', label: 'Convertido', color: 'bg-purple-500' },
];

export function QuoteKanban({ quotes, onViewQuote }: QuoteKanbanProps) {
  const updateStatus = useUpdateQuoteStatus();
  const [draggedQuote, setDraggedQuote] = useState<Quote | null>(null);

  const formatCurrency = (value: number | null) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const handleDragStart = (quote: Quote) => {
    setDraggedQuote(quote);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetStatus: string) => {
    if (draggedQuote && draggedQuote.status !== targetStatus) {
      // Não permitir alteração de status para orçamentos convertidos
      if (draggedQuote.status === 'converted') {
        setDraggedQuote(null);
        return;
      }
      
      await updateStatus.mutateAsync({
        quoteId: draggedQuote.id,
        status: targetStatus,
      });
    }
    setDraggedQuote(null);
  };

  const getContactName = (quote: Quote) => {
    if (quote.contact?.full_name) {
      const names = quote.contact.full_name.split(' ');
      return names.length > 1 ? `${names[0]} ${names[names.length - 1]}` : names[0];
    }
    return 'Sem cliente';
  };

  const isExpired = (quote: Quote) => {
    return quote.valid_until && new Date(quote.valid_until) < new Date();
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {statusColumns.map((column) => {
        const columnQuotes = quotes.filter((q) => q.status === column.status);
        
        return (
          <div
            key={column.status}
            className="flex-shrink-0 w-[280px]"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(column.status)}
          >
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${column.color}`} />
                    {column.label}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {columnQuotes.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <div className="space-y-2 pr-2">
                    {columnQuotes.map((quote) => (
                      <Card
                        key={quote.id}
                        className={`cursor-grab active:cursor-grabbing ${
                          quote.status !== 'converted' ? 'hover:border-primary/50' : ''
                        }`}
                        draggable={quote.status !== 'converted'}
                        onDragStart={() => handleDragStart(quote)}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {quote.quote_number}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => onViewQuote(quote)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span className="truncate">{getContactName(quote)}</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-primary">
                              {formatCurrency(quote.total)}
                            </span>
                            {quote.valid_until && (
                              <div className={`flex items-center gap-1 text-xs ${
                                isExpired(quote) ? 'text-destructive' : 'text-muted-foreground'
                              }`}>
                                <Calendar className="h-3 w-3" />
                                {format(new Date(quote.valid_until), 'dd/MM')}
                              </div>
                            )}
                          </div>

                          {quote.created_at && (
                            <p className="text-[10px] text-muted-foreground">
                              Criado em {format(new Date(quote.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}

                    {columnQuotes.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Nenhum orçamento
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
