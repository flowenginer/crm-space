import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Palette, Users, Percent } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { RedirectCampaign } from '@/hooks/useRedirectCampaigns';

const campaignSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  slug: z.string().min(1, 'Slug é obrigatório').regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  button_text: z.string().optional(),
  button_color: z.string().optional(),
  background_color: z.string().optional(),
  welcome_message: z.string().optional(),
  logo_url: z.string().optional(),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

interface ChannelSelection {
  channel_id: string;
  percentage: number;
}

interface RedirectCampaignFormProps {
  campaign?: RedirectCampaign | null;
  onSubmit: (data: CampaignFormData & { 
    channel_ids: string[];
    distribution_mode: 'equal' | 'percentage';
    channel_percentages: Record<string, number>;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function RedirectCampaignForm({ campaign, onSubmit, onCancel, isLoading }: RedirectCampaignFormProps) {
  const { profile } = useAuth();
  const { data: channels = [] } = useQuery({
    queryKey: ['whatsapp-channels', profile?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_channels')
        .select('id, name, phone, status')
        .eq('tenant_id', profile?.tenant_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.tenant_id,
  });
  
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [distributionMode, setDistributionMode] = useState<'equal' | 'percentage'>('equal');
  const [channelPercentages, setChannelPercentages] = useState<Record<string, number>>({});

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: campaign?.name || '',
      slug: campaign?.slug || '',
      title: campaign?.title || 'Fale com nosso time!',
      subtitle: campaign?.subtitle || '',
      button_text: campaign?.button_text || 'Falar com Vendedor',
      button_color: campaign?.button_color || '#8B5CF6',
      background_color: campaign?.background_color || '#FFFFFF',
      welcome_message: campaign?.welcome_message || 'Olá! Vi seu anúncio e gostaria de mais informações.',
      logo_url: campaign?.logo_url || '',
    },
  });

  useEffect(() => {
    if (campaign?.channels) {
      setSelectedChannels(campaign.channels.map(c => c.channel_id));
      
      // Carregar modo de distribuição e porcentagens existentes
      const mode = (campaign as any).distribution_mode || 'equal';
      setDistributionMode(mode);
      
      const percentages: Record<string, number> = {};
      campaign.channels.forEach(c => {
        percentages[c.channel_id] = (c as any).percentage || 0;
      });
      setChannelPercentages(percentages);
    }
  }, [campaign]);

  // Quando canais são selecionados, distribuir porcentagem igualmente por padrão
  useEffect(() => {
    if (selectedChannels.length > 0 && distributionMode === 'percentage') {
      const equalPercentage = Math.floor(100 / selectedChannels.length);
      const remainder = 100 - (equalPercentage * selectedChannels.length);
      
      const newPercentages: Record<string, number> = {};
      selectedChannels.forEach((id, index) => {
        // Se já tem porcentagem definida, manter; senão usar igual
        if (channelPercentages[id] !== undefined) {
          newPercentages[id] = channelPercentages[id];
        } else {
          newPercentages[id] = equalPercentage + (index === 0 ? remainder : 0);
        }
      });
      
      // Só atualizar se não houver porcentagens definidas ainda
      const hasExistingPercentages = selectedChannels.some(id => channelPercentages[id] !== undefined);
      if (!hasExistingPercentages) {
        setChannelPercentages(newPercentages);
      }
    }
  }, [selectedChannels.length, distributionMode]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setValue('name', name);
    
    // Auto-generate slug from name
    if (!campaign) {
      const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setValue('slug', slug);
    }
  };

  const toggleChannel = (channelId: string) => {
    setSelectedChannels(prev => {
      if (prev.includes(channelId)) {
        // Remover canal e sua porcentagem
        const newPercentages = { ...channelPercentages };
        delete newPercentages[channelId];
        setChannelPercentages(newPercentages);
        return prev.filter(id => id !== channelId);
      } else {
        return [...prev, channelId];
      }
    });
  };

  const handlePercentageChange = (channelId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setChannelPercentages(prev => ({
      ...prev,
      [channelId]: Math.min(100, Math.max(0, numValue))
    }));
  };

  const getTotalPercentage = () => {
    return selectedChannels.reduce((sum, id) => sum + (channelPercentages[id] || 0), 0);
  };

  const handleFormSubmit = (data: CampaignFormData) => {
    onSubmit({ 
      ...data, 
      channel_ids: selectedChannels,
      distribution_mode: distributionMode,
      channel_percentages: channelPercentages
    });
  };

  const buttonColor = watch('button_color');
  const backgroundColor = watch('background_color');
  const connectedChannels = channels.filter(c => c.status === 'connected');
  const totalPercentage = getTotalPercentage();
  const isPercentageValid = distributionMode === 'equal' || totalPercentage === 100;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Informações básicas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Campanha *</Label>
              <Input
                id="name"
                {...register('name')}
                onChange={handleNameChange}
                placeholder="Ex: Black Friday 2024"
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL) *</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/r/</span>
                <Input
                  id="slug"
                  {...register('slug')}
                  placeholder="black-friday-2024"
                  disabled={!!campaign}
                />
              </div>
              {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo_url">URL do Logo (opcional)</Label>
              <Input
                id="logo_url"
                {...register('logo_url')}
                placeholder="https://..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Personalização */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Personalização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                {...register('title')}
                placeholder="Fale com nosso time!"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtítulo (opcional)</Label>
              <Input
                id="subtitle"
                {...register('subtitle')}
                placeholder="Estamos aqui para ajudar"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="button_text">Texto do Botão</Label>
              <Input
                id="button_text"
                {...register('button_text')}
                placeholder="Falar com Vendedor"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="button_color">Cor do Botão</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="button_color"
                    {...register('button_color')}
                    className="h-10 w-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={buttonColor}
                    onChange={(e) => setValue('button_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="background_color">Cor de Fundo</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="background_color"
                    {...register('background_color')}
                    className="h-10 w-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={backgroundColor}
                    onChange={(e) => setValue('background_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mensagem de boas-vindas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mensagem de Boas-Vindas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="welcome_message">Mensagem pré-preenchida no WhatsApp</Label>
            <Textarea
              id="welcome_message"
              {...register('welcome_message')}
              placeholder="Olá! Vi seu anúncio e gostaria de mais informações."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Canais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Canais de WhatsApp *</CardTitle>
          <p className="text-sm text-muted-foreground">
            Selecione os canais que receberão os leads
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {connectedChannels.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhum canal de WhatsApp conectado. Configure um canal primeiro.
            </p>
          ) : (
            <div className="space-y-3">
              {connectedChannels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedChannels.includes(channel.id)}
                    onCheckedChange={() => toggleChannel(channel.id)}
                  />
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => toggleChannel(channel.id)}
                  >
                    <p className="font-medium">{channel.name}</p>
                    <p className="text-sm text-muted-foreground">{channel.phone}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {selectedChannels.length === 0 && (
            <p className="text-sm text-destructive mt-2">Selecione pelo menos um canal</p>
          )}
        </CardContent>
      </Card>

      {/* Configuração de Distribuição - só aparece quando há canais selecionados */}
      {selectedChannels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Configuração de Distribuição
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Como os leads serão distribuídos entre os canais
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={distributionMode}
              onValueChange={(value) => setDistributionMode(value as 'equal' | 'percentage')}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3 p-3 rounded-lg border">
                <RadioGroupItem value="equal" id="equal" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="equal" className="font-medium cursor-pointer">
                    Distribuição Igual (Round-Robin)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Cada canal recebe leads igualmente, alternando entre eles
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 rounded-lg border">
                <RadioGroupItem value="percentage" id="percentage" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="percentage" className="font-medium cursor-pointer">
                    Distribuição por Porcentagem
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Defina a porcentagem de leads para cada canal
                  </p>
                </div>
              </div>
            </RadioGroup>

            {/* Configuração de porcentagem por canal */}
            {distributionMode === 'percentage' && selectedChannels.length > 0 && (
              <div className="mt-4 p-4 bg-muted/30 rounded-lg space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Porcentagem por Canal
                  </Label>
                  <span className={`text-sm font-medium ${totalPercentage === 100 ? 'text-green-600' : 'text-destructive'}`}>
                    Total: {totalPercentage}%
                  </span>
                </div>
                
                {selectedChannels.map((channelId) => {
                  const channel = channels.find(c => c.id === channelId);
                  if (!channel) return null;
                  
                  return (
                    <div key={channelId} className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{channel.name}</p>
                        <p className="text-xs text-muted-foreground">{channel.phone}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={channelPercentages[channelId] || 0}
                          onChange={(e) => handlePercentageChange(channelId, e.target.value)}
                          className="w-20 text-center"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                  );
                })}
                
                {totalPercentage !== 100 && (
                  <p className="text-sm text-destructive">
                    O total das porcentagens deve ser exatamente 100%
                  </p>
                )}
              </div>
            )}

            {/* Preview do link de redirecionamento */}
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-1">Link de redirecionamento:</p>
              <code className="text-xs text-muted-foreground">
                https://wa.me/{'{{número_selecionado}}'}
              </code>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ações */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading || selectedChannels.length === 0 || !isPercentageValid}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {campaign ? 'Salvar Alterações' : 'Criar Campanha'}
        </Button>
      </div>
    </form>
  );
}
