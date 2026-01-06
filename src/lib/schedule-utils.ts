// Schedule utilities for business hours configuration

export const BRAZILIAN_TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'Brasília (GMT-3)' },
  { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (GMT-4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (GMT-2)' },
] as const;

export const OTHER_TIMEZONES = [
  { value: 'America/New_York', label: 'Nova York (EST)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
  { value: 'Europe/London', label: 'Londres (GMT)' },
  { value: 'Europe/Lisbon', label: 'Lisboa (WET)' },
  { value: 'UTC', label: 'UTC' },
] as const;

export const ALL_TIMEZONES = [...BRAZILIAN_TIMEZONES, ...OTHER_TIMEZONES];

export const WEEKDAYS = [
  { value: 0, label: 'Domingo', short: 'Dom' },
  { value: 1, label: 'Segunda', short: 'Seg' },
  { value: 2, label: 'Terça', short: 'Ter' },
  { value: 3, label: 'Quarta', short: 'Qua' },
  { value: 4, label: 'Quinta', short: 'Qui' },
  { value: 5, label: 'Sexta', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sab' },
] as const;

export interface DaySchedule {
  enabled: boolean;
  start: string; // HH:mm
  end: string;   // HH:mm
}

export interface BusinessHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface ScheduleOverride {
  start: string;  // HH:mm
  end: string;    // HH:mm
  days: number[]; // 0=domingo, 1=segunda, ..., 6=sábado
  timezone: string;
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  monday: { enabled: true, start: '08:00', end: '18:00' },
  tuesday: { enabled: true, start: '08:00', end: '18:00' },
  wednesday: { enabled: true, start: '08:00', end: '18:00' },
  thursday: { enabled: true, start: '08:00', end: '18:00' },
  friday: { enabled: true, start: '08:00', end: '18:00' },
  saturday: { enabled: false, start: '08:00', end: '12:00' },
  sunday: { enabled: false, start: '08:00', end: '12:00' },
};

const DAY_KEYS: (keyof BusinessHours)[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
];

export function formatBusinessHoursSummary(hours: BusinessHours | null, timezone?: string): string {
  if (!hours) return 'Não configurado';
  
  const enabledDays = DAY_KEYS
    .map((key, index) => ({ day: index, schedule: hours[key] }))
    .filter(d => d.schedule.enabled);
  
  if (enabledDays.length === 0) return 'Nenhum dia ativo';
  
  // Check if all days have the same hours
  const firstHours = enabledDays[0].schedule;
  const sameHours = enabledDays.every(
    d => d.schedule.start === firstHours.start && d.schedule.end === firstHours.end
  );
  
  // Format day range
  const dayIndices = enabledDays.map(d => d.day).sort((a, b) => a - b);
  const dayRange = formatDayRange(dayIndices);
  
  if (sameHours) {
    const tzLabel = timezone ? ` (${getTimezoneShortLabel(timezone)})` : '';
    return `${dayRange} ${firstHours.start}-${firstHours.end}${tzLabel}`;
  }
  
  return `${dayRange} (horários variados)`;
}

function formatDayRange(days: number[]): string {
  if (days.length === 0) return '';
  if (days.length === 1) return WEEKDAYS[days[0]].short;
  
  // Check for consecutive days
  const isConsecutive = days.every((day, i) => 
    i === 0 || day === days[i - 1] + 1 || (days[i - 1] === 6 && day === 0)
  );
  
  if (isConsecutive && days.length > 2) {
    return `${WEEKDAYS[days[0]].short}-${WEEKDAYS[days[days.length - 1]].short}`;
  }
  
  return days.map(d => WEEKDAYS[d].short).join(', ');
}

export function getTimezoneShortLabel(timezone: string): string {
  const found = ALL_TIMEZONES.find(tz => tz.value === timezone);
  if (!found) return timezone;
  
  // Extract short label like "Brasília" from "Brasília (GMT-3)"
  const match = found.label.match(/^([^(]+)/);
  return match ? match[1].trim() : found.label;
}

export function businessHoursToOverride(hours: BusinessHours, timezone: string): ScheduleOverride {
  const enabledDays = DAY_KEYS
    .map((key, index) => ({ day: index, schedule: hours[key] }))
    .filter(d => d.schedule.enabled);
  
  if (enabledDays.length === 0) {
    return { start: '08:00', end: '18:00', days: [], timezone };
  }
  
  // Use the first enabled day's hours as reference
  const first = enabledDays[0].schedule;
  
  return {
    start: first.start,
    end: first.end,
    days: enabledDays.map(d => d.day),
    timezone,
  };
}

export function overrideToBusinessHours(override: ScheduleOverride): BusinessHours {
  const hours = { ...DEFAULT_BUSINESS_HOURS };
  
  DAY_KEYS.forEach((key, index) => {
    const isEnabled = override.days.includes(index);
    hours[key] = {
      enabled: isEnabled,
      start: override.start,
      end: override.end,
    };
  });
  
  return hours;
}
