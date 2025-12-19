import { useState } from 'react';
import { Power, PowerOff, Lock, Timer, Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/contexts/ThemeContext';
import {
  useAgentAvailabilityStatus,
  useToggleSelfAvailability,
  useRequestRelease,
  useMyPendingRequest,
} from '@/hooks/useAgentAvailability';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AvailabilityToggleProps {
  isCollapsed: boolean;
}

export function AvailabilityToggle({ isCollapsed }: AvailabilityToggleProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const { data: status, isLoading } = useAgentAvailabilityStatus();
  const toggleAvailability = useToggleSelfAvailability();
  const requestRelease = useRequestRelease();
  const { data: pendingRequest } = useMyPendingRequest();
  
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [releaseReason, setReleaseReason] = useState('');
  const [pauseDuration, setPauseDuration] = useState<number | null>(null);

  if (isLoading || !status) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg",
        isDark ? "bg-muted/30" : "bg-white/10"
      )}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  const isLocked = !!status.availability_locked_by;
  const hasPendingRequest = !!pendingRequest;

  const handleToggle = () => {
    if (isLocked) {
      setReleaseModalOpen(true);
      return;
    }

    if (status.is_available) {
      setPauseModalOpen(true);
    } else {
      toggleAvailability.mutate({ isAvailable: true });
    }
  };

  const handlePause = () => {
    let untilTime: string | null = null;
    let reason = 'Pausa manual';

    if (pauseDuration) {
      const targetTime = new Date();
      targetTime.setMinutes(targetTime.getMinutes() + pauseDuration);
      untilTime = targetTime.toISOString();
      reason = `Pausa de ${pauseDuration} minutos`;
    }

    toggleAvailability.mutate({
      isAvailable: false,
      unavailableUntil: untilTime,
      unavailabilityReason: reason,
    });
    setPauseModalOpen(false);
    setPauseDuration(null);
  };

  const handleRequestRelease = () => {
    requestRelease.mutate(releaseReason || undefined);
    setReleaseModalOpen(false);
    setReleaseReason('');
  };

  // Calculate remaining time if paused with timer
  const getRemainingTime = () => {
    if (!status.unavailable_until) return null;
    const until = new Date(status.unavailable_until);
    const now = new Date();
    if (until <= now) return null;
    return formatDistanceToNow(until, { locale: ptBR, addSuffix: false });
  };

  const remainingTime = getRemainingTime();

  if (isCollapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleToggle}
              disabled={toggleAvailability.isPending || (isLocked && hasPendingRequest)}
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-lg transition-all",
                status.is_available
                  ? isDark ? "bg-green-500/20 text-green-500" : "bg-green-500/30 text-green-100"
                  : isLocked
                    ? isDark ? "bg-amber-500/20 text-amber-500" : "bg-amber-500/30 text-amber-100"
                    : isDark ? "bg-muted text-muted-foreground" : "bg-white/10 text-purple-200",
                "hover:scale-105"
              )}
            >
              {toggleAvailability.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isLocked ? (
                <Lock className="h-4 w-4" />
              ) : status.is_available ? (
                <Power className="h-4 w-4" />
              ) : (
                <PowerOff className="h-4 w-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {isLocked
              ? hasPendingRequest
                ? 'Aguardando liberação'
                : `Bloqueado por ${status.locked_by_name || 'admin'}`
              : status.is_available
                ? 'Recebendo leads - clique para pausar'
                : remainingTime
                  ? `Pausado - volta em ${remainingTime}`
                  : 'Pausado - clique para ativar'
            }
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer",
          status.is_available
            ? isDark ? "bg-green-500/10 border border-green-500/30" : "bg-green-500/20 border border-green-300/30"
            : isLocked
              ? isDark ? "bg-amber-500/10 border border-amber-500/30" : "bg-amber-500/20 border border-amber-300/30"
              : isDark ? "bg-muted/50" : "bg-white/10",
          (toggleAvailability.isPending || (isLocked && hasPendingRequest)) && "opacity-60 cursor-not-allowed"
        )}
        onClick={!toggleAvailability.isPending && !(isLocked && hasPendingRequest) ? handleToggle : undefined}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isLocked ? (
              <Lock className={cn("h-4 w-4", isDark ? "text-amber-500" : "text-amber-200")} />
            ) : status.is_available ? (
              <Power className={cn("h-4 w-4", isDark ? "text-green-500" : "text-green-200")} />
            ) : (
              <PowerOff className={cn("h-4 w-4", isDark ? "text-muted-foreground" : "text-purple-300")} />
            )}
            <span className={cn(
              "text-sm font-medium truncate",
              status.is_available
                ? isDark ? "text-green-500" : "text-green-100"
                : isLocked
                  ? isDark ? "text-amber-500" : "text-amber-100"
                  : isDark ? "text-muted-foreground" : "text-purple-200"
            )}>
              {isLocked
                ? hasPendingRequest
                  ? 'Aguardando liberação'
                  : 'Bloqueado'
                : status.is_available
                  ? 'Recebendo leads'
                  : remainingTime
                    ? `Pausado (${remainingTime})`
                    : 'Pausado'
              }
            </span>
          </div>
          {isLocked && !hasPendingRequest && status.locked_by_name && (
            <span className={cn(
              "text-xs",
              isDark ? "text-muted-foreground" : "text-purple-300"
            )}>
              por {status.locked_by_name}
            </span>
          )}
        </div>

        {!isLocked && (
          <Switch
            checked={status.is_available}
            disabled={toggleAvailability.isPending}
            className="pointer-events-none scale-90"
          />
        )}
        {isLocked && !hasPendingRequest && (
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "h-7 text-xs px-2",
              isDark ? "text-amber-500 hover:bg-amber-500/20" : "text-amber-100 hover:bg-amber-500/30"
            )}
            onClick={(e) => {
              e.stopPropagation();
              setReleaseModalOpen(true);
            }}
          >
            Solicitar
          </Button>
        )}
      </div>

      {/* Pause Duration Modal */}
      <Dialog open={pauseModalOpen} onOpenChange={setPauseModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pausar recebimento</DialogTitle>
            <DialogDescription>
              Por quanto tempo você ficará sem receber novos leads?
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 py-4">
            {[15, 30, 60, 120].map((minutes) => (
              <Button
                key={minutes}
                variant="outline"
                className={cn(
                  "h-12",
                  pauseDuration === minutes && "border-primary bg-primary/5"
                )}
                onClick={() => setPauseDuration(minutes)}
              >
                <Timer className="h-4 w-4 mr-2" />
                {minutes < 60 ? `${minutes} min` : `${minutes / 60}h`}
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            className={cn(
              "w-full",
              pauseDuration === null && "border-primary bg-primary/5"
            )}
            onClick={() => setPauseDuration(null)}
          >
            Indefinido (manual)
          </Button>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setPauseModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handlePause} disabled={toggleAvailability.isPending}>
              Pausar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Request Release Modal */}
      <Dialog open={releaseModalOpen} onOpenChange={setReleaseModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Solicitar liberação</DialogTitle>
            <DialogDescription>
              Sua disponibilidade foi bloqueada por {status.locked_by_name || 'um administrador'}. 
              Envie uma solicitação para ser liberado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo (opcional)</Label>
              <Input
                id="reason"
                placeholder="Ex: Já retornei da pausa..."
                value={releaseReason}
                onChange={(e) => setReleaseReason(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setReleaseModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              className="flex-1" 
              onClick={handleRequestRelease} 
              disabled={requestRelease.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
