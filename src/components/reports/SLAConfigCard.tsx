import { useState } from 'react';
import { Settings, Clock, Target, Save, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCompanySettings, useUpdateCompanySettings } from '@/hooks/useCompanySettings';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

export function SLAConfigCard() {
  const { data: settings, isLoading } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const [isOpen, setIsOpen] = useState(false);
  const [firstResponseMinutes, setFirstResponseMinutes] = useState<number>(5);
  const [resolutionMinutes, setResolutionMinutes] = useState<number>(60);

  // When dialog opens, populate with current values
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setFirstResponseMinutes(settings?.sla_first_response_minutes ?? 5);
      setResolutionMinutes(settings?.sla_resolution_minutes ?? 60);
    }
    setIsOpen(open);
  };

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        sla_first_response_minutes: firstResponseMinutes,
        sla_resolution_minutes: resolutionMinutes,
      });
      toast.success('Configurações de SLA atualizadas com sucesso!');
      setIsOpen(false);
    } catch (error) {
      toast.error('Erro ao atualizar configurações de SLA');
    }
  };

  const slaFirstResponse = settings?.sla_first_response_minutes ?? 5;
  const slaResolution = settings?.sla_resolution_minutes ?? 60;

  // Helper to format minutes to readable string
  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${mins}min`;
  };

  if (isLoading) {
    return <Skeleton className="h-[140px] w-full rounded-2xl" />;
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Settings size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Configuração de SLA</h3>
            <p className="text-sm text-muted-foreground">Defina as metas de tempo de resposta</p>
          </div>
        </div>
        
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Settings size={16} />
              Editar
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Configurar SLA</DialogTitle>
              <DialogDescription>
                Defina os tempos de resposta esperados para sua equipe. Esses valores serão usados para calcular o status do SLA.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="firstResponse" className="flex items-center gap-2">
                  <Clock size={16} className="text-muted-foreground" />
                  Tempo Primeira Resposta (minutos)
                </Label>
                <Input
                  id="firstResponse"
                  type="number"
                  min={1}
                  value={firstResponseMinutes}
                  onChange={(e) => setFirstResponseMinutes(Number(e.target.value))}
                  className="text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Meta: responder ao cliente em até {firstResponseMinutes} minutos
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="resolution" className="flex items-center gap-2">
                  <Target size={16} className="text-muted-foreground" />
                  Tempo para Resolução (minutos)
                </Label>
                <Input
                  id="resolution"
                  type="number"
                  min={1}
                  value={resolutionMinutes}
                  onChange={(e) => setResolutionMinutes(Number(e.target.value))}
                  className="text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Meta: resolver o atendimento em até {formatTime(resolutionMinutes)}
                </p>
              </div>

              <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium text-foreground">Como funciona a classificação:</p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-status-success" />
                    <span className="text-muted-foreground">
                      <strong className="text-status-success">Bom:</strong> ≤ {firstResponseMinutes} min
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-status-warning" />
                    <span className="text-muted-foreground">
                      <strong className="text-status-warning">Regular:</strong> {firstResponseMinutes + 1} - {firstResponseMinutes * 2} min
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-status-error" />
                    <span className="text-muted-foreground">
                      <strong className="text-status-error">Crítico:</strong> &gt; {firstResponseMinutes * 2} min
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={updateSettings.isPending}
                className="gap-2"
              >
                {updateSettings.isPending ? (
                  <>Salvando...</>
                ) : (
                  <>
                    <Save size={16} />
                    Salvar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* First Response Time */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-primary" />
            <span className="text-sm font-medium text-foreground">Tempo Primeira Resposta</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info size={14} className="text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Tempo máximo para a primeira resposta ao cliente</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {formatTime(slaFirstResponse)}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-status-success/10 text-status-success">
              Bom: ≤ {formatTime(slaFirstResponse)}
            </span>
            <span className="px-2 py-1 rounded-full bg-status-warning/10 text-status-warning">
              Regular: ≤ {formatTime(slaFirstResponse * 2)}
            </span>
            <span className="px-2 py-1 rounded-full bg-status-error/10 text-status-error">
              Crítico: &gt; {formatTime(slaFirstResponse * 2)}
            </span>
          </div>
        </div>

        {/* Resolution Time */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-accent" />
            <span className="text-sm font-medium text-foreground">Tempo para Resolução</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info size={14} className="text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Tempo máximo para resolver o atendimento</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {formatTime(slaResolution)}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-status-success/10 text-status-success">
              Bom: ≤ {formatTime(slaResolution)}
            </span>
            <span className="px-2 py-1 rounded-full bg-status-warning/10 text-status-warning">
              Regular: ≤ {formatTime(slaResolution * 2)}
            </span>
            <span className="px-2 py-1 rounded-full bg-status-error/10 text-status-error">
              Crítico: &gt; {formatTime(slaResolution * 2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
