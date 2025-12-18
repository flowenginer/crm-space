import { useState } from 'react';
import { UserRoundPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useRescueTemplates } from '@/hooks/useRescueTemplates';
import { useActiveRescue, useActivateRescue } from '@/hooks/useActiveRescue';
import { cn } from '@/lib/utils';

interface RescueButtonProps {
  conversationId: string;
  contactId: string;
  contactName: string;
}

export function RescueButton({ conversationId, contactId, contactName }: RescueButtonProps) {
  const [open, setOpen] = useState(false);
  
  const { data: templates = [], isLoading: loadingTemplates } = useRescueTemplates();
  const { data: activeRescue, isLoading: loadingRescue } = useActiveRescue(conversationId);
  const activateRescue = useActivateRescue();

  const hasActiveRescue = !!activeRescue;
  const isLoading = loadingTemplates || loadingRescue;

  const handleActivateRescue = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    // Replace {{nome}} with contact name in messages
    const stepsWithName = template.steps.map(step => ({
      ...step,
      message: step.message.replace(/\{\{nome\}\}/gi, contactName),
    }));

    try {
      await activateRescue.mutateAsync({
        conversationId,
        contactId,
        templateId,
        steps: stepsWithName,
      });
      toast.success('Resgate ativado!', {
        description: `Primeira mensagem será enviada agora.`,
      });
      setOpen(false);
    } catch (error: any) {
      if (error?.message?.includes('unique')) {
        toast.error('Já existe um resgate ativo para esta conversa');
      } else {
        toast.error('Erro ao ativar resgate');
      }
    }
  };

  const formatTimer = (minutes: number): string => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins}min`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-1.5 font-semibold border-0",
                hasActiveRescue 
                  ? "bg-green-500 hover:bg-green-600 text-white" 
                  : "bg-yellow-500 hover:bg-yellow-600 text-white"
              )}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <UserRoundPlus size={14} />
              )}
              <span>RESGATE</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {hasActiveRescue ? 'Resgate ativo' : 'Iniciar resgate'}
        </TooltipContent>
      </Tooltip>

      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border">
          <h4 className="font-semibold text-sm">Selecione um template de resgate</h4>
          <p className="text-xs text-muted-foreground mt-1">
            As mensagens serão enviadas automaticamente
          </p>
        </div>

        <ScrollArea className="max-h-64">
          {templates.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhum template de resgate cadastrado
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleActivateRescue(template.id)}
                  disabled={activateRescue.isPending}
                  className="w-full p-3 text-left rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <div className="font-medium text-sm">{template.title}</div>
                  {template.description && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {template.description}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span>{template.steps.length} mensagens</span>
                    <span>•</span>
                    <span>
                      Timers: {template.steps.map(s => formatTimer(s.timer_minutes)).join(' → ')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
