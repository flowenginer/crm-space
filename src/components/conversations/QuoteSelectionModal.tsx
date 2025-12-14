import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  Plus, 
  Eye, 
  RefreshCw,
  Calendar,
  DollarSign,
  User,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useContactHistory, ContactQuote } from '@/hooks/useContactHistory';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  sent: { label: 'Enviado', variant: 'default' },
  approved: { label: 'Aprovado', variant: 'default' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
  expired: { label: 'Expirado', variant: 'outline' },
  converted: { label: 'Convertido', variant: 'default' },
};

interface QuoteSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  contactName?: string;
  onSelectQuote: (quote: ContactQuote) => void;
  onCreateNew: () => void;
  onReopenQuote: (quote: ContactQuote) => void;
}

export function QuoteSelectionModal({
  open,
  onOpenChange,
  contactId,
  contactName,
  onSelectQuote,
  onCreateNew,
  onReopenQuote,
}: QuoteSelectionModalProps) {
  const [activeTab, setActiveTab] = useState<'view' | 'reopen'>('view');
  const { quotes, isLoading } = useContactHistory(contactId);

  const formatCurrency = (value: number | null) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  // Separate quotes by status for reopen tab
  const activeQuotes = quotes.filter(q => !['rejected', 'expired', 'converted'].includes(q.status));
  const reopenableQuotes = quotes.filter(q => ['rejected', 'expired'].includes(q.status));

  const displayQuotes = activeTab === 'view' ? quotes : reopenableQuotes;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Orçamentos {contactName && `de ${contactName}`}
          </DialogTitle>
          <DialogDescription>
            Escolha uma opção para continuar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action Buttons */}
          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="default"
              className="w-full justify-start gap-3 h-14"
              onClick={() => {
                onCreateNew();
                onOpenChange(false);
              }}
            >
              <Plus className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">Criar novo orçamento</p>
                <p className="text-xs text-primary-foreground/70">Iniciar um orçamento do zero</p>
              </div>
            </Button>
          </div>

          {/* Tabs for view/reopen */}
          {quotes.length > 0 && (
            <>
              <div className="flex gap-2 border-b border-border">
                <button
                  onClick={() => setActiveTab('view')}
                  className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                    activeTab === 'view' 
                      ? 'text-primary border-b-2 border-primary' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Eye className="h-4 w-4 inline mr-1" />
                  Ver existentes ({quotes.length})
                </button>
                {reopenableQuotes.length > 0 && (
                  <button
                    onClick={() => setActiveTab('reopen')}
                    className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                      activeTab === 'reopen' 
                        ? 'text-primary border-b-2 border-primary' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <RefreshCw className="h-4 w-4 inline mr-1" />
                    Reabrir ({reopenableQuotes.length})
                  </button>
                )}
              </div>

              {/* Quote List */}
              <ScrollArea className="h-[300px]">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : displayQuotes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <FileText className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">
                      {activeTab === 'reopen' 
                        ? 'Nenhum orçamento para reabrir' 
                        : 'Nenhum orçamento encontrado'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 pr-2">
                    {displayQuotes.map((quote) => (
                      <button
                        key={quote.id}
                        onClick={() => {
                          if (activeTab === 'reopen') {
                            onReopenQuote(quote);
                          } else {
                            onSelectQuote(quote);
                          }
                          onOpenChange(false);
                        }}
                        className="w-full p-3 bg-muted/50 hover:bg-muted rounded-lg transition-colors text-left group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                #{quote.quote_number}
                              </span>
                              <Badge 
                                variant={statusConfig[quote.status]?.variant || 'secondary'}
                                className="text-xs"
                              >
                                {statusConfig[quote.status]?.label || quote.status}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                              </span>
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {formatCurrency(quote.total)}
                              </span>
                              {quote.seller_profile?.full_name && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {quote.seller_profile.full_name.split(' ')[0]}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          )}

          {/* Empty state - no quotes */}
          {!isLoading && quotes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <FileText className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">Este cliente ainda não tem orçamentos</p>
              <p className="text-xs mt-1">Clique no botão acima para criar o primeiro</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
