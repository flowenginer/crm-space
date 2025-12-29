import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useBlingImport, useBlingPreview, type BlingPreviewItem } from '@/hooks/useBlingIntegration';
import { 
  Download, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  CalendarIcon, 
  Search,
  AlertTriangle,
  Wallet,
  FolderOpen,
  Building2
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { BlingEntityType } from './BlingIntegrationBanner';
import { cn } from '@/lib/utils';

interface BlingImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: BlingEntityType;
}

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface BlingDependency {
  type: 'account' | 'category' | 'cost_center';
  name: string;
  blingId: string;
  existsLocally: boolean;
}

interface ExtendedPreviewItem extends BlingPreviewItem {
  selected: boolean;
  date?: string;
  value?: number;
  dependencies?: BlingDependency[];
}

const entityConfig: Record<BlingEntityType, { 
  title: string; 
  description: string;
  hasDateFilter: boolean;
  hasDependencies: boolean;
}> = {
  products: {
    title: 'Importar Produtos do Bling',
    description: 'Importe produtos cadastrados no Bling para seu ERP',
    hasDateFilter: false,
    hasDependencies: false,
  },
  contacts: {
    title: 'Importar Contatos do Bling',
    description: 'Importe clientes e fornecedores do Bling para seu ERP',
    hasDateFilter: false,
    hasDependencies: false,
  },
  orders: {
    title: 'Importar Pedidos do Bling',
    description: 'Importe pedidos de venda do Bling para seu ERP',
    hasDateFilter: true,
    hasDependencies: false,
  },
  financial: {
    title: 'Importar Dados Financeiros do Bling',
    description: 'Importe contas a pagar e receber do Bling',
    hasDateFilter: true,
    hasDependencies: true,
  },
};

type ImportMode = 'all' | 'new_only' | 'update_existing';

// Quick period presets
const periodPresets = [
  { label: 'Este mês', getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: 'Mês anterior', getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: 'Últimos 2 meses', getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(new Date()) }) },
  { label: 'Últimos 3 meses', getValue: () => ({ from: startOfMonth(subMonths(new Date(), 2)), to: endOfMonth(new Date()) }) },
];

