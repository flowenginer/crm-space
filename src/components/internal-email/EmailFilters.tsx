import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Filter, X, Users, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useEmailRecipientOptions } from '@/hooks/useInternalEmail';
import { useAllSharedBoxes } from '@/hooks/useSharedEmailBoxes';

export interface EmailFiltersState {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  senderId: string | undefined;
  recipientId: string | undefined;
  sharedBoxId: string | undefined;
  isRead: 'all' | 'read' | 'unread';
  priority: 'all' | 'low' | 'normal' | 'high';
}

interface EmailFiltersProps {
  filters: EmailFiltersState;
  onFiltersChange: (filters: EmailFiltersState) => void;
  showSharedBoxFilter?: boolean;
}

export const defaultFilters: EmailFiltersState = {
  dateFrom: undefined,
  dateTo: undefined,
  senderId: undefined,
  recipientId: undefined,
  sharedBoxId: undefined,
  isRead: 'all',
  priority: 'all'
};

export function EmailFilters({ filters, onFiltersChange, showSharedBoxFilter = true }: EmailFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: users } = useEmailRecipientOptions();
  const { data: sharedBoxes } = useAllSharedBoxes();

  const activeFiltersCount = [
    filters.dateFrom,
    filters.dateTo,
    filters.senderId,
    filters.recipientId,
    filters.sharedBoxId,
    filters.isRead !== 'all' ? filters.isRead : null,
    filters.priority !== 'all' ? filters.priority : null
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange(defaultFilters);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="h-5 w-5 rounded-full p-0 text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Filtros Avançados</h4>
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                <X className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Período</label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'flex-1 justify-start text-left font-normal text-xs',
                      !filters.dateFrom && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {filters.dateFrom ? format(filters.dateFrom, 'dd/MM/yy', { locale: ptBR }) : 'De'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateFrom}
                    onSelect={(date) => onFiltersChange({ ...filters, dateFrom: date })}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'flex-1 justify-start text-left font-normal text-xs',
                      !filters.dateTo && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {filters.dateTo ? format(filters.dateTo, 'dd/MM/yy', { locale: ptBR }) : 'Até'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateTo}
                    onSelect={(date) => onFiltersChange({ ...filters, dateTo: date })}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Sender */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Remetente</label>
            <Select
              value={filters.senderId || 'all'}
              onValueChange={(v) => onFiltersChange({ ...filters, senderId: v === 'all' ? undefined : v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      {user.full_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recipient */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Destinatário</label>
            <Select
              value={filters.recipientId || 'all'}
              onValueChange={(v) => onFiltersChange({ ...filters, recipientId: v === 'all' ? undefined : v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      {user.full_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Shared Box */}
          {showSharedBoxFilter && sharedBoxes && sharedBoxes.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Caixa Compartilhada</label>
              <Select
                value={filters.sharedBoxId || 'all'}
                onValueChange={(v) => onFiltersChange({ ...filters, sharedBoxId: v === 'all' ? undefined : v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {sharedBoxes.map((box) => (
                    <SelectItem key={box.id} value={box.id}>
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3" />
                        {box.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Read Status */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select
              value={filters.isRead}
              onValueChange={(v) => onFiltersChange({ ...filters, isRead: v as 'all' | 'read' | 'unread' })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="read">Lidos</SelectItem>
                <SelectItem value="unread">Não lidos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
            <Select
              value={filters.priority}
              onValueChange={(v) => onFiltersChange({ ...filters, priority: v as 'all' | 'low' | 'normal' | 'high' })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
