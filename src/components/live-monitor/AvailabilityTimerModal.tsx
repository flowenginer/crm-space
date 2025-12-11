import { useState } from 'react';
import { Clock, Coffee, Moon, Calendar, Timer, Infinity } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface AvailabilityTimerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  onConfirm: (untilTime: string | null, reason: string) => void;
}

interface TimerOption {
  label: string;
  value: number | 'custom' | 'indefinite' | 'end_of_day';
  icon: React.ReactNode;
  description: string;
}

const timerOptions: TimerOption[] = [
  { 
    label: '30 minutos', 
    value: 30, 
    icon: <Coffee className="h-5 w-5" />,
    description: 'Pausa curta'
  },
  { 
    label: '1 hora', 
    value: 60, 
    icon: <Clock className="h-5 w-5" />,
    description: 'Almoço'
  },
  { 
    label: '2 horas', 
    value: 120, 
    icon: <Timer className="h-5 w-5" />,
    description: 'Reunião'
  },
  { 
    label: '4 horas', 
    value: 240, 
    icon: <Moon className="h-5 w-5" />,
    description: 'Meio período'
  },
  { 
    label: 'Fim do expediente', 
    value: 'end_of_day', 
    icon: <Calendar className="h-5 w-5" />,
    description: 'Até 18h'
  },
  { 
    label: 'Indefinido', 
    value: 'indefinite', 
    icon: <Infinity className="h-5 w-5" />,
    description: 'Reativação manual'
  },
];

export function AvailabilityTimerModal({
  open,
  onOpenChange,
  agentName,
  onConfirm,
}: AvailabilityTimerModalProps) {
  const [selectedOption, setSelectedOption] = useState<TimerOption['value'] | null>(null);
  const [customTime, setCustomTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (selectedOption === null) return;
    
    setIsSubmitting(true);
    
    let untilTime: string | null = null;
    let reason = '';
    
    if (selectedOption === 'indefinite') {
      untilTime = null;
      reason = 'Pausa indefinida';
    } else if (selectedOption === 'end_of_day') {
      const today = new Date();
      today.setHours(18, 0, 0, 0);
      untilTime = today.toISOString();
      reason = 'Até o fim do expediente';
    } else if (selectedOption === 'custom' && customTime) {
      const [hours, minutes] = customTime.split(':').map(Number);
      const targetTime = new Date();
      targetTime.setHours(hours, minutes, 0, 0);
      if (targetTime <= new Date()) {
        targetTime.setDate(targetTime.getDate() + 1);
      }
      untilTime = targetTime.toISOString();
      reason = `Até ${customTime}`;
    } else if (typeof selectedOption === 'number') {
      const targetTime = new Date();
      targetTime.setMinutes(targetTime.getMinutes() + selectedOption);
      untilTime = targetTime.toISOString();
      const option = timerOptions.find(o => o.value === selectedOption);
      reason = option?.description || `${selectedOption} minutos`;
    }

    onConfirm(untilTime, reason);
    setIsSubmitting(false);
    setSelectedOption(null);
    setCustomTime('');
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelectedOption(null);
    setCustomTime('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pausar recebimento de leads</DialogTitle>
          <DialogDescription>
            Por quanto tempo <span className="font-semibold text-foreground">{agentName}</span> ficará sem receber novos leads?
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-4">
          {timerOptions.map((option) => (
            <Button
              key={String(option.value)}
              type="button"
              variant="outline"
              className={cn(
                "h-auto flex flex-col items-center gap-2 p-4 transition-all",
                selectedOption === option.value && "border-primary bg-primary/5 ring-2 ring-primary/20"
              )}
              onClick={() => setSelectedOption(option.value)}
            >
              <div className={cn(
                "text-muted-foreground transition-colors",
                selectedOption === option.value && "text-primary"
              )}>
                {option.icon}
              </div>
              <span className="font-medium text-sm">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </Button>
          ))}
        </div>

        {/* Custom time input */}
        <div className="space-y-2">
          <Label htmlFor="custom-time" className="text-sm text-muted-foreground">
            Ou defina um horário específico:
          </Label>
          <Input
            id="custom-time"
            type="time"
            value={customTime}
            onChange={(e) => {
              setCustomTime(e.target.value);
              setSelectedOption('custom');
            }}
            className={cn(
              selectedOption === 'custom' && "border-primary ring-2 ring-primary/20"
            )}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={handleCancel}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={handleConfirm}
            disabled={selectedOption === null || isSubmitting}
          >
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
