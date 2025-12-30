import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Info } from 'lucide-react';
import { useRedirectCampaigns, type RedirectCampaign } from '@/hooks/useRedirectCampaigns';
import type { ABTest, CreateABTestInput } from '@/hooks/useABTests';

interface ABTestFormProps {
  abTest?: ABTest | null;
  onSubmit: (data: CreateABTestInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ABTestForm({ abTest, onSubmit, onCancel, isLoading }: ABTestFormProps) {
  const { data: campaigns = [] } = useRedirectCampaigns();
  
  const [name, setName] = useState(abTest?.name || '');
  const [slug, setSlug] = useState(abTest?.slug || '');
  const [distributionType, setDistributionType] = useState<'equal' | 'weighted'>(
    abTest?.distribution_type || 'equal'
  );
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>(
    abTest?.variants?.map(v => v.campaign_id) || []
  );
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    abTest?.variants?.forEach(v => {
      initial[v.campaign_id] = v.weight;
    });
    return initial;
  });

  // Gerar slug automaticamente
  useEffect(() => {
    if (!abTest && name) {
      const generatedSlug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setSlug(generatedSlug);
    }
  }, [name, abTest]);

  // Ajustar pesos quando campanhas selecionadas mudam
  useEffect(() => {
    if (distributionType === 'equal' && selectedCampaigns.length > 0) {
      const equalWeight = Math.floor(100 / selectedCampaigns.length);
      const newWeights: Record<string, number> = {};
      selectedCampaigns.forEach((id, index) => {
        // Último item recebe o restante para garantir 100%
        if (index === selectedCampaigns.length - 1) {
          newWeights[id] = 100 - (equalWeight * (selectedCampaigns.length - 1));
        } else {
          newWeights[id] = equalWeight;
        }
      });
      setWeights(newWeights);
    }
  }, [selectedCampaigns, distributionType]);

  const handleCampaignToggle = (campaignId: string) => {
    setSelectedCampaigns(prev => {
      if (prev.includes(campaignId)) {
        return prev.filter(id => id !== campaignId);
      }
      return [...prev, campaignId];
    });
  };

  const handleWeightChange = (campaignId: string, value: number) => {
    setWeights(prev => ({
      ...prev,
      [campaignId]: value,
    }));
  };

  const totalWeight = selectedCampaigns.reduce((sum, id) => sum + (weights[id] || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedCampaigns.length < 2) {
      return;
    }

    await onSubmit({
      name,
      slug,
      distribution_type: distributionType,
      campaign_ids: selectedCampaigns,
      weights: distributionType === 'weighted' ? weights : undefined,
    });
  };

  const activeCampaigns = campaigns.filter(c => c.is_active);
  const baseUrl = window.location.origin;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Nome e Slug */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome do Teste</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Landing Nova vs Antiga"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="slug">Slug (URL)</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="meu-teste-ab"
            required
          />
          <p className="text-xs text-muted-foreground">
            {baseUrl}/ab/{slug || 'meu-teste'}
          </p>
        </div>
      </div>

      {/* Tipo de Distribuição */}
      <div className="space-y-3">
        <Label>Tipo de Distribuição</Label>
        <RadioGroup
          value={distributionType}
          onValueChange={(v) => setDistributionType(v as 'equal' | 'weighted')}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="equal" id="equal" />
            <Label htmlFor="equal" className="font-normal cursor-pointer">
              Distribuição Igual
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="weighted" id="weighted" />
            <Label htmlFor="weighted" className="font-normal cursor-pointer">
              Peso Personalizado
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Seleção de Campanhas */}
      <div className="space-y-3">
        <Label>Selecione as Campanhas (mínimo 2)</Label>
        
        {activeCampaigns.length < 2 ? (
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Info className="h-4 w-4" />
              <p className="text-sm">
                Você precisa ter pelo menos 2 campanhas ativas para criar um teste A/B.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {activeCampaigns.map((campaign) => (
              <Card 
                key={campaign.id}
                className={`transition-colors ${
                  selectedCampaigns.includes(campaign.id) 
                    ? 'border-primary bg-primary/5' 
                    : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={campaign.id}
                      checked={selectedCampaigns.includes(campaign.id)}
                      onCheckedChange={() => handleCampaignToggle(campaign.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <label 
                          htmlFor={campaign.id}
                          className="font-medium cursor-pointer"
                        >
                          {campaign.name}
                        </label>
                        <Badge variant="outline" className="text-xs">
                          /r/{campaign.slug}
                        </Badge>
                      </div>
                      
                      {selectedCampaigns.includes(campaign.id) && distributionType === 'weighted' && (
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Peso</span>
                            <span className="text-sm font-medium">{weights[campaign.id] || 0}%</span>
                          </div>
                          <Slider
                            value={[weights[campaign.id] || 0]}
                            onValueChange={([v]) => handleWeightChange(campaign.id, v)}
                            max={100}
                            step={1}
                            className="w-full"
                          />
                        </div>
                      )}
                      
                      {selectedCampaigns.includes(campaign.id) && distributionType === 'equal' && (
                        <div className="mt-2">
                          <Badge variant="secondary" className="text-xs">
                            {weights[campaign.id] || 0}% do tráfego
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Aviso de peso total */}
      {distributionType === 'weighted' && selectedCampaigns.length >= 2 && (
        <div className={`p-3 rounded-lg ${
          totalWeight === 100 
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
        }`}>
          <p className="text-sm">
            Total: {totalWeight}% {totalWeight !== 100 && '(deve ser 100%)'}
          </p>
        </div>
      )}

      {/* Botões */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          type="submit" 
          disabled={
            isLoading || 
            selectedCampaigns.length < 2 || 
            (distributionType === 'weighted' && totalWeight !== 100)
          }
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {abTest ? 'Atualizar' : 'Criar'} Teste A/B
        </Button>
      </div>
    </form>
  );
}
