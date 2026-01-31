import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Loader2, Check } from 'lucide-react';
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
import { useBulkUpdateLeadStatus } from '@/hooks/useBulkConversationActions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BulkLeadStatusModalProps {
  open: boolean;
  onClose: () => void;
  contactIds: string[];
  onSuccess?: () => void;
}

export function BulkLeadStatusModal({
  open,
  onClose,
  contactIds,
  onSuccess,
}: BulkLeadStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const bulkUpdateStatus = useBulkUpdateLeadStatus();

  const { data: leadStatuses = [], isLoading: isLoadingStatuses } = useQuery({
    queryKey: ['lead-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*')
        .eq('is_active', true)
        .order('order_position');
      if (error) throw error;
      return data || [];
    },
  });

  const handleApply = async () => {
    if (!selectedStatus) {
      toast.error('Selecione um status');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const result = await bulkUpdateStatus.mutateAsync({
        contactIds,
        leadStatus: selectedStatus,
      });

      clearInterval(progressInterval);
      setProgress(100);

      const statusObj = leadStatuses.find(s => s.name === selectedStatus);

      if (result.success > 0 && result.failed === 0) {
        toast.success(`Status "${statusObj?.name}" aplicado em ${result.success} contato(s)`);
      } else if (result.success > 0 && result.failed > 0) {
        toast.warning(`${result.success} sucesso, ${result.failed} falha(s)`);
      } else {
        toast.error('Falha ao atualizar status');
      }

      onSuccess?.();
      handleModalClose();
    } catch (error: any) {
      clearInterval(progressInterval);
      console.error('[BulkLeadStatusModal] Error:', error);
      toast.error('Erro ao atualizar status', {
        description: error?.message || 'Tente novamente.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleModalClose = () => {
    if (isProcessing) return;
    setSelectedStatus('');
    setProgress(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/5 border-b border-border/50 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">Alterar Status do Lead</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {contactIds.length} contato(s) selecionado(s)
              </p>
            </div>
          </div>
        </DialogHeader>

        {isProcessing ? (
          <div className="p-8 space-y-4">
            <div className="flex flex-col items-center justify-center text-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <div>
                <p className="font-semibold text-foreground">Atualizando status...</p>
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
                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp size={14} className="text-blue-500" />
                  Selecione o novo status
                </Label>

                {isLoadingStatuses ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : leadStatuses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum status disponível
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {leadStatuses.map((status) => {
                      const isSelected = selectedStatus === status.name;
                      return (
                        <button
                          key={status.id}
                          onClick={() => setSelectedStatus(isSelected ? '' : status.name)}
                          className={cn(
                            'relative flex items-center justify-between p-2.5 rounded-lg border-2 transition-all duration-200',
                            isSelected
                              ? 'border-blue-500 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 shadow-md ring-2 ring-blue-500/20'
                              : 'border-border hover:border-blue-500/50 hover:bg-muted/50'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div 
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: status.color || '#3B82F6' }}
                            />
                            <span className={cn(
                              'text-sm font-medium truncate',
                              isSelected ? 'text-blue-600' : 'text-foreground'
                            )}>
                              {status.name}
                            </span>
                          </div>
                          {isSelected && (
                            <Check size={14} className="text-blue-500 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  ℹ️ O status do lead será atualizado em todos os contatos selecionados.
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
            onClick={handleApply}
            disabled={isProcessing || !selectedStatus}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-500/90 hover:to-indigo-600/90"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Atualizando...
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4 mr-2" />
                Aplicar Status
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
