import { Clock } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BusinessHours, 
  DEFAULT_BUSINESS_HOURS, 
  WEEKDAYS,
  ALL_TIMEZONES,
  BRAZILIAN_TIMEZONES,
  OTHER_TIMEZONES,
} from '@/lib/schedule-utils';

interface BusinessHoursEditorProps {
  value: BusinessHours | null;
  onChange: (value: BusinessHours) => void;
  timezone?: string;
  onTimezoneChange?: (timezone: string) => void;
  showTimezone?: boolean;
}

const DAY_KEYS: (keyof BusinessHours)[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
];

const DAY_LABELS: Record<keyof BusinessHours, string> = {
  monday: 'Segunda',
  tuesday: 'Terça',
  wednesday: 'Quarta',
  thursday: 'Quinta',
  friday: 'Sexta',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

export function BusinessHoursEditor({ 
  value, 
  onChange, 
  timezone = 'America/Sao_Paulo',
  onTimezoneChange,
  showTimezone = true,
}: BusinessHoursEditorProps) {
  const hours = value || DEFAULT_BUSINESS_HOURS;

  const handleDayChange = (day: keyof BusinessHours, field: 'enabled' | 'start' | 'end', fieldValue: boolean | string) => {
    const newHours = {
      ...hours,
      [day]: {
        ...hours[day],
        [field]: fieldValue,
      },
    };
    onChange(newHours);
  };

  const handleApplyToAll = (sourceDay: keyof BusinessHours) => {
    const source = hours[sourceDay];
    const newHours = { ...hours };
    DAY_KEYS.forEach(day => {
      if (day !== sourceDay) {
        newHours[day] = { ...source };
      }
    });
    onChange(newHours);
  };

  return (
    <div className="space-y-4">
      {showTimezone && onTimezoneChange && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Fuso Horário
          </Label>
          <Select value={timezone} onValueChange={onTimezoneChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Brasil</div>
              {BRAZILIAN_TIMEZONES.map(tz => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Outros</div>
              {OTHER_TIMEZONES.map(tz => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-3">
        {DAY_KEYS.map((day) => (
          <div 
            key={day} 
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              hours[day].enabled 
                ? 'bg-primary/5 border-primary/20' 
                : 'bg-muted/30 border-transparent'
            }`}
          >
            <Switch
              checked={hours[day].enabled}
              onCheckedChange={(checked) => handleDayChange(day, 'enabled', checked)}
            />
            <span className={`w-20 text-sm font-medium ${!hours[day].enabled ? 'text-muted-foreground' : ''}`}>
              {DAY_LABELS[day]}
            </span>
            <div className="flex items-center gap-2 flex-1">
              <Input
                type="time"
                value={hours[day].start}
                onChange={(e) => handleDayChange(day, 'start', e.target.value)}
                disabled={!hours[day].enabled}
                className="w-28"
              />
              <span className="text-muted-foreground">até</span>
              <Input
                type="time"
                value={hours[day].end}
                onChange={(e) => handleDayChange(day, 'end', e.target.value)}
                disabled={!hours[day].enabled}
                className="w-28"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Compact version for BulkDispatch
interface CompactScheduleEditorProps {
  start: string;
  end: string;
  days: number[];
  timezone: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onDaysChange: (days: number[]) => void;
  onTimezoneChange: (timezone: string) => void;
}

export function CompactScheduleEditor({
  start,
  end,
  days,
  timezone,
  onStartChange,
  onEndChange,
  onDaysChange,
  onTimezoneChange,
}: CompactScheduleEditorProps) {
  const toggleDay = (day: number) => {
    if (days.includes(day)) {
      onDaysChange(days.filter(d => d !== day));
    } else {
      onDaysChange([...days, day].sort((a, b) => a - b));
    }
  };

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Início</Label>
          <Input
            type="time"
            value={start}
            onChange={(e) => onStartChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Fim</Label>
          <Input
            type="time"
            value={end}
            onChange={(e) => onEndChange(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Dias da Semana</Label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                days.includes(day.value)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-input hover:bg-accent'
              }`}
            >
              {day.short}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Fuso Horário</Label>
        <Select value={timezone} onValueChange={onTimezoneChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BRAZILIAN_TIMEZONES.map(tz => (
              <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
            ))}
            <div className="border-t my-1" />
            {OTHER_TIMEZONES.map(tz => (
              <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
