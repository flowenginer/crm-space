import { useMemo } from 'react';
import { AlertTriangle, Clock, FileText, ChevronRight } from 'lucide-react';
import { ContactQuote } from '@/hooks/useContactHistory';
import { differenceInDays, parseISO } from 'date-fns';

interface QuotePendingAlertProps {
  quotes: ContactQuote[];
  onViewQuote: (quoteId: string) => void;
}

interface PendingQuote {
  quote: ContactQuote;
  type: 'expiring' | 'waiting' | 'draft';
  message: string;
}

export function QuotePendingAlert({ quotes, onViewQuote }: QuotePendingAlertProps) {
  const pendingQuotes = useMemo(() => {
    const now = new Date();
    const pending: PendingQuote[] = [];

    quotes.forEach((quote) => {
      // Check for quotes expiring soon (< 3 days)
      if (quote.valid_until && ['sent', 'draft'].includes(quote.status)) {
        const validUntil = parseISO(quote.valid_until);
        const daysUntilExpiry = differenceInDays(validUntil, now);
        
        if (daysUntilExpiry >= 0 && daysUntilExpiry <= 3) {
          pending.push({
            quote,
            type: 'expiring',
            message: daysUntilExpiry === 0 
              ? 'Expira hoje!' 
              : `Expira em ${daysUntilExpiry} dia${daysUntilExpiry > 1 ? 's' : ''}`,
          });
          return;
        }
      }

      // Check for sent quotes waiting response (> 7 days)
      if (quote.status === 'sent') {
        const sentDate = parseISO(quote.created_at);
        const daysSinceSent = differenceInDays(now, sentDate);
        
        if (daysSinceSent >= 7) {
          pending.push({
            quote,
            type: 'waiting',
            message: `Aguardando há ${daysSinceSent} dias`,
          });
          return;
        }
      }

      // Check for old drafts (> 24 hours)
      if (quote.status === 'draft') {
        const createdDate = parseISO(quote.created_at);
        const daysSinceCreated = differenceInDays(now, createdDate);
        
        if (daysSinceCreated >= 1) {
          pending.push({
            quote,
            type: 'draft',
            message: 'Rascunho não enviado',
          });
          return;
        }
      }
    });

    // Sort by urgency: expiring > waiting > draft
    const priority = { expiring: 0, waiting: 1, draft: 2 };
    return pending.sort((a, b) => priority[a.type] - priority[b.type]);
  }, [quotes]);

  if (pendingQuotes.length === 0) {
    return null;
  }

  const getAlertStyles = (type: PendingQuote['type']) => {
    switch (type) {
      case 'expiring':
        return {
          bg: 'bg-red-50 dark:bg-red-900/20',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-700 dark:text-red-400',
          icon: 'text-red-500',
        };
      case 'waiting':
        return {
          bg: 'bg-amber-50 dark:bg-amber-900/20',
          border: 'border-amber-200 dark:border-amber-800',
          text: 'text-amber-700 dark:text-amber-400',
          icon: 'text-amber-500',
        };
      case 'draft':
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-700 dark:text-blue-400',
          icon: 'text-blue-500',
        };
    }
  };

  const getIcon = (type: PendingQuote['type']) => {
    switch (type) {
      case 'expiring':
        return <AlertTriangle className="h-3 w-3" />;
      case 'waiting':
        return <Clock className="h-3 w-3" />;
      case 'draft':
        return <FileText className="h-3 w-3" />;
    }
  };

  // Get the most urgent alert type for the header
  const headerType = pendingQuotes[0].type;
  const headerStyles = getAlertStyles(headerType);

  return (
    <div className={`mx-3 mb-2 rounded-lg border ${headerStyles.border} ${headerStyles.bg} overflow-hidden`}>
      <div className="px-3 py-2">
        <div className={`flex items-center gap-1.5 text-xs font-medium ${headerStyles.text}`}>
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Orçamentos Pendentes ({pendingQuotes.length})</span>
        </div>
      </div>
      
      <div className="border-t border-inherit bg-background/50">
        {pendingQuotes.slice(0, 3).map((item) => {
          const styles = getAlertStyles(item.type);
          return (
            <button
              key={item.quote.id}
              onClick={() => onViewQuote(item.quote.id)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors border-b border-border/50 last:border-b-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={styles.icon}>
                  {getIcon(item.type)}
                </span>
                <span className="text-xs font-medium text-foreground truncate">
                  #{item.quote.quote_number}
                </span>
                <span className={`text-xs ${styles.text}`}>
                  {item.message}
                </span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </button>
          );
        })}
        
        {pendingQuotes.length > 3 && (
          <div className="px-3 py-1.5 text-center">
            <span className="text-xs text-muted-foreground">
              +{pendingQuotes.length - 3} mais
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
