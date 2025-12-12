import { useState, useMemo } from 'react';
import { Check, Info, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAttributeTypes, AttributeTypeWithValues, AttributeValue } from '@/hooks/useProductAttributes';
import { usePriceRules, PriceRuleWithDetails } from '@/hooks/useAttributePriceRules';

interface GeneratedVariation {
  attributeValueIds: string[];
  name: string;
  attributes: Record<string, string>;
  priceAdjustment: number;
}

interface ProductVariationsGeneratorProps {
  onVariationsGenerated: (variations: GeneratedVariation[]) => void;
  existingVariationIds?: string[][];
}

export function ProductVariationsGenerator({
  onVariationsGenerated,
  existingVariationIds = [],
}: ProductVariationsGeneratorProps) {
  const { data: attributeTypes, isLoading: loadingTypes } = useAttributeTypes();
  const { data: priceRules } = usePriceRules();
  
  // Track selected values per attribute type
  const [selectedValues, setSelectedValues] = useState<Record<string, string[]>>({});

  // Create a map of attribute value ID to price rule
  const priceRuleMap = useMemo(() => {
    const map: Record<string, PriceRuleWithDetails> = {};
    priceRules?.forEach(rule => {
      if (rule.is_active) {
        map[rule.attribute_value_id] = rule;
      }
    });
    return map;
  }, [priceRules]);

  // Get the display name for an attribute value
  const getValueDisplayName = (value: AttributeValue): string => {
    return value.display_value || value.value;
  };

  // Toggle all values of an attribute type
  const toggleSelectAll = (typeId: string, values: AttributeValue[]) => {
    const currentSelected = selectedValues[typeId] || [];
    const allValueIds = values.filter(v => v.is_active).map(v => v.id);
    
    if (currentSelected.length === allValueIds.length) {
      setSelectedValues(prev => ({ ...prev, [typeId]: [] }));
    } else {
      setSelectedValues(prev => ({ ...prev, [typeId]: allValueIds }));
    }
  };

  // Toggle a single value
  const toggleValue = (typeId: string, valueId: string) => {
    setSelectedValues(prev => {
      const current = prev[typeId] || [];
      if (current.includes(valueId)) {
        return { ...prev, [typeId]: current.filter(id => id !== valueId) };
      } else {
        return { ...prev, [typeId]: [...current, valueId] };
      }
    });
  };

  // Generate all combinations from selected values
  const generatedVariations = useMemo((): GeneratedVariation[] => {
    const typesWithSelectedValues = Object.entries(selectedValues)
      .filter(([_, values]) => values.length > 0)
      .map(([typeId, valueIds]) => {
        const type = attributeTypes?.find(t => t.id === typeId);
        return {
          typeId,
          typeName: type?.name || '',
          values: valueIds.map(vId => {
            const value = type?.values.find(v => v.id === vId);
            return { id: vId, name: value ? getValueDisplayName(value) : vId };
          }),
        };
      });

    if (typesWithSelectedValues.length === 0) return [];

    // Generate combinations using cartesian product
    const combinations = typesWithSelectedValues.reduce<{ 
      ids: string[]; 
      names: string[];
      attributes: Record<string, string>;
    }[]>(
      (acc, { typeName, values }) => {
        if (acc.length === 0) {
          return values.map(v => ({ 
            ids: [v.id], 
            names: [v.name],
            attributes: { [typeName]: v.name },
          }));
        }
        return acc.flatMap(existing =>
          values.map(v => ({
            ids: [...existing.ids, v.id],
            names: [...existing.names, v.name],
            attributes: { ...existing.attributes, [typeName]: v.name },
          }))
        );
      },
      []
    );

    // Calculate price adjustments based on global rules
    return combinations.map(combo => {
      let totalAdjustment = 0;

      combo.ids.forEach(valueId => {
        const rule = priceRuleMap[valueId];
        if (rule && rule.adjustment_type === 'fixed') {
          totalAdjustment += rule.adjustment_value;
        }
      });

      return {
        attributeValueIds: combo.ids,
        name: combo.names.join(' - '),
        attributes: combo.attributes,
        priceAdjustment: totalAdjustment,
      };
    });
  }, [selectedValues, attributeTypes, priceRuleMap]);

  // Check if a variation already exists
  const variationExists = (attributeValueIds: string[]): boolean => {
    return existingVariationIds.some(existing => {
      if (existing.length !== attributeValueIds.length) return false;
      return attributeValueIds.every(id => existing.includes(id));
    });
  };

  // Filter out variations that already exist
  const newVariations = generatedVariations.filter(v => !variationExists(v.attributeValueIds));

  // Handle confirm selection
  const handleConfirm = () => {
    onVariationsGenerated(newVariations);
  };

  // Clear all selections
  const handleClear = () => {
    setSelectedValues({});
  };

  if (loadingTypes) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        Carregando atributos...
      </div>
    );
  }

  const activeTypes = attributeTypes?.filter(t => t.is_active && t.values.some(v => v.is_active)) || [];

  if (activeTypes.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Nenhum atributo cadastrado.</p>
        <p className="text-sm">Cadastre atributos em Produtos → Atributos antes de criar variações.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Selecionar Atributos
          </CardTitle>
          <CardDescription>
            Selecione os valores de cada atributo para gerar as combinações de variações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Attribute Type Sections */}
          {activeTypes.map((type) => {
            const typeSelected = selectedValues[type.id] || [];
            const activeValues = type.values.filter(v => v.is_active);
            const allSelected = typeSelected.length === activeValues.length && activeValues.length > 0;
            const someSelected = typeSelected.length > 0;

            return (
              <div key={type.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    {type.name}
                    {someSelected && (
                      <Badge variant="secondary" className="text-xs">
                        {typeSelected.length} selecionados
                      </Badge>
                    )}
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSelectAll(type.id, activeValues)}
                    className="text-xs h-7"
                  >
                    {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeValues.map((value) => {
                    const isSelected = typeSelected.includes(value.id);
                    const priceRule = priceRuleMap[value.id];

                    return (
                      <TooltipProvider key={value.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => toggleValue(type.id, value.id)}
                              className={`
                                relative flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm
                                transition-all duration-200
                                ${isSelected
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border bg-card hover:bg-muted'
                                }
                              `}
                            >
                              <Checkbox
                                checked={isSelected}
                                className="pointer-events-none h-3.5 w-3.5"
                              />
                              <span>{getValueDisplayName(value)}</span>
                              {priceRule && (
                                <Badge variant="outline" className="text-xs ml-1 bg-amber-500/10 text-amber-600 border-amber-500/30">
                                  {priceRule.adjustment_type === 'percentage'
                                    ? `${priceRule.adjustment_value > 0 ? '+' : ''}${priceRule.adjustment_value}%`
                                    : `${priceRule.adjustment_value > 0 ? '+' : ''}R$${priceRule.adjustment_value}`
                                  }
                                </Badge>
                              )}
                            </button>
                          </TooltipTrigger>
                          {priceRule && (
                            <TooltipContent>
                              <p>Regra de preço: {priceRule.adjustment_type === 'percentage'
                                ? `${priceRule.adjustment_value}%`
                                : `R$ ${priceRule.adjustment_value.toFixed(2)}`
                              }</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
                <Separator />
              </div>
            );
          })}

          {/* Preview Section */}
          {generatedVariations.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Preview das Variações</h4>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">
                    {generatedVariations.length} total
                  </Badge>
                  {newVariations.length < generatedVariations.length && (
                    <Badge variant="secondary">
                      {generatedVariations.length - newVariations.length} já existem
                    </Badge>
                  )}
                  <Badge className="bg-primary">
                    {newVariations.length} novas
                  </Badge>
                </div>
              </div>

              <ScrollArea className="h-40 rounded-lg border">
                <div className="p-2 space-y-1">
                  {generatedVariations.map((variation, index) => {
                    const exists = variationExists(variation.attributeValueIds);
                    return (
                      <div
                        key={index}
                        className={`
                          flex items-center justify-between p-2 rounded text-sm
                          ${exists ? 'bg-muted/50 text-muted-foreground' : 'bg-primary/5'}
                        `}
                      >
                        <div className="flex items-center gap-2">
                          {exists && <Check className="h-3 w-3 text-green-500" />}
                          <span className={exists ? 'line-through opacity-50' : ''}>
                            {variation.name}
                          </span>
                        </div>
                        {variation.priceAdjustment !== 0 && (
                          <Badge variant="outline" className="text-xs">
                            {variation.priceAdjustment > 0 ? '+' : ''}R$ {variation.priceAdjustment.toFixed(2)}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClear}
                  className="flex-1"
                >
                  Limpar Seleção
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={newVariations.length === 0}
                  className="flex-1"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Usar {newVariations.length} Variações
                </Button>
              </div>
            </div>
          )}

          {generatedVariations.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              <Info className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Selecione os valores dos atributos acima para gerar as combinações</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