export function BlingImportModal({ open, onOpenChange, entityType }: BlingImportModalProps) {
  const [step, setStep] = useState<'options' | 'preview' | 'dependencies' | 'importing' | 'complete'>('options');
  const [importMode, setImportMode] = useState<ImportMode>('new_only');
  const [dateRange, setDateRange] = useState<DateRange>({ 
    from: startOfMonth(new Date()), 
    to: endOfMonth(new Date()) 
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<ExtendedPreviewItem[]>([]);
  const [dependencies, setDependencies] = useState<BlingDependency[]>([]);
  const [createMissingDependencies, setCreateMissingDependencies] = useState(true);
  
  const preview = useBlingPreview(entityType);
  const importMutation = useBlingImport();

  const config = entityConfig[entityType];

  // Filter items based on search and selection
  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item => 
      item.name.toLowerCase().includes(term) || 
      item.code?.toLowerCase().includes(term)
    );
  }, [items, searchTerm]);

  const selectedItems = useMemo(() => items.filter(i => i.selected), [items]);
  const missingDependencies = useMemo(() => dependencies.filter(d => !d.existsLocally), [dependencies]);

  const handleLoadPreview = () => {
    const filters = config.hasDateFilter && dateRange.from && dateRange.to ? {
      startDate: format(dateRange.from, 'yyyy-MM-dd'),
      endDate: format(dateRange.to, 'yyyy-MM-dd'),
    } : undefined;

    preview.mutate(filters as any, {
      onSuccess: (data) => {
        // Transform to extended items with selection
        const extendedItems: ExtendedPreviewItem[] = data.items.map(item => ({
          ...item,
          selected: item.isNew || importMode === 'all',
          dependencies: (item as any).dependencies,
        }));
        setItems(extendedItems);

        // Extract dependencies for financial
        if (config.hasDependencies && data.dependencies) {
          setDependencies(data.dependencies as BlingDependency[]);
        }

        // Check if we need to show dependencies step
        if (config.hasDependencies && missingDependencies.length > 0) {
          setStep('dependencies');
        } else {
          setStep('preview');
        }
      },
    });
  };

  const handleToggleItem = (itemId: string) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, selected: !item.selected } : item
    ));
  };

  const handleSelectAll = () => {
    const allSelected = filteredItems.every(i => i.selected);
    setItems(prev => prev.map(item => {
      const isInFiltered = filteredItems.some(f => f.id === item.id);
      return isInFiltered ? { ...item, selected: !allSelected } : item;
    }));
  };

  const handleSelectNew = () => {
    setItems(prev => prev.map(item => ({ ...item, selected: item.isNew })));
  };

  const handleStartImport = () => {
    setStep('importing');
    
    const selectedIds = selectedItems.map(i => i.id);
    
    importMutation.mutate(
      { 
        entityType, 
        mode: importMode,
        selectedIds,
        createDependencies: createMissingDependencies,
        dateRange: config.hasDateFilter && dateRange.from && dateRange.to ? {
          startDate: format(dateRange.from, 'yyyy-MM-dd'),
          endDate: format(dateRange.to, 'yyyy-MM-dd'),
        } : undefined,
      },
      {
        onSuccess: () => setStep('complete'),
        onError: () => setStep('preview'),
      }
    );
  };

  const handleClose = () => {
    setStep('options');
    setImportMode('new_only');
    setSearchTerm('');
    setItems([]);
    setDependencies([]);
    onOpenChange(false);
  };

  const renderDateFilter = () => {
    if (!config.hasDateFilter) return null;

    return (
      <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
        <Label className="text-sm font-medium">Período de importação</Label>
        
        <div className="flex flex-wrap gap-2">
          {periodPresets.map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              onClick={() => setDateRange(preset.getValue())}
              className="text-xs"
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal flex-1",
                  !dateRange.from && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? format(dateRange.from, "dd/MM/yyyy", { locale: ptBR }) : "Data inicial"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateRange.from}
                onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground">até</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal flex-1",
                  !dateRange.to && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.to ? format(dateRange.to, "dd/MM/yyyy", { locale: ptBR }) : "Data final"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateRange.to}
                onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    );
  };

  const renderOptionsStep = () => (
    <>
      <div className="space-y-6 py-4">
        {renderDateFilter()}

        <RadioGroup value={importMode} onValueChange={(v) => setImportMode(v as ImportMode)}>
          <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="all" id="all" className="mt-1" />
            <Label htmlFor="all" className="cursor-pointer flex-1">
              <div className="font-medium">Importar todos</div>
              <div className="text-sm text-muted-foreground">
                Importa todos os registros do Bling, criando novos e atualizando existentes
              </div>
            </Label>
          </div>
          
          <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="new_only" id="new_only" className="mt-1" />
            <Label htmlFor="new_only" className="cursor-pointer flex-1">
              <div className="font-medium">Apenas novos</div>
              <div className="text-sm text-muted-foreground">
                Importa apenas registros que ainda não existem no ERP local
              </div>
            </Label>
          </div>
          
          <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="update_existing" id="update_existing" className="mt-1" />
            <Label htmlFor="update_existing" className="cursor-pointer flex-1">
              <div className="font-medium">Atualizar existentes + novos</div>
              <div className="text-sm text-muted-foreground">
                Atualiza registros já sincronizados e importa os novos
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={handleClose}>
          Cancelar
        </Button>
        <Button onClick={handleLoadPreview} disabled={preview.isPending}>
          {preview.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Carregando...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Carregar Preview
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  );

  const renderDependenciesStep = () => {
    const getDependencyIcon = (type: BlingDependency['type']) => {
      switch (type) {
        case 'account': return <Wallet className="h-4 w-4" />;
        case 'category': return <FolderOpen className="h-4 w-4" />;
        case 'cost_center': return <Building2 className="h-4 w-4" />;
      }
    };

    const getDependencyLabel = (type: BlingDependency['type']) => {
      switch (type) {
        case 'account': return 'Conta';
        case 'category': return 'Categoria';
        case 'cost_center': return 'Centro de Custo';
      }
    };

    return (
      <>
        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-700 dark:text-amber-400">
                Dados Dependentes Encontrados
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                Os registros do Bling utilizam contas, categorias ou centros de custo que ainda não existem no seu ERP.
              </p>
            </div>
          </div>

          <ScrollArea className="h-[200px] border rounded-lg">
            <div className="p-2 space-y-1">
              {missingDependencies.map((dep, index) => (
                <div
                  key={`${dep.type}-${dep.blingId}-${index}`}
                  className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    {getDependencyIcon(dep.type)}
                    <span className="font-medium">{dep.name}</span>
                  </div>
                  <Badge variant="outline">
                    {getDependencyLabel(dep.type)}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex items-start space-x-3 p-3 rounded-lg border bg-muted/50">
            <Checkbox
              id="createDeps"
              checked={createMissingDependencies}
              onCheckedChange={(checked) => setCreateMissingDependencies(!!checked)}
            />
            <Label htmlFor="createDeps" className="cursor-pointer">
              <div className="font-medium">Criar automaticamente</div>
              <div className="text-sm text-muted-foreground">
                Cria as contas, categorias e centros de custo que faltam no ERP local
              </div>
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setStep('options')}>
            Voltar
          </Button>
          <Button onClick={() => setStep('preview')}>
            Continuar
          </Button>
        </DialogFooter>
      </>
    );
  };

  const renderPreviewStep = () => {
    const summary = {
      total: items.length,
      new: items.filter(i => i.isNew).length,
      existing: items.filter(i => !i.isNew).length,
      selected: selectedItems.length,
    };

    return (
      <>
        <div className="space-y-4 py-4">
          {/* Summary badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-sm">
              Total: {summary.total}
            </Badge>
            <Badge variant="default" className="text-sm bg-green-600">
              Novos: {summary.new}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              Existentes: {summary.existing}
            </Badge>
            <Badge variant="default" className="text-sm">
              Selecionados: {summary.selected}
            </Badge>
          </div>

          {/* Search and quick actions */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {filteredItems.every(i => i.selected) ? 'Desmarcar' : 'Marcar'} todos
            </Button>
            <Button variant="outline" size="sm" onClick={handleSelectNew}>
              Apenas novos
            </Button>
          </div>

          {/* Items list with checkboxes */}
          <ScrollArea className="h-[300px] border rounded-lg">
            <div className="p-2 space-y-1">
              {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? 'Nenhum registro encontrado' : 'Nenhum registro no Bling'}
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors",
                      item.selected && "bg-primary/5"
                    )}
                    onClick={() => handleToggleItem(item.id)}
                  >
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={() => handleToggleItem(item.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{item.name}</span>
                        {item.code && (
                          <span className="text-sm text-muted-foreground">
                            ({item.code})
                          </span>
                        )}
                      </div>
                      {item.value !== undefined && (
                        <span className="text-sm text-muted-foreground">
                          R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                    <Badge variant={item.isNew ? 'default' : 'secondary'} className="shrink-0">
                      {item.isNew ? 'Novo' : 'Já existe'}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setStep('options')}>
            Voltar
          </Button>
          <Button onClick={handleStartImport} disabled={selectedItems.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Importar {selectedItems.length} Registros
          </Button>
        </DialogFooter>
      </>
    );
  };

  const renderImportingStep = () => (
    <div className="py-8 space-y-6">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
        <div className="text-center">
          <h3 className="font-medium text-lg">Importando dados...</h3>
          <p className="text-muted-foreground">
            Aguarde enquanto os dados são sincronizados
          </p>
        </div>
      </div>
      <Progress value={undefined} className="w-full" />
    </div>
  );

  const renderCompleteStep = () => {
    const result = importMutation.data;
    const hasErrors = (result?.errors || 0) > 0;

    return (
      <>
        <div className="py-8 space-y-6">
          <div className="flex flex-col items-center gap-4">
            {hasErrors ? (
              <AlertCircle className="h-12 w-12 text-amber-500" />
            ) : (
              <CheckCircle className="h-12 w-12 text-green-500" />
            )}
            <div className="text-center">
              <h3 className="font-medium text-lg">
                {hasErrors ? 'Importação concluída com avisos' : 'Importação concluída!'}
              </h3>
              <p className="text-muted-foreground">
                Os dados foram sincronizados com sucesso
              </p>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{result?.created || 0}</div>
              <div className="text-sm text-muted-foreground">Criados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{result?.updated || 0}</div>
              <div className="text-sm text-muted-foreground">Atualizados</div>
            </div>
            {result?.dependenciesCreated && result.dependenciesCreated > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{result.dependenciesCreated}</div>
                <div className="text-sm text-muted-foreground">Dependências</div>
              </div>
            )}
            {(result?.errors || 0) > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{result?.errors || 0}</div>
                <div className="text-sm text-muted-foreground">Erros</div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleClose}>
            Fechar
          </Button>
        </DialogFooter>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {config.title}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        {step === 'options' && renderOptionsStep()}
        {step === 'dependencies' && renderDependenciesStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'importing' && renderImportingStep()}
        {step === 'complete' && renderCompleteStep()}
      </DialogContent>
    </Dialog>
  );
}
