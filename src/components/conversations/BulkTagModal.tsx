import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tag, Loader2, Check, Plus, Minus } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useBulkAddTag, useBulkRemoveTag } from '@/hooks/useBulkConversationActions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BulkTagModalProps {
  open: boolean;
  onClose: () => void;
  contactIds: string[];
  onSuccess?: () => void;
}

type TagAction = 'add' | 'remove';

export function BulkTagModal({
  open,
  onClose,
  contactIds,
  onSuccess,
}: BulkTagModalProps) {
  const [action, setAction] = useState<TagAction>('add');
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const bulkAddTag = useBulkAddTag();
  const bulkRemoveTag = useBulkRemoveTag();

  const { data: tags = [], isLoading: isLoadingTags } = useQuery({
    queryKey: ['tags-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleApply = async () => {
    if (!selectedTagId) {
      toast.error('Selecione uma etiqueta');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const mutation = action === 'add' ? bulkAddTag : bulkRemoveTag;
      const result = await mutation.mutateAsync({
        contactIds,
        tagId: selectedTagId,
      });

      clearInterval(progressInterval);
      setProgress(100);

      const selectedTag = tags.find(t => t.id === selectedTagId);
      const actionText = action === 'add' ? 'aplicada' : 'removida';

      if (result.success > 0 && result.failed === 0) {
        toast.success(`Etiqueta "${selectedTag?.name}" ${actionText} em ${result.success} contato(s)`);
      } else if (result.success > 0 && result.failed > 0) {
        toast.warning(`${result.success} sucesso, ${result.failed} falha(s)`);
      } else {
        toast.error('Falha ao processar etiquetas');
      }

      onSuccess?.();
      handleModalClose();
    } catch (error: any) {
      clearInterval(progressInterval);
      console.error('[BulkTagModal] Error:', error);
      toast.error('Erro ao processar etiquetas', {
        description: error?.message || 'Tente novamente.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleModalClose = () => {
    if (isProcessing) return;
    setAction('add');
    setSelectedTagId('');
    setSearchQuery('');
    setProgress(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border-b border-border/50 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Tag className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">Gerenciar Etiquetas</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {contactIds.length} contato(s) selecionado(s)
              </p>
            </div>
          </div>
        </DialogHeader>

        {isProcessing ? (
          <div className="p-8 space-y-4">
            <div className="flex flex-col items-center justify-center text-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <div>
                <p className="font-semibold text-foreground">
                  {action === 'add' ? 'Aplicando' : 'Removendo'} etiqueta...
                </p>
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
              {/* Action type */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-foreground">Ação</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAction('add')}
                    className={cn(
                      'relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200',
                      action === 'add'
                        ? 'border-amber-500 bg-gradient-to-br from-amber-500/10 to-orange-500/10 shadow-lg shadow-amber-500/10'
                        : 'border-border hover:border-amber-500/50 hover:bg-muted/50'
                    )}
                  >
                    {action === 'add' && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0',
                      action === 'add'
                        ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      <Plus size={16} />
                    </div>
                    <div className="text-left min-w-0">
                      <p className={cn(
                        'text-sm font-medium',
                        action === 'add' ? 'text-amber-600' : 'text-foreground'
                      )}>
                        Adicionar
                      </p>
                      <p className="text-xs text-muted-foreground">Aplicar etiqueta</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setAction('remove')}
                    className={cn(
                      'relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200',
                      action === 'remove'
                        ? 'border-amber-500 bg-gradient-to-br from-amber-500/10 to-orange-500/10 shadow-lg shadow-amber-500/10'
                        : 'border-border hover:border-amber-500/50 hover:bg-muted/50'
                    )}
                  >
                    {action === 'remove' && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0',
                      action === 'remove'
                        ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      <Minus size={16} />
                    </div>
                    <div className="text-left min-w-0">
                      <p className={cn(
                        'text-sm font-medium',
                        action === 'remove' ? 'text-amber-600' : 'text-foreground'
                      )}>
                        Remover
                      </p>
                      <p className="text-xs text-muted-foreground">Remover etiqueta</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Tag selection */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Tag size={14} className="text-amber-500" />
                  Selecione a etiqueta
                </Label>
                
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar etiqueta..."
                  className="h-9"
                />

                {isLoadingTags ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma etiqueta encontrada
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                    {filteredTags.map((tag) => {
                      const isSelected = selectedTagId === tag.id;
                      return (
                        <button
                          key={tag.id}
                          onClick={() => setSelectedTagId(isSelected ? '' : tag.id)}
                          className={cn(
                            'relative flex items-center justify-between p-2.5 rounded-lg border-2 transition-all duration-200',
                            isSelected
                              ? 'border-amber-500 bg-gradient-to-r from-amber-500/10 to-orange-500/10 shadow-md ring-2 ring-amber-500/20'
                              : 'border-border hover:border-amber-500/50 hover:bg-muted/50'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div 
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: tag.color || '#F59E0B' }}
                            />
                            <span className={cn(
                              'text-sm font-medium truncate',
                              isSelected ? 'text-amber-600' : 'text-foreground'
                            )}>
                              {tag.name}
                            </span>
                          </div>
                          {isSelected && (
                            <Check size={14} className="text-amber-500 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
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
            disabled={isProcessing || !selectedTagId}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-500/90 hover:to-orange-600/90"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                {action === 'add' ? <Plus className="h-4 w-4 mr-2" /> : <Minus className="h-4 w-4 mr-2" />}
                {action === 'add' ? 'Adicionar' : 'Remover'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
