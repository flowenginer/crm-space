import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Calendar } from '@/components/ui/calendar';
import { 
  Search, 
  Filter, 
  X, 
  CalendarIcon, 
  ChevronDown,
  LayoutGrid,
  List,
  Package
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useTeam } from '@/hooks/useTeam';
import { useActiveStores } from '@/hooks/useStores';

export interface OrderFiltersState {
  search: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  assignedTo: string;
  dateFrom: string;
  dateTo: string;
  minTotal: string;
  maxTotal: string;
  shippingMethod: string;
  isFirstPurchase: boolean;
  hasDiscount: boolean;
  hasConversation: boolean;
  // Novos filtros
  storeId: string;
  orderType: string;
  fulfillmentStatus: string;
  installments: string;
  hasTracking: boolean;
  expectedDeliveryFrom: string;
  expectedDeliveryTo: string;
  useOrderDate: boolean;
  paymentCondition: string;
}

export const initialFilters: OrderFiltersState = {
  search: '',
  status: 'all',
  paymentStatus: 'all',
  paymentMethod: 'all',
  assignedTo: 'all',
  dateFrom: '',
  dateTo: '',
  minTotal: '',
  maxTotal: '',
  shippingMethod: 'all',
  isFirstPurchase: false,
  hasDiscount: false,
  hasConversation: false,
  // Novos filtros
  storeId: 'all',
  orderType: 'all',
  fulfillmentStatus: 'all',
  installments: 'all',
  hasTracking: false,
  expectedDeliveryFrom: '',
  expectedDeliveryTo: '',
  useOrderDate: false,
  paymentCondition: 'all',
};

const statusOptions = [
  { value: 'all', label: 'Todos os status' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'pending', label: 'Pendente' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'processing', label: 'Processando' },
  { value: 'shipped', label: 'Enviado' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'canceled', label: 'Cancelado' },
];

const paymentStatusOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendente' },
  { value: 'paid', label: 'Pago' },
  { value: 'partial', label: 'Parcial' },
  { value: 'refunded', label: 'Reembolsado' },
];

const paymentMethodOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'pix', label: 'PIX' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'debit_card', label: 'Cartão de Débito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'transfer', label: 'Transferência' },
];

const shippingMethodOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'pickup', label: 'Retirada' },
  { value: 'delivery', label: 'Entrega' },
  { value: 'correios', label: 'Correios' },
  { value: 'motoboy', label: 'Motoboy' },
];

const orderTypeOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'sale', label: 'Venda' },
  { value: 'exchange', label: 'Troca' },
  { value: 'return', label: 'Devolução' },
  { value: 'quote', label: 'Orçamento' },
];

const fulfillmentStatusOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Não separado' },
  { value: 'partial', label: 'Parcialmente separado' },
  { value: 'fulfilled', label: 'Totalmente separado' },
];

const installmentsOptions = [
  { value: 'all', label: 'Todas' },
  { value: '1', label: 'À vista (1x)' },
  { value: '2', label: '2x' },
  { value: '3', label: '3x' },
  { value: '4+', label: '4x ou mais' },
];

const paymentConditionOptions = [
  { value: 'all', label: 'Todas' },
  { value: 'cash', label: 'À vista' },
  { value: 'installments', label: 'Parcelado' },
  { value: 'down_payment', label: 'Com entrada' },
];

const quickDateRanges = [
  {
    label: 'Hoje',
    getRange: () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      return { from: today, to: today };
    },
  },
  {
    label: '7 dias',
    getRange: () => ({
      from: format(subDays(new Date(), 6), 'yyyy-MM-dd'),
      to: format(new Date(), 'yyyy-MM-dd'),
    }),
  },
  {
    label: '30 dias',
    getRange: () => ({
      from: format(subDays(new Date(), 29), 'yyyy-MM-dd'),
      to: format(new Date(), 'yyyy-MM-dd'),
    }),
  },
  {
    label: 'Este mês',
    getRange: () => ({
      from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      to: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    }),
  },
  {
    label: 'Mês passado',
    getRange: () => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        from: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
        to: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
      };
    },
  },
];

interface OrderFiltersProps {
  filters: OrderFiltersState;
  onFiltersChange: (filters: OrderFiltersState) => void;
  viewMode: 'list' | 'kanban';
  onViewModeChange: (mode: 'list' | 'kanban') => void;
}

