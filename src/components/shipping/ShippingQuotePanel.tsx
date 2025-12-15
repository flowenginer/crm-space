import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  Plus, Trash2, Truck, Package, Loader2, AlertTriangle, 
  ArrowUpDown, Info, Pencil, Box, MapPin, DollarSign, Check
} from 'lucide-react';
import { useShippingQuote, ShippingOption } from '@/hooks/useShippingQuote';
import { useShippingConfig } from '@/hooks/useShippingConfig';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ShippingVolume {
  id: string;
  height_cm: number;
  width_cm: number;
  length_cm: number;
  weight_kg: number;
}

type SortMode = 'cheapest' | 'fastest';

export function ShippingQuotePanel() {
  const { config } = useShippingConfig();
  const { data: companySettings } = useCompanySettings();
  const { calculateShipping, shippingOptions, isLoading } = useShippingQuote();
  
  const [originCep, setOriginCep] = useState(companySettings?.zip_code?.replace(/\D/g, '') || '');
  const [destinationCep, setDestinationCep] = useState('');
  const [insuranceValue, setInsuranceValue] = useState(100);
  const [volumes, setVolumes] = useState<ShippingVolume[]>([
    { id: crypto.randomUUID(), height_cm: 10, width_cm: 10, length_cm: 10, weight_kg: 0.3 }
  ]);
  const [selectedOption, setSelectedOption] = useState<ShippingOption | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('cheapest');

  const companyOriginCep = companySettings?.zip_code?.replace(/\D/g, '') || '';
  const isConfigured = config?.is_configured;

  // Update origin when company settings load
  useState(() => {
    if (companyOriginCep && !originCep) {
      setOriginCep(companyOriginCep);
    }
  });

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 8);
    if (numbers.length > 5) {
      return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
    }
    return numbers;
  };

  const handleOriginCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOriginCep(e.target.value.replace(/\D/g, '').slice(0, 8));
  };

  const handleDestinationCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDestinationCep(e.target.value.replace(/\D/g, '').slice(0, 8));
  };

  const swapCeps = () => {
    const temp = originCep;
    setOriginCep(destinationCep);
    setDestinationCep(temp);
  };

  const addVolume = () => {
    setVolumes([...volumes, { 
      id: crypto.randomUUID(), 
      height_cm: 10, 
      width_cm: 10, 
      length_cm: 10, 
      weight_kg: 0.3 
    }]);
  };

  const removeVolume = (id: string) => {
    if (volumes.length > 1) {
      setVolumes(volumes.filter(v => v.id !== id));
    }
  };

  const updateVolume = (id: string, field: keyof ShippingVolume, value: number) => {
    setVolumes(volumes.map(v => 
      v.id === id ? { ...v, [field]: value } : v
    ));
  };

  const handleCalculate = async () => {
    if (originCep.length !== 8) {
      setCalcError('CEP de origem inválido');
      return;
    }
    
    if (destinationCep.length !== 8) {
      setCalcError('CEP de destino inválido');
      return;
    }

    setCalcError(null);

    const products = volumes.map(v => ({
      weight: v.weight_kg,
      height: v.height_cm,
      width: v.width_cm,
      length: v.length_cm,
      quantity: 1,
      insurance_value: insuranceValue / volumes.length,
    }));

    try {
      await calculateShipping({
        fromPostalCode: originCep,
        toPostalCode: destinationCep,
        products,
      });
      setShowResults(true);
    } catch (err: any) {
      setCalcError(err.message || 'Erro ao calcular frete');
    }
  };

  const handleEditForm = () => {
    setShowResults(false);
    setSelectedOption(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Calculate totals
  const totalWeight = volumes.reduce((sum, v) => sum + v.weight_kg, 0);
  const totalVolumes = volumes.length;

  // Sorted options
  const sortedOptions = useMemo(() => {
    if (!shippingOptions.length) return [];
    return [...shippingOptions].sort((a, b) => {
      if (sortMode === 'cheapest') {
        return a.price - b.price;
      }
      return a.deliveryDays - b.deliveryDays;
    });
  }, [shippingOptions, sortMode]);

  if (!isConfigured) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              A integração com Melhor Envio não está configurada. 
              Configure em Configurações → Integrações → Melhor Envio.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Results Header - Only show when we have results */}
      {showResults && shippingOptions.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-600 to-blue-500 text-white border-0">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                {/* DE */}
                <div className="space-y-1">
                  <span className="text-xs text-blue-200 uppercase tracking-wider">De</span>
                  <p className="font-semibold">{formatCep(originCep)}</p>
                </div>
                
                {/* PARA */}
                <div className="space-y-1">
                  <span className="text-xs text-blue-200 uppercase tracking-wider">Para</span>
                  <p className="font-semibold">{formatCep(destinationCep)}</p>
                </div>
                
                {/* SEGURO */}
                <div className="space-y-1">
                  <span className="text-xs text-blue-200 uppercase tracking-wider">Valor do Seguro</span>
                  <p className="font-semibold">{formatCurrency(insuranceValue)}</p>
                </div>
                
                {/* VOLUME */}
                <div className="space-y-1">
                  <span className="text-xs text-blue-200 uppercase tracking-wider">Volume</span>
                  <div className="flex items-center gap-2">
                    <Box className="h-4 w-4" />
                    <span className="font-semibold">{totalVolumes} vol. · {totalWeight.toFixed(2)} kg</span>
                  </div>
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white/20"
                onClick={handleEditForm}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form or Results */}
      {!showResults ? (
        <Card>
          <CardContent className="py-6 space-y-6">
            {/* CEP Timeline Section */}
            <div className="flex gap-6">
              {/* Timeline */}
              <div className="flex flex-col items-center py-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <div className="w-0.5 flex-1 bg-border my-1" />
                <div className="w-3 h-3 rounded-full bg-blue-500" />
              </div>

              {/* CEP Inputs */}
              <div className="flex-1 space-y-4">
                {/* Origin */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    CEP de Origem
                  </Label>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={formatCep(originCep)}
                      onChange={handleOriginCepChange}
                      placeholder="00000-000"
                      className="max-w-[160px] font-mono"
                    />
                  </div>
                </div>

                {/* Swap Button */}
                <div className="flex items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={swapCeps}
                    className="text-xs gap-1"
                  >
                    <ArrowUpDown className="h-3 w-3" />
                    Inverter CEPs
                  </Button>
                </div>

                {/* Destination */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    CEP de Destino
                  </Label>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={formatCep(destinationCep)}
                      onChange={handleDestinationCepChange}
                      placeholder="00000-000"
                      className="max-w-[160px] font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t" />

            {/* Insurance Value */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Valor do seguro da carga</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Valor declarado para fins de seguro. Em caso de extravio ou avaria, 
                        o reembolso será baseado neste valor.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="relative max-w-[200px]">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={insuranceValue}
                  onChange={(e) => setInsuranceValue(parseFloat(e.target.value) || 0)}
                  className="pl-9 font-mono"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t" />

            {/* Volumes Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium uppercase tracking-wider">Dados do Volume</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Informe as dimensões e peso de cada volume a ser enviado.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {volumes.map((volume, index) => (
                <div key={volume.id} className="flex items-end gap-3 p-3 bg-muted/50 rounded-lg">
                  {volumes.length > 1 && (
                    <span className="text-xs text-muted-foreground font-medium pb-2">
                      {index + 1}.
                    </span>
                  )}
                  
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Altura</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="1"
                          value={volume.height_cm}
                          onChange={(e) => updateVolume(volume.id, 'height_cm', parseFloat(e.target.value) || 0)}
                          className="pr-10"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          cm
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Largura</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="1"
                          value={volume.width_cm}
                          onChange={(e) => updateVolume(volume.id, 'width_cm', parseFloat(e.target.value) || 0)}
                          className="pr-10"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          cm
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Comprimento</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="1"
                          value={volume.length_cm}
                          onChange={(e) => updateVolume(volume.id, 'length_cm', parseFloat(e.target.value) || 0)}
                          className="pr-10"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          cm
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Peso</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={volume.weight_kg}
                          onChange={(e) => updateVolume(volume.id, 'weight_kg', parseFloat(e.target.value) || 0)}
                          className="pr-10"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          kg
                        </span>
                      </div>
                    </div>
                  </div>

                  {volumes.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:text-destructive"
                      onClick={() => removeVolume(volume.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={addVolume}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                Adicionar volume
              </Button>
            </div>

            {/* Error */}
            {calcError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{calcError}</AlertDescription>
              </Alert>
            )}

            {/* Calculate Button */}
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
              size="lg"
              onClick={handleCalculate}
              disabled={isLoading || originCep.length !== 8 || destinationCep.length !== 8}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calculando...
                </>
              ) : (
                <>
                  <Truck className="h-4 w-4 mr-2" />
                  Calcular Frete
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-4">
            {/* Sort Tabs */}
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant={sortMode === 'cheapest' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortMode('cheapest')}
                className={cn(
                  sortMode === 'cheapest' && 'bg-blue-600 hover:bg-blue-700'
                )}
              >
                Mais barato
              </Button>
              <Button
                variant={sortMode === 'fastest' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortMode('fastest')}
                className={cn(
                  sortMode === 'fastest' && 'bg-blue-600 hover:bg-blue-700'
                )}
              >
                Menor prazo
              </Button>
              <span className="ml-auto text-sm text-muted-foreground">
                {shippingOptions.length} opções encontradas
              </span>
            </div>

            {/* Results Table */}
            {sortedOptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Truck className="h-12 w-12 mb-4 opacity-20" />
                <p>Nenhuma opção de frete disponível</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <span>Transportadora</span>
                  <span>Modalidade</span>
                  <span>Prazo Estimado</span>
                  <span className="text-right">Preço</span>
                  <span className="w-24"></span>
                </div>

                {/* Table Rows */}
                <div className="divide-y">
                  {sortedOptions.map((option) => (
                    <div 
                      key={option.id}
                      className={cn(
                        "grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-4 items-center transition-colors",
                        selectedOption?.id === option.id 
                          ? "bg-blue-50 dark:bg-blue-950/20" 
                          : "hover:bg-muted/30"
                      )}
                    >
                      {/* Carrier */}
                      <div className="flex items-center gap-3">
                        {option.companyLogo ? (
                          <img 
                            src={option.companyLogo} 
                            alt={option.company}
                            className="h-10 w-16 object-contain rounded bg-white p-1"
                          />
                        ) : (
                          <div className="h-10 w-16 bg-muted rounded flex items-center justify-center">
                            <Truck className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <span className="font-medium">{option.company}</span>
                      </div>

                      {/* Modality */}
                      <div className="text-sm">
                        <span className="md:hidden text-xs text-muted-foreground mr-2">Modalidade:</span>
                        <span className="text-blue-600 dark:text-blue-400">{option.name}</span>
                      </div>

                      {/* Delivery Time */}
                      <div className="text-sm">
                        <span className="md:hidden text-xs text-muted-foreground mr-2">Prazo:</span>
                        <span>
                          {option.deliveryRange?.min !== option.deliveryRange?.max 
                            ? `${option.deliveryRange?.min} a ${option.deliveryRange?.max} dias úteis`
                            : `${option.deliveryDays} dias úteis`
                          }
                        </span>
                      </div>

                      {/* Price */}
                      <div className="md:text-right">
                        <span className="md:hidden text-xs text-muted-foreground mr-2">Preço:</span>
                        <div>
                          {option.discount > 0 && (
                            <span className="text-xs text-muted-foreground line-through mr-2">
                              {formatCurrency(option.originalPrice)}
                            </span>
                          )}
                          <span className="font-bold text-lg">{formatCurrency(option.price)}</span>
                        </div>
                      </div>

                      {/* Select Button */}
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => setSelectedOption(option)}
                          className={cn(
                            "w-24",
                            selectedOption?.id === option.id 
                              ? "bg-green-600 hover:bg-green-700" 
                              : "bg-blue-600 hover:bg-blue-700"
                          )}
                        >
                          {selectedOption?.id === option.id ? (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Selecionado
                            </>
                          ) : (
                            'Selecionar'
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
