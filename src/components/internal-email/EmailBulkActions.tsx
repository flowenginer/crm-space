import { Archive, Mail, MailOpen, Star, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmailBulkActionsProps {
  selectedCount: number;
  onMarkAsRead: () => void;
  onMarkAsUnread: () => void;
  onToggleStar: () => void;
  onArchive: () => void;
  onMoveToTrash: () => void;
  onClearSelection: () => void;
  isLoading?: boolean;
}

export function EmailBulkActions({
  selectedCount,
  onMarkAsRead,
  onMarkAsUnread,
  onToggleStar,
  onArchive,
  onMoveToTrash,
  onClearSelection,
  isLoading
}: EmailBulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border-b animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="text-primary">{selectedCount}</span>
        <span className="text-muted-foreground">selecionado{selectedCount > 1 ? 's' : ''}</span>
      </div>
      
      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onMarkAsRead}
          disabled={isLoading}
          className="h-8 px-3 text-xs gap-1.5"
        >
          <MailOpen className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Marcar como lido</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onMarkAsUnread}
          disabled={isLoading}
          className="h-8 px-3 text-xs gap-1.5"
        >
          <Mail className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Marcar como não lido</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleStar}
          disabled={isLoading}
          className="h-8 px-3 text-xs gap-1.5"
        >
          <Star className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Favoritar</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onArchive}
          disabled={isLoading}
          className="h-8 px-3 text-xs gap-1.5"
        >
          <Archive className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Arquivar</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onMoveToTrash}
          disabled={isLoading}
          className="h-8 px-3 text-xs gap-1.5 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Excluir</span>
        </Button>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onClearSelection}
        className="h-8 w-8"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
