import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Truck, Package, Clock, Check, AlertCircle } from 'lucide-react';
import { useShippingQuote, ShippingOption, ShippingProduct } from '@/hooks/useShippingQuote';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { cn } from '@/lib/utils';

interface ShippingCalculatorProps {
  destinationPostalCode?: string;
  products: Array<{
    weight_kg?: number;
    height_cm?: number;
    width_cm?: number;
    length_cm?: number;
    quantity: number;
    unit_price: number;
  }>;
  onSelectShipping: (option: { 
    method: string; 
    cost: number; 
    deliveryDays: number;
    serviceId: number;
    company: string;
  }) => void;
  selectedServiceId?: number;
}

export function ShippingCalculator({ 
  destinationPostalCode: initialPostalCode = '', 
  products,
  onSelectShipping,
  selectedServiceId
}: ShippingCalculatorProps) {
  const [destinationCep, setDestinationCep] = useState(initialPostalCode);
  const { data: companySettings } = useCompanySettings();
  const { 
    calculateShipping, 
    isLoading, 
    shippingOptions,
    clearShippingOptions 
  } = useShippingQuote();

  useEffect(() => {
    if (initialPostalCode) {
      setDestinationCep(initialPostalCode);
    }
  }, [initialPostalCode]);

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setDestinationCep(formatted);
    clearShippingOptions();
  };

  const handleCalculate = async () => {
    if (!companySettings?.zip_code) {
      return;
    }

    const cleanCep = destinationCep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      return;
    }

    // Convert products to shipping format
    const shippingProducts: ShippingProduct[] = products.map(p => ({
      weight: p.weight_kg || 0.3, // Default 300g
      height: p.height_cm || 10,
      width: p.width_cm || 10,
      length: p.length_cm || 10,
      quantity: p.quantity,
      insurance_value: p.unit_price * p.quantity,
    }));

    await calculateShipping({
      fromPostalCode: companySettings.zip_code,
      toPostalCode: cleanCep,
      products: shippingProducts,
    });
  };

  const handleSelectOption = (option: ShippingOption) => {
    onSelectShipping({
      method: option.name,
      cost: option.price,
      deliveryDays: option.deliveryDays,
      serviceId: option.id,
      company: option.company,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const originCep = companySettings?.zip_code;
  const canCalculate = originCep && destinationCep.replace(/\D/g, '').length === 8;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Truck className="h-4 w-4" />
        <span>Cotação de Frete - Melhor Envio</span>
      </div>

      {!originCep && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Configure o CEP de origem nas Configurações da Empresa</span>
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="destination-cep" className="text-xs text-muted-foreground">
            CEP de Destino
          </Label>
          <Input
            id="destination-cep"
            value={destinationCep}
            onChange={handleCepChange}
            placeholder="00000-000"
            maxLength={9}
          />
        </div>
        <div className="flex items-end">
          <Button 
            onClick={handleCalculate} 
            disabled={!canCalculate || isLoading}
            size="sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Calculando...
              </>
            ) : (
              <>
                <Package className="h-4 w-4 mr-2" />
                Calcular
              </>
            )}
          </Button>
        </div>
      </div>

      {originCep && (
        <p className="text-xs text-muted-foreground">
          Origem: {originCep}
        </p>
      )}

      {shippingOptions.length > 0 && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {shippingOptions.map((option) => (
            <div
              key={option.id}
              onClick={() => handleSelectOption(option)}
              className={cn(
                "flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors",
                selectedServiceId === option.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3">
                {option.companyLogo && (
                  <img 
                    src={option.companyLogo} 
                    alt={option.company}
                    className="h-8 w-8 object-contain rounded"
                  />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{option.name}</span>
                    {selectedServiceId === option.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{option.company}</p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center gap-2">
                  {option.discount > 0 && (
                    <span className="text-xs line-through text-muted-foreground">
                      {formatCurrency(option.originalPrice)}
                    </span>
                  )}
                  <span className="font-semibold text-primary">
                    {formatCurrency(option.price)}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    {option.deliveryRange.min === option.deliveryRange.max
                      ? `${option.deliveryRange.min} dias úteis`
                      : `${option.deliveryRange.min}-${option.deliveryRange.max} dias úteis`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {shippingOptions.length === 0 && !isLoading && destinationCep.replace(/\D/g, '').length === 8 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Clique em "Calcular" para ver as opções de frete
        </p>
      )}
    </div>
  );
}
