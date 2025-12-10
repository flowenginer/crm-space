import { useState } from 'react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

type QuickRange = {
  label: string;
  getRange: () => { start: Date; end: Date };
};

const quickRanges: QuickRange[] = [
  {
    label: 'Hoje',
    getRange: () => ({ start: new Date(), end: new Date() }),
  },
  {
    label: 'Ontem',
    getRange: () => {
      const yesterday = subDays(new Date(), 1);
      return { start: yesterday, end: yesterday };
    },
  },
  {
    label: 'Últimos 7 dias',
    getRange: () => ({ start: subDays(new Date(), 6), end: new Date() }),
  },
  {
    label: 'Esta semana',
    getRange: () => ({
      start: startOfWeek(new Date(), { weekStartsOn: 0 }),
      end: endOfWeek(new Date(), { weekStartsOn: 0 }),
    }),
  },
  {
    label: 'Semana passada',
    getRange: () => {
      const lastWeek = subWeeks(new Date(), 1);
      return {
        start: startOfWeek(lastWeek, { weekStartsOn: 0 }),
        end: endOfWeek(lastWeek, { weekStartsOn: 0 }),
      };
    },
  },
  {
    label: 'Este mês',
    getRange: () => ({
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date()),
    }),
  },
  {
    label: 'Mês passado',
    getRange: () => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
      };
    },
  },
];

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: DateRangePickerProps) {
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const parsedStartDate = startDate ? new Date(startDate + 'T12:00:00') : undefined;
  const parsedEndDate = endDate ? new Date(endDate + 'T12:00:00') : undefined;

  const handleQuickRange = (range: QuickRange) => {
    const { start, end } = range.getRange();
    onStartDateChange(format(start, 'yyyy-MM-dd'));
    onEndDateChange(format(end, 'yyyy-MM-dd'));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Quick Range Buttons */}
      {quickRanges.map((range) => (
        <Button
          key={range.label}
          variant="outline"
          size="sm"
          className="h-8 text-xs px-3"
          onClick={() => handleQuickRange(range)}
        >
          {range.label}
        </Button>
      ))}

      {/* Date Pickers */}
      <Popover open={startOpen} onOpenChange={setStartOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 justify-start text-left font-normal text-xs px-3',
              !startDate && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
            {parsedStartDate ? (
              format(parsedStartDate, 'dd/MM/yyyy', { locale: ptBR })
            ) : (
              <span>De</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={parsedStartDate}
            onSelect={(date) => {
              if (date) {
                onStartDateChange(format(date, 'yyyy-MM-dd'));
              }
              setStartOpen(false);
            }}
            initialFocus
            locale={ptBR}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      <Popover open={endOpen} onOpenChange={setEndOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 justify-start text-left font-normal text-xs px-3',
              !endDate && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
            {parsedEndDate ? (
              format(parsedEndDate, 'dd/MM/yyyy', { locale: ptBR })
            ) : (
              <span>Até</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={parsedEndDate}
            onSelect={(date) => {
              if (date) {
                onEndDateChange(format(date, 'yyyy-MM-dd'));
              }
              setEndOpen(false);
            }}
            initialFocus
            locale={ptBR}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
