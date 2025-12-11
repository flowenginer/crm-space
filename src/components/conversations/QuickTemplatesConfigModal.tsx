import { useState, useMemo } from 'react';
import { X, Plus, Search, Trash2, GripVertical, Star } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTemplates, type MessageTemplate } from '@/hooks/useTemplates';
import { 
  useUserQuickTemplates, 
  useAddQuickTemplate, 
  useRemoveQuickTemplate 
} from '@/hooks/useQuickTemplates';
import { toast } from 'sonner';

interface QuickTemplatesConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SLOT_POSITIONS = [1, 2, 3, 4, 5];

export function QuickTemplatesConfigModal({ open, onOpenChange }: QuickTemplatesConfigModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const { data: quickTemplates = [], isLoading: quickLoading } = useUserQuickTemplates();
  const { data: allTemplates = [], isLoading: templatesLoading } = useTemplates('messages');
  const addQuickTemplate = useAddQuickTemplate();
  const removeQuickTemplate = useRemoveQuickTemplate();

  // Get template for each slot
  const slotTemplates = useMemo(() => {
    const map = new Map<number, typeof quickTemplates[0]>();
    quickTemplates.forEach(qt => {
      map.set(qt.position, qt);
    });
    return map;
  }, [quickTemplates]);

  // Filter templates for search
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return allTemplates.slice(0, 20);
    const query = searchQuery.toLowerCase();
    return allTemplates.filter(t => 
      t.title.toLowerCase().includes(query)
    ).slice(0, 20);
  }, [allTemplates, searchQuery]);

  // Get already used template IDs
  const usedTemplateIds = useMemo(() => {
    return new Set(quickTemplates.map(qt => qt.template_id));
  }, [quickTemplates]);

  const handleAddToSlot = async (template: MessageTemplate, position: number) => {
    try {
      await addQuickTemplate.mutateAsync({ templateId: template.id, position });
      toast.success(`"${template.title}" adicionado ao slot ${position}`);
      setSelectedSlot(null);
      setSearchQuery('');
    } catch (error) {
      toast.error('Erro ao adicionar atalho rápido');
    }
  };

  const handleRemoveFromSlot = async (position: number) => {
    try {
      await removeQuickTemplate.mutateAsync(position);
      toast.success('Atalho removido');
    } catch (error) {
      toast.error('Erro ao remover atalho');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            Configurar Atalhos Rápidos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info text */}
          <p className="text-sm text-muted-foreground">
            Configure até 5 mensagens favoritas para acesso rápido. Clique em um slot vazio para adicionar.
          </p>

          {/* Slots grid */}
          <div className="grid grid-cols-5 gap-2">
            {SLOT_POSITIONS.map((position) => {
              const qt = slotTemplates.get(position);
              const isSelected = selectedSlot === position;

              return (
                <div
                  key={position}
                  className={cn(
                    'relative aspect-square rounded-lg border-2 border-dashed transition-all cursor-pointer group',
                    qt 
                      ? 'border-primary/50 bg-primary/5' 
                      : 'border-muted-foreground/30 hover:border-primary/50',
                    isSelected && 'border-primary ring-2 ring-primary/20'
                  )}
                  onClick={() => {
                    if (!qt) {
                      setSelectedSlot(isSelected ? null : position);
                    }
                  }}
                >
                  {qt ? (
                    <>
                      <div className="absolute inset-1 flex flex-col items-center justify-center text-center p-1">
                        <span className="text-[10px] font-medium text-foreground line-clamp-2 leading-tight">
                          {qt.template?.title}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromSlot(position);
                        }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Plus size={20} className={cn(
                        'text-muted-foreground',
                        isSelected && 'text-primary'
                      )} />
                    </div>
                  )}
                  <span className="absolute bottom-0.5 right-1 text-[9px] text-muted-foreground font-medium">
                    {position}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Template selector when slot is selected */}
          {selectedSlot !== null && (
            <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Selecionar template para slot {selectedSlot}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSlot(null)}
                >
                  Cancelar
                </Button>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar mensagem..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
              </div>

              <ScrollArea className="h-[200px]">
                <div className="space-y-1 pr-3">
                  {templatesLoading ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      Carregando...
                    </div>
                  ) : filteredTemplates.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      {searchQuery ? 'Nenhum resultado' : 'Nenhuma mensagem cadastrada'}
                    </div>
                  ) : (
                    filteredTemplates.map((template) => {
                      const isUsed = usedTemplateIds.has(template.id);
                      return (
                        <button
                          key={template.id}
                          onClick={() => handleAddToSlot(template, selectedSlot)}
                          disabled={isUsed}
                          className={cn(
                            'w-full text-left p-2 rounded-md transition-colors',
                            isUsed
                              ? 'opacity-50 cursor-not-allowed bg-muted/50'
                              : 'hover:bg-muted'
                          )}
                        >
                          <p className="font-medium text-sm truncate">{template.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{template.content}</p>
                          {isUsed && (
                            <span className="text-[10px] text-amber-600">Já adicionado</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
