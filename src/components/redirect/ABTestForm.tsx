import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Info, Target, Calendar, Eye, Users } from 'lucide-react';
import { useRedirectCampaigns } from '@/hooks/useRedirectCampaigns';
import { CampaignMultiSelect } from './CampaignMultiSelect';
import type { ABTest, CreateABTestInput } from '@/hooks/useABTests';

interface ABTestFormProps {
  abTest?: ABTest | null;
  onSubmit: (data: CreateABTestInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

type GoalType = 'none' | 'visits' | 'leads' | 'time';

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
  
  // New goal fields
  const [goalType, setGoalType] = useState<GoalType>(() => {
    if (abTest?.goal_type) return abTest.goal_type as GoalType;
    return 'none';
  });
  const [goalValue, setGoalValue] = useState<number>(abTest?.goal_value || 1000);
  const [endDate, setEndDate] = useState<string>(() => {
    if (abTest?.end_date) {
      return new Date(abTest.end_date).toISOString().split('T')[0];
    }
    // Default to 7 days from now
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  });
  const [autoWinner, setAutoWinner] = useState(abTest?.auto_winner || false);

  // Auto-generate slug
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

  // Adjust weights when campaigns change
  useEffect(() => {
    if (distributionType === 'equal' && selectedCampaigns.length > 0) {
      const equalWeight = Math.floor(100 / selectedCampaigns.length);
      const newWeights: Record<string, number> = {};
      selectedCampaigns.forEach((id, index) => {
        if (index === selectedCampaigns.length - 1) {
          newWeights[id] = 100 - (equalWeight * (selectedCampaigns.length - 1));
        } else {
          newWeights[id] = equalWeight;
        }
      });
      setWeights(newWeights);
    }
  }, [selectedCampaigns, distributionType]);

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
      goal_type: goalType === 'none' ? undefined : goalType,
      goal_value: goalType === 'time' ? undefined : goalValue,
      end_date: goalType === 'time' ? new Date(endDate).toISOString() : undefined,
      auto_winner: autoWinner,
    });
  };

  const activeCampaigns = campaigns.filter(c => c.is_active);
  const baseUrl = window.location.origin;
  const selectedCampaignDetails = activeCampaigns.filter(c => selectedCampaigns.includes(c.id));

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* Section 1: Basic Info */}
      <div className="space-y-4">
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
          <Label htmlFor="slug">URL do Teste</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {baseUrl}/ab/
            </span>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="meu-teste"
              required
              className="flex-1"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Section 2: Campaign Selection */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <Label>Campanhas do Teste</Label>
        </div>
        
        {activeCampaigns.length < 2 ? (
          <Card className="border-dashed">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Info className="h-4 w-4" />
                <p className="text-sm">
                  Você precisa ter pelo menos 2 campanhas ativas para criar um teste A/B.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <CampaignMultiSelect
            campaigns={campaigns}
            selectedIds={selectedCampaigns}
            onSelectionChange={setSelectedCampaigns}
          />
        )}

        {selectedCampaigns.length < 2 && selectedCampaigns.length > 0 && (
          <p className="text-sm text-amber-600">
            Selecione pelo menos 2 campanhas para o teste A/B
          </p>
        )}
      </div>

      <Separator />

      {/* Section 3: Distribution */}
      <div className="space-y-4">
        <Label>Distribuição de Tráfego</Label>
        <RadioGroup
          value={distributionType}
          onValueChange={(v) => setDistributionType(v as 'equal' | 'weighted')}
          className="grid grid-cols-2 gap-4"
        >
          <Label
            htmlFor="equal"
            className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              distributionType === 'equal' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <RadioGroupItem value="equal" id="equal" />
            <div>
              <p className="font-medium">Distribuição Igual</p>
              <p className="text-xs text-muted-foreground">
                {selectedCampaigns.length > 0
                  ? `${Math.floor(100 / selectedCampaigns.length)}% cada`
                  : 'Dividir igualmente'}
              </p>
            </div>
          </Label>
          <Label
            htmlFor="weighted"
            className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              distributionType === 'weighted' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <RadioGroupItem value="weighted" id="weighted" />
            <div>
              <p className="font-medium">Peso Personalizado</p>
              <p className="text-xs text-muted-foreground">Definir percentual manualmente</p>
            </div>
          </Label>
        </RadioGroup>

        {/* Weight sliders for weighted distribution */}
        {distributionType === 'weighted' && selectedCampaigns.length >= 2 && (
          <Card>
            <CardContent className="p-4 space-y-4">
              {selectedCampaignDetails.map((campaign) => (
                <div key={campaign.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{campaign.name}</span>
                    <Badge variant={weights[campaign.id] > 0 ? 'default' : 'secondary'}>
                      {weights[campaign.id] || 0}%
                    </Badge>
                  </div>
                  <Slider
                    value={[weights[campaign.id] || 0]}
                    onValueChange={([v]) => handleWeightChange(campaign.id, v)}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
              ))}
              
              <div className={`p-3 rounded-lg text-sm ${
                totalWeight === 100 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
              }`}>
                Total: {totalWeight}% {totalWeight !== 100 && '(deve ser 100%)'}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {/* Section 4: Goal Configuration */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <Label>Meta do Teste</Label>
        </div>

        <RadioGroup
          value={goalType}
          onValueChange={(v) => setGoalType(v as GoalType)}
          className="space-y-3"
        >
          <Label
            htmlFor="goal-none"
            className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              goalType === 'none' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <RadioGroupItem value="none" id="goal-none" />
            <div className="flex-1">
              <p className="font-medium">Sem meta definida</p>
              <p className="text-xs text-muted-foreground">Executar indefinidamente</p>
            </div>
          </Label>

          <Label
            htmlFor="goal-visits"
            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              goalType === 'visits' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <RadioGroupItem value="visits" id="goal-visits" className="mt-1" />
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">Por quantidade de visitas</p>
              </div>
              {goalType === 'visits' && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={goalValue}
                    onChange={(e) => setGoalValue(Number(e.target.value))}
                    min={100}
                    step={100}
                    className="w-32"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-sm text-muted-foreground">visitas totais</span>
                </div>
              )}
            </div>
          </Label>

          <Label
            htmlFor="goal-leads"
            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              goalType === 'leads' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <RadioGroupItem value="leads" id="goal-leads" className="mt-1" />
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">Por quantidade de leads</p>
              </div>
              {goalType === 'leads' && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={goalValue}
                    onChange={(e) => setGoalValue(Number(e.target.value))}
                    min={10}
                    step={10}
                    className="w-32"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-sm text-muted-foreground">leads totais</span>
                </div>
              )}
            </div>
          </Label>

          <Label
            htmlFor="goal-time"
            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              goalType === 'time' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <RadioGroupItem value="time" id="goal-time" className="mt-1" />
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">Por tempo</p>
              </div>
              {goalType === 'time' && (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-44"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-sm text-muted-foreground">data de término</span>
                </div>
              )}
            </div>
          </Label>
        </RadioGroup>

        {/* Auto-winner toggle */}
        {goalType !== 'none' && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium text-sm">Encerrar automaticamente</p>
                  <p className="text-xs text-muted-foreground">
                    Ao atingir a meta, redirecionar 100% do tráfego para o campeão
                  </p>
                </div>
                <Switch
                  checked={autoWinner}
                  onCheckedChange={setAutoWinner}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2 pt-4 border-t sticky bottom-0 bg-background pb-2">
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
