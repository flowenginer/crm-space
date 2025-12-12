import { useState, useMemo } from 'react';
import { Check, ChevronDown, ChevronUp, Info, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  const [justCreated, setJustCreated] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isVariationsOpen, setIsVariationsOpen] = useState(true);

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

    try {
      await createBulkVariations.mutateAsync({
        template_id: templateId,
        variations: newVariations.map(v => ({
          attribute_value_ids: v.attributeValueIds,
          variation_name: v.name,
          price_adjustment: useGlobalRules ? 0 : v.priceAdjustment,
          adjustment_type: v.adjustmentType,
        })),
      });

      // Clear selections and show success indicator
      setSelectedValues({});
      setJustCreated(true);
      setTimeout(() => setJustCreated(false), 3000);
    } catch (error) {
      // Error is already handled by the mutation
      console.error('Failed to create variations:', error);
    }
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
      {/* Bulk Generator Card - Collapsible */}
      <Collapsible open={isGeneratorOpen} onOpenChange={setIsGeneratorOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Geração em Massa de Variações
                </CardTitle>
                <div className="flex items-center gap-2">
                  {Object.values(selectedValues).some(v => v.length > 0) && (
                    <Badge variant="secondary" className="text-xs">
                      {newVariations.length} novas
                    </Badge>
                  )}
                  {isGeneratorOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              <CardDescription className="text-xs">
                Clique para expandir e gerar combinações automaticamente
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              {/* Attribute Type Sections - Compact */}
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-3 pr-2">
                  {attributeTypes?.map((type) => {
                    const typeSelected = selectedValues[type.id] || [];
                    const allSelected = typeSelected.length === type.values.length && type.values.length > 0;
                    const someSelected = typeSelected.length > 0;

                    return (
                      <div key={type.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium flex items-center gap-2">
                            {type.name}
                            {someSelected && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                {typeSelected.length}
                              </Badge>
                            )}
                          </label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleSelectAll(type.id, type.values)}
                            className="text-[10px] h-6 px-2"
                          >
                            {allSelected ? 'Desmarcar' : 'Selecionar todos'}
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
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
                                        relative flex items-center gap-1.5 px-2 py-1 rounded border text-xs
                                        transition-all duration-200
                                        ${isSelected
                                          ? 'border-primary bg-primary/10 text-primary'
                                          : 'border-border bg-card hover:bg-muted'
                                        }
                                      `}
                                    >
                                      <Checkbox
                                        checked={isSelected}
                                        className="pointer-events-none h-3 w-3"
                                      />
                                      <span>{getValueDisplayName(value)}</span>
                                      {priceRule && useGlobalRules && (
                                        <Badge variant="outline" className="text-[9px] h-4 px-1 bg-amber-500/10 text-amber-600 border-amber-500/30">
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
                        <Separator className="mt-2" />
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Generate Button */}
              {generatedVariations.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline">{generatedVariations.length} total</Badge>
                    {newVariations.length < generatedVariations.length && (
                      <Badge variant="secondary">{generatedVariations.length - newVariations.length} já existem</Badge>
                    )}
                    <Badge className="bg-primary">{newVariations.length} novas</Badge>
                  </div>
                  <Button
                    onClick={handleGenerateVariations}
                    disabled={newVariations.length === 0 || createBulkVariations.isPending}
                    className="w-full h-8 text-sm"
                    size="sm"
                  >
                    <Sparkles className="mr-2 h-3 w-3" />
                    {createBulkVariations.isPending ? 'Gerando...' : `Gerar ${newVariations.length} Variações`}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-3 text-muted-foreground">
                  <Info className="h-5 w-5 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">Selecione os valores dos atributos acima para gerar as combinações</p>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Existing Variations Card - Collapsible */}
      <Collapsible open={isVariationsOpen} onOpenChange={setIsVariationsOpen}>
        <Card className={justCreated ? 'ring-2 ring-green-500 ring-offset-2' : ''}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  Variações do Template ({existingVariations.length})
                  {justCreated && (
                    <Badge className="bg-green-600 text-white animate-pulse text-[10px]">
                      <Check className="h-3 w-3 mr-1" />
                      Criadas!
                    </Badge>
                  )}
                </CardTitle>
                {isVariationsOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="pt-0">
              {existingVariations.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">
                  Nenhuma variação cadastrada
                </p>
              ) : (
                <ScrollArea className="h-[280px]">
                  <div className="space-y-1.5 pr-4">
                    {existingVariations.map((variation) => (
                      <div
                        key={variation.id}
                        className="flex items-center gap-2 p-2 rounded-lg border bg-muted/50"
                      >
                        {/* Badges inline */}
                        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                          {variation.attribute_value_ids.map((valueId) => (
                            <Badge key={valueId} variant="secondary" className="text-[10px] h-5 px-1.5">
                              {getAttributeValueName(valueId)}
                            </Badge>
                          ))}
                          {variation.variation_name && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({variation.variation_name})
                            </span>
                          )}
                        </div>
                        
                        {/* Price info */}
                        {useGlobalRules ? (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">
                            Regras Globais
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {formatPriceAdjustment(variation)}
                          </Badge>
                        )}
                        {variation.weight_override && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {variation.weight_override}kg
                          </Badge>
                        )}
                        
                        {/* Delete button */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 shrink-0"
                          onClick={() => handleDeleteVariation(variation.id)}
                          disabled={deleteVariation.isPending}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
