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
import { AttributeTypeWithValues, AttributeValue } from '@/hooks/useProductAttributes';
import { PriceRuleWithDetails } from '@/hooks/useAttributePriceRules';
import { ProductTemplateVariation, useCreateBulkTemplateVariations, useDeleteTemplateVariation } from '@/hooks/useProductTemplates';

interface TemplateVariationsBulkGeneratorProps {
  templateId: string;
  attributeTypes: AttributeTypeWithValues[];
  priceRules: PriceRuleWithDetails[];
  existingVariations: ProductTemplateVariation[];
  useGlobalRules: boolean;
}

interface GeneratedVariation {
  attributeValueIds: string[];
  name: string;
  priceAdjustment: number;
  adjustmentType: 'fixed' | 'percentage';
}

export function TemplateVariationsBulkGenerator({
  templateId,
  attributeTypes,
  priceRules,
  existingVariations,
  useGlobalRules,
}: TemplateVariationsBulkGeneratorProps) {
  // Track selected values per attribute type
  const [selectedValues, setSelectedValues] = useState<Record<string, string[]>>({});

  const createBulkVariations = useCreateBulkTemplateVariations();
  const deleteVariation = useDeleteTemplateVariation();

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
    const allValueIds = values.map(v => v.id);
    
    if (currentSelected.length === allValueIds.length) {
      // Deselect all
      setSelectedValues(prev => ({ ...prev, [typeId]: [] }));
    } else {
      // Select all
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
      .map(([typeId, valueIds]) => ({
        typeId,
        values: valueIds.map(vId => {
          const type = attributeTypes.find(t => t.id === typeId);
          const value = type?.values.find(v => v.id === vId);
          return { id: vId, name: value ? getValueDisplayName(value) : vId };
        }),
      }));

    if (typesWithSelectedValues.length === 0) return [];

    // Generate combinations using cartesian product
    const combinations = typesWithSelectedValues.reduce<{ ids: string[]; names: string[] }[]>
      ((acc, { values }) => {
        if (acc.length === 0) {
          return values.map(v => ({ ids: [v.id], names: [v.name] }));
        }
        return acc.flatMap(existing =>
          values.map(v => ({
            ids: [...existing.ids, v.id],
            names: [...existing.names, v.name],
          }))
        );
      },
      []
    );

    // Calculate price adjustments based on global rules
    return combinations.map(combo => {
      let totalAdjustment = 0;
      let hasPercentage = false;

      if (useGlobalRules) {
        combo.ids.forEach(valueId => {
          const rule = priceRuleMap[valueId];
          if (rule) {
            if (rule.adjustment_type === 'percentage') {
              hasPercentage = true;
            }
            totalAdjustment += rule.adjustment_value;
          }
        });
      }

      return {
        attributeValueIds: combo.ids,
        name: combo.names.join(' - '),
        priceAdjustment: totalAdjustment,
        adjustmentType: hasPercentage ? 'percentage' : 'fixed',
      };
    });
  }, [selectedValues, attributeTypes, priceRuleMap, useGlobalRules]);

  // Check if a variation already exists
  const variationExists = (attributeValueIds: string[]): boolean => {
    return existingVariations.some(existing => {
      if (existing.attribute_value_ids.length !== attributeValueIds.length) return false;
      return attributeValueIds.every(id => existing.attribute_value_ids.includes(id));
    });
  };

  // Filter out variations that already exist
  const newVariations = generatedVariations.filter(v => !variationExists(v.attributeValueIds));

  // Handle bulk creation
  const handleGenerateVariations = async () => {
    if (newVariations.length === 0) return;

    await createBulkVariations.mutateAsync({
      template_id: templateId,
      variations: newVariations.map(v => ({
        attribute_value_ids: v.attributeValueIds,
        variation_name: v.name,
        price_adjustment: useGlobalRules ? 0 : v.priceAdjustment,
        adjustment_type: v.adjustmentType,
      })),
    });

    // Clear selections after successful creation
    setSelectedValues({});
  };

  // Handle delete variation
  const handleDeleteVariation = async (id: string) => {
    await deleteVariation.mutateAsync(id);
  };

  // Get attribute value name by ID
  const getAttributeValueName = (valueId: string): string => {
    for (const type of attributeTypes) {
      const value = type.values.find(v => v.id === valueId);
      if (value) return getValueDisplayName(value);
    }
    return valueId;
  };

  // Format price adjustment for display
  const formatPriceAdjustment = (variation: ProductTemplateVariation | GeneratedVariation): string => {
    const adjustment = 'price_adjustment' in variation ? variation.price_adjustment : variation.priceAdjustment;
    const type = 'adjustment_type' in variation ? variation.adjustment_type : variation.adjustmentType;
    
    if (adjustment === 0) return '-';
    const sign = adjustment > 0 ? '+' : '';
    if (type === 'percentage') {
      return `${sign}${adjustment}%`;
    }
    return `${sign}R$ ${adjustment.toFixed(2)}`;
  };

  return (
    <div className="space-y-4">
      {/* Bulk Generator Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Geração em Massa de Variações
          </CardTitle>
          <CardDescription>
            Selecione os atributos desejados e gere todas as combinações automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Attribute Type Sections */}
          {attributeTypes?.map((type) => {
            const typeSelected = selectedValues[type.id] || [];
            const allSelected = typeSelected.length === type.values.length && type.values.length > 0;
            const someSelected = typeSelected.length > 0;

            return (
              <div key={type.id} className="space-y-3">
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
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSelectAll(type.id, type.values)}
                    className="text-xs"
                  >
                    {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {type.values.map((value) => {
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
                                relative flex items-center gap-2 px-3 py-2 rounded-lg border text-sm
                                transition-all duration-200
                                ${isSelected
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border bg-card hover:bg-muted'
                                }
                              `}
                            >
                              <Checkbox
                                checked={isSelected}
                                className="pointer-events-none"
                              />
                              <span>{getValueDisplayName(value)}</span>
                              {priceRule && useGlobalRules && (
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
                              <p>Regra de preço global: {priceRule.adjustment_type === 'percentage'
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Preview das Combinações</h4>
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

              <ScrollArea className="h-48 rounded-lg border">
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
                        {useGlobalRules && variation.priceAdjustment !== 0 && (
                          <Badge variant="outline" className="text-xs">
                            {formatPriceAdjustment(variation)}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <Button
                onClick={handleGenerateVariations}
                disabled={newVariations.length === 0 || createBulkVariations.isPending}
                className="w-full"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {createBulkVariations.isPending
                  ? 'Gerando...'
                  : `Gerar ${newVariations.length} Variações`
                }
              </Button>
            </div>
          )}

          {generatedVariations.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Selecione os valores dos atributos acima para gerar as combinações</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Variations Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Variações do Template ({existingVariations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {existingVariations.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nenhuma variação cadastrada
            </p>
          ) : (
            <div className="space-y-2">
              {existingVariations.map((variation) => (
                <div
                  key={variation.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-1 mb-1">
                      {variation.attribute_value_ids.map((valueId) => (
                        <Badge key={valueId} variant="secondary" className="text-xs">
                          {getAttributeValueName(valueId)}
                        </Badge>
                      ))}
                    </div>
                    {variation.variation_name && (
                      <span className="text-sm text-muted-foreground">
                        {variation.variation_name}
                      </span>
                    )}
                  </div>
                  {useGlobalRules ? (
                    <Badge variant="outline" className="text-muted-foreground">
                      Regras Globais
                    </Badge>
                  ) : (
                    <Badge variant="outline">{formatPriceAdjustment(variation)}</Badge>
                  )}
                  {variation.weight_override && (
                    <Badge variant="outline">{variation.weight_override}kg</Badge>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteVariation(variation.id)}
                    disabled={deleteVariation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
