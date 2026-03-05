import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRightLeft,
  XCircle,
  Tag,
  TrendingUp,
  RotateCcw,
  X,
  CheckCircle2,
  Megaphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConversationData {
  id: string;
  contact_id: string;
  status: string;
}

interface BulkActionsBarProps {
  selectedCount: number;
  selectedConversations: ConversationData[];
  onClearSelection: () => void;
  onTransfer: () => void;
  onClose: () => void;
  onAddTag: () => void;
  onChangeLeadStatus: () => void;
  onReopen: () => void;
  onRescue?: () => void;
  isLoading?: boolean;
  canTransferFreely?: boolean;
}

export function BulkActionsBar({
  selectedCount,
  selectedConversations,
  onClearSelection,
  onTransfer,
  onClose,
  onAddTag,
  onChangeLeadStatus,
  onReopen,
  onRescue,
  isLoading = false,
  canTransferFreely = true,
}: BulkActionsBarProps) {
  // Determine which actions are available based on conversation statuses
  const hasOpenConversations = selectedConversations.some(c => c.status === 'open' || c.status === 'pending');
  const hasClosedConversations = selectedConversations.some(c => c.status === 'closed');

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className={cn(
            "flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border",
            "bg-card/95 backdrop-blur-md border-border/50",
            "shadow-primary/10"
          )}>
            {/* Selection count */}
            <div className="flex items-center gap-2 pr-3 border-r border-border/50">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground whitespace-nowrap">
                {selectedCount} selecionado{selectedCount !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5">
              {canTransferFreely && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onTransfer}
                  disabled={isLoading}
                  className="gap-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10"
                >
                  <ArrowRightLeft size={14} />
                  <span className="hidden sm:inline">Transferir</span>
                </Button>
              )}

              {hasOpenConversations && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  disabled={isLoading}
                  className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <XCircle size={14} />
                  <span className="hidden sm:inline">Fechar</span>
                </Button>
              )}

              {hasClosedConversations && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReopen}
                  disabled={isLoading}
                  className="gap-1.5 text-muted-foreground hover:text-green-600 hover:bg-green-600/10"
                >
                  <RotateCcw size={14} />
                  <span className="hidden sm:inline">Reabrir</span>
                </Button>
              )}

              {onRescue && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRescue}
                  disabled={isLoading}
                  className="gap-1.5 text-muted-foreground hover:text-yellow-600 hover:bg-yellow-600/10"
                >
                  <Megaphone size={14} />
                  <span className="hidden sm:inline">Resgate</span>
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={onAddTag}
                disabled={isLoading}
                className="gap-1.5 text-muted-foreground hover:text-amber-600 hover:bg-amber-600/10"
              >
                <Tag size={14} />
                <span className="hidden sm:inline">Etiqueta</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onChangeLeadStatus}
                disabled={isLoading}
                className="gap-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-600/10"
              >
                <TrendingUp size={14} />
                <span className="hidden sm:inline">Status</span>
              </Button>
            </div>

            {/* Clear selection */}
            <div className="pl-2 border-l border-border/50">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClearSelection}
                disabled={isLoading}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
