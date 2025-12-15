import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Truck, Package, Calculator, Loader2, AlertTriangle } from 'lucide-react';
import { useShippingQuote, ShippingOption } from '@/hooks/useShippingQuote';
import { useShippingConfig } from '@/hooks/useShippingConfig';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface ShippingItem {
  id: string;
  description: string;
  weight_kg: number;
  height_cm: number;
  width_cm: number;
  length_cm: number;
  quantity: number;
  value: number;
}

export function ShippingQuotePanel() {
  const { config } = useShippingConfig();
  const { data: companySettings } = useCompanySettings();
  const { calculateShipping, shippingOptions, isLoading } = useShippingQuote();
  
  const [destinationCep, setDestinationCep] = useState('');
  const [items, setItems] = useState<ShippingItem[]>([
    { id: crypto.randomUUID(), description: '', weight_kg: 0.3, height_cm: 10, width_cm: 10, length_cm: 10, quantity: 1, value: 100 }
  ]);
  const [selectedOption, setSelectedOption] = useState<ShippingOption | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  const originCep = companySettings?.zip_code?.replace(/\D/g, '') || '';
  const isConfigured = config?.is_configured;

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 8);
    if (numbers.length > 5) {
      return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
    }
    return numbers;
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDestinationCep(formatCep(e.target.value));
  };

  const addItem = () => {
    setItems([...items, { 
      id: crypto.randomUUID(), 
      description: '', 
      weight_kg: 0.3, 
      height_cm: 10, 
      width_cm: 10, 
      length_cm: 10, 
      quantity: 1, 
      value: 100 
    }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof ShippingItem, value: string | number) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleCalculate = async () => {
    const cleanDestCep = destinationCep.replace(/\D/g, '');
    
    if (!originCep || originCep.length !== 8) {
      setCalcError('Configure o CEP de origem da empresa');
      return;
    }
    
    if (cleanDestCep.length !== 8) {
      setCalcError('CEP de destino inválido');
      return;
    }

    setCalcError(null);

    const products = items.map(item => ({
      weight: item.weight_kg,
      height: item.height_cm,
      width: item.width_cm,
      length: item.length_cm,
      quantity: item.quantity,
      insurance_value: item.value,
    }));

    try {
      await calculateShipping({
        fromPostalCode: originCep,
        toPostalCode: cleanDestCep,
        products,
      });
    } catch (err: any) {
      setCalcError(err.message || 'Erro ao calcular frete');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Calculate totals
  const totalWeight = items.reduce((sum, item) => sum + (item.weight_kg * item.quantity), 0);
  const totalValue = items.reduce((sum, item) => sum + (item.value * item.quantity), 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  if (!isConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Consulta de Frete
          </CardTitle>
        </CardHeader>
        <CardContent>
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Dados do Envio
          </CardTitle>
          <CardDescription>
            Informe os dados para calcular o frete
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* CEPs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CEP Origem</Label>
              <Input 
                value={originCep ? formatCep(originCep) : ''} 
                disabled 
                placeholder="Configurar na empresa"
              />
              {!originCep && (
                <p className="text-xs text-destructive">Configure o CEP da empresa</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>CEP Destino</Label>
              <Input 
                value={destinationCep}
                onChange={handleCepChange}
                placeholder="00000-000"
                maxLength={9}
              />
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Produtos</Label>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-4">
                {items.map((item, index) => (
                  <Card key={item.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-sm font-medium text-muted-foreground">
                        Item {index + 1}
                      </span>
                      {items.length > 1 && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Input 
                        placeholder="Descrição (opcional)"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      />
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Peso (kg)</Label>
                          <Input 
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={item.weight_kg}
                            onChange={(e) => updateItem(item.id, 'weight_kg', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Quantidade</Label>
                          <Input 
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Altura (cm)</Label>
                          <Input 
                            type="number"
                            min="1"
                            value={item.height_cm}
                            onChange={(e) => updateItem(item.id, 'height_cm', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Largura (cm)</Label>
                          <Input 
                            type="number"
                            min="1"
                            value={item.width_cm}
                            onChange={(e) => updateItem(item.id, 'width_cm', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Comp. (cm)</Label>
                          <Input 
                            type="number"
                            min="1"
                            value={item.length_cm}
                            onChange={(e) => updateItem(item.id, 'length_cm', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Valor Declarado (R$)</Label>
                        <Input 
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.value}
                          onChange={(e) => updateItem(item.id, 'value', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Totals */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{totalItems} itens</Badge>
            <Badge variant="secondary">{totalWeight.toFixed(2)} kg</Badge>
            <Badge variant="secondary">{formatCurrency(totalValue)}</Badge>
          </div>

          {/* Calculate Button */}
          <Button 
            className="w-full" 
            onClick={handleCalculate}
            disabled={isLoading || !originCep || destinationCep.replace(/\D/g, '').length !== 8}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Calculando...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4 mr-2" />
                Calcular Frete
              </>
            )}
          </Button>

          {calcError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{calcError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Right: Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Opções de Envio
          </CardTitle>
          <CardDescription>
            {shippingOptions.length > 0 
              ? `${shippingOptions.length} opção(ões) encontrada(s)` 
              : 'Calcule o frete para ver as opções'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {shippingOptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Truck className="h-12 w-12 mb-4 opacity-20" />
              <p>Preencha os dados e clique em "Calcular Frete"</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {shippingOptions.map((option) => (
                  <Card 
                    key={option.id}
                    className={`p-4 cursor-pointer transition-all hover:border-primary ${
                      selectedOption?.id === option.id ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => setSelectedOption(option)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {option.companyLogo && (
                          <img 
                            src={option.companyLogo} 
                            alt={option.company}
                            className="h-10 w-10 object-contain rounded"
                          />
                        )}
                        <div>
                          <p className="font-medium">{option.company}</p>
                          <p className="text-sm text-muted-foreground">{option.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">
                          {formatCurrency(option.price)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {option.deliveryDays} dias úteis
                        </p>
                        {option.discount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            -{option.discount}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