export function OrderFilters({ 
  filters, 
  onFiltersChange, 
  viewMode, 
  onViewModeChange 
}: OrderFiltersProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);
  const [deliveryFromOpen, setDeliveryFromOpen] = useState(false);
  const [deliveryToOpen, setDeliveryToOpen] = useState(false);
  
  const { data: team = [] } = useTeam();
  const { data: stores = [] } = useActiveStores();

  const updateFilter = <K extends keyof OrderFiltersState>(
    key: K, 
    value: OrderFiltersState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange(initialFilters);
  };

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'search') return false;
    if (typeof value === 'boolean') return value === true;
    if (typeof value === 'string') return value !== '' && value !== 'all';
    return false;
  }).length;

  const parsedDateFrom = filters.dateFrom ? new Date(filters.dateFrom + 'T12:00:00') : undefined;
  const parsedDateTo = filters.dateTo ? new Date(filters.dateTo + 'T12:00:00') : undefined;
  const parsedDeliveryFrom = filters.expectedDeliveryFrom ? new Date(filters.expectedDeliveryFrom + 'T12:00:00') : undefined;
  const parsedDeliveryTo = filters.expectedDeliveryTo ? new Date(filters.expectedDeliveryTo + 'T12:00:00') : undefined;

  return (
    <div className="space-y-4">
      {/* Linha 1: Busca + Data + Status + Visualização */}
      <div className="flex gap-3 flex-wrap items-center">
        {/* Busca */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, cliente..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Quick Date Ranges */}
        <div className="flex gap-1">
          {quickDateRanges.slice(0, 3).map((range) => (
            <Button
              key={range.label}
              variant={
                filters.dateFrom === range.getRange().from && 
                filters.dateTo === range.getRange().to 
                  ? 'secondary' 
                  : 'outline'
              }
              size="sm"
              className="h-9 text-xs"
              onClick={() => {
                const { from, to } = range.getRange();
                onFiltersChange({ ...filters, dateFrom: from, dateTo: to });
              }}
            >
              {range.label}
            </Button>
          ))}
        </div>

        {/* Date From */}
        <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-9 justify-start text-left font-normal text-xs w-[130px]',
                !filters.dateFrom && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {parsedDateFrom ? format(parsedDateFrom, 'dd/MM/yyyy', { locale: ptBR }) : 'De'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={parsedDateFrom}
              onSelect={(date) => {
                if (date) updateFilter('dateFrom', format(date, 'yyyy-MM-dd'));
                setDateFromOpen(false);
              }}
              initialFocus
              locale={ptBR}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* Date To */}
        <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-9 justify-start text-left font-normal text-xs w-[130px]',
                !filters.dateTo && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {parsedDateTo ? format(parsedDateTo, 'dd/MM/yyyy', { locale: ptBR }) : 'Até'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={parsedDateTo}
              onSelect={(date) => {
                if (date) updateFilter('dateTo', format(date, 'yyyy-MM-dd'));
                setDateToOpen(false);
              }}
              initialFocus
              locale={ptBR}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* Status */}
        <Select value={filters.status} onValueChange={(v) => updateFilter('status', v)}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View Mode Toggle */}
        <div className="flex gap-1 border rounded-lg p-1">
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => onViewModeChange('list')}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => onViewModeChange('kanban')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Linha 2: Vendedor + Pagamento + Tipo Cliente + Mais Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        {/* Vendedor */}
        <Select value={filters.assignedTo} onValueChange={(v) => updateFilter('assignedTo', v)}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os vendedores</SelectItem>
            {team.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status de Pagamento */}
        <Select value={filters.paymentStatus} onValueChange={(v) => updateFilter('paymentStatus', v)}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue placeholder="Pagamento" />
          </SelectTrigger>
          <SelectContent>
            {paymentStatusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Loja */}
        <Select value={filters.storeId} onValueChange={(v) => updateFilter('storeId', v)}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue placeholder="Loja" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as lojas</SelectItem>
            {stores.map((store) => (
              <SelectItem key={store.id} value={store.id}>
                {store.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Primeira Compra Toggle */}
        <Button
          variant={filters.isFirstPurchase ? 'secondary' : 'outline'}
          size="sm"
          className="h-9"
          onClick={() => updateFilter('isFirstPurchase', !filters.isFirstPurchase)}
        >
          Primeira compra
        </Button>

        {/* Mais Filtros */}
        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <Filter className="h-4 w-4" />
              Mais filtros
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {activeFiltersCount}
                </Badge>
              )}
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                isAdvancedOpen && "rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
        </Collapsible>

        {/* Limpar Filtros */}
        {activeFiltersCount > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-9 text-muted-foreground"
            onClick={clearFilters}
          >
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Filtros Avançados */}
      <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
        <CollapsibleContent className="pt-2">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4 bg-muted/50 rounded-lg border">
            {/* Forma de Pagamento */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Forma de Pagamento</Label>
              <Select 
                value={filters.paymentMethod} 
                onValueChange={(v) => updateFilter('paymentMethod', v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethodOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Método de Entrega */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Método de Entrega</Label>
              <Select 
                value={filters.shippingMethod} 
                onValueChange={(v) => updateFilter('shippingMethod', v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {shippingMethodOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Pedido */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tipo de Pedido</Label>
              <Select 
                value={filters.orderType} 
                onValueChange={(v) => updateFilter('orderType', v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orderTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status de Fulfillment */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status Separação</Label>
              <Select 
                value={filters.fulfillmentStatus} 
                onValueChange={(v) => updateFilter('fulfillmentStatus', v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fulfillmentStatusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Parcelas */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Parcelas</Label>
              <Select 
                value={filters.installments} 
                onValueChange={(v) => updateFilter('installments', v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {installmentsOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Condição de Pagamento */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Condição Pagamento</Label>
              <Select 
                value={filters.paymentCondition} 
                onValueChange={(v) => updateFilter('paymentCondition', v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentConditionOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Valor Mínimo */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Valor Mínimo</Label>
              <Input
                type="number"
                placeholder="R$ 0,00"
                value={filters.minTotal}
                onChange={(e) => updateFilter('minTotal', e.target.value)}
                className="h-9"
              />
            </div>

            {/* Valor Máximo */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Valor Máximo</Label>
              <Input
                type="number"
                placeholder="R$ 99999"
                value={filters.maxTotal}
                onChange={(e) => updateFilter('maxTotal', e.target.value)}
                className="h-9"
              />
            </div>

            {/* Previsão de Entrega De */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Entrega prevista de</Label>
              <Popover open={deliveryFromOpen} onOpenChange={setDeliveryFromOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-9 w-full justify-start text-left font-normal text-xs',
                      !filters.expectedDeliveryFrom && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {parsedDeliveryFrom ? format(parsedDeliveryFrom, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parsedDeliveryFrom}
                    onSelect={(date) => {
                      if (date) updateFilter('expectedDeliveryFrom', format(date, 'yyyy-MM-dd'));
                      setDeliveryFromOpen(false);
                    }}
                    initialFocus
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Previsão de Entrega Até */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Entrega prevista até</Label>
              <Popover open={deliveryToOpen} onOpenChange={setDeliveryToOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-9 w-full justify-start text-left font-normal text-xs',
                      !filters.expectedDeliveryTo && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {parsedDeliveryTo ? format(parsedDeliveryTo, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parsedDeliveryTo}
                    onSelect={(date) => {
                      if (date) updateFilter('expectedDeliveryTo', format(date, 'yyyy-MM-dd'));
                      setDeliveryToOpen(false);
                    }}
                    initialFocus
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3 col-span-2">
              <Label className="text-xs text-muted-foreground">Opções</Label>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasDiscount"
                    checked={filters.hasDiscount}
                    onCheckedChange={(checked) => 
                      updateFilter('hasDiscount', checked === true)
                    }
                  />
                  <Label htmlFor="hasDiscount" className="text-sm cursor-pointer">
                    Com desconto
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasConversation"
                    checked={filters.hasConversation}
                    onCheckedChange={(checked) => 
                      updateFilter('hasConversation', checked === true)
                    }
                  />
                  <Label htmlFor="hasConversation" className="text-sm cursor-pointer">
                    Com conversa
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasTracking"
                    checked={filters.hasTracking}
                    onCheckedChange={(checked) => 
                      updateFilter('hasTracking', checked === true)
                    }
                  />
                  <Label htmlFor="hasTracking" className="text-sm cursor-pointer">
                    <Package className="h-3.5 w-3.5 inline mr-1" />
                    Com rastreio
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="useOrderDate"
                    checked={filters.useOrderDate}
                    onCheckedChange={(checked) => 
                      updateFilter('useOrderDate', checked === true)
                    }
                  />
                  <Label htmlFor="useOrderDate" className="text-sm cursor-pointer">
                    Filtrar por data do pedido
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
