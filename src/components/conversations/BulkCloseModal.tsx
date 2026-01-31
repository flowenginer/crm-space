import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { XCircle, Loader2, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useBulkCloseConversations } from '@/hooks/useBulkConversationActions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BulkCloseModalProps {
  open: boolean;
  onClose: () => void;
  conversationIds: string[];
  onSuccess?: () => void;
}

export function BulkCloseModal({
  open,
  onClose,
  conversationIds,
  onSuccess,
}: BulkCloseModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const bulkClose = useBulkCloseConversations();

  const { data: closeReasons = [], isLoading: isLoadingReasons } = useQuery({
    queryKey: ['close-reasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('close_reasons')
        .select('*')
        .eq('is_active', true)
        .order('order_position');
      if (error) throw error;
      return data || [];
    },
  });

  const handleClose = async () => {
    setIsProcessing(true);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const result = await bulkClose.mutateAsync({
        conversationIds,
        closeReason: selectedReason || undefined,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (result.success > 0 && result.failed === 0) {
        toast.success(`${result.success} conversa(s) fechada(s) com sucesso`);
      } else if (result.success > 0 && result.failed > 0) {
        toast.warning(`${result.success} fechada(s), ${result.failed} falhou(aram)`);
      } else {
        toast.error('Falha ao fechar conversas');
      }

      onSuccess?.();
      handleModalClose();
    } catch (error: any) {
      clearInterval(progressInterval);
      console.error('[BulkCloseModal] Error:', error);
      toast.error('Erro ao fechar conversas', {
        description: error?.message || 'Tente novamente.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleModalClose = () => {
    if (isProcessing) return;
    setSelectedReason('');
    setProgress(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-destructive/10 via-red-500/10 to-destructive/5 border-b border-border/50 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-destructive to-red-600 flex items-center justify-center shadow-lg shadow-destructive/25">
              <XCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">Fechar Conversas</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {conversationIds.length} conversa(s) selecionada(s)
              </p>
            </div>
          </div>
        </DialogHeader>

        {isProcessing ? (
          <div className="p-8 space-y-4">
            <div className="flex flex-col items-center justify-center text-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-destructive" />
              <div>
                <p className="font-semibold text-foreground">Fechando conversas...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Aguarde enquanto processamos
                </p>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        ) : (
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-foreground">
                  Motivo do fechamento (opcional)
                </Label>
                {isLoadingReasons ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {closeReasons.map((reason) => {
                      const isSelected = selectedReason === reason.value;
                      return (
                        <button
                          key={reason.id}
                          onClick={() => setSelectedReason(isSelected ? '' : reason.value)}
                          className={cn(
                            'relative flex items-center justify-between p-2.5 rounded-lg border-2 transition-all duration-200',
                            isSelected
                              ? 'border-destructive bg-gradient-to-r from-destructive/10 to-red-500/10 shadow-md ring-2 ring-destructive/20'
                              : 'border-border hover:border-destructive/50 hover:bg-muted/50'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div 
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: reason.color || '#EF4444' }}
                            />
                            <span className={cn(
                              'text-sm font-medium truncate',
                              isSelected ? 'text-destructive' : 'text-foreground'
                            )}>
                              {reason.name}
                            </span>
                          </div>
                          {isSelected && (
                            <Check size={14} className="text-destructive flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  ⚠️ Esta ação fechará todas as conversas selecionadas. 
                  Conversas fechadas podem ser reabertas posteriormente.
                </p>
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="p-4 border-t border-border/50 flex-shrink-0">
          <Button
            variant="outline"
            onClick={handleModalClose}
            disabled={isProcessing}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleClose}
            disabled={isProcessing}
            className="bg-gradient-to-r from-destructive to-red-600 hover:from-destructive/90 hover:to-red-600/90"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Fechando...
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-2" />
                Fechar {conversationIds.length}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
