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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Loader2, Palette, Users, Percent, Eye, Building2, Tag } from 'lucide-react';
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
  logo_url: z.string().optional(),
  logo_size: z.number().min(40).max(200).optional(),
  thank_you_message: z.string().optional(),
  department_id: z.string().optional(),
  tag_id: z.string().optional(),
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
  
  // Buscar canais de WhatsApp
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

  // Buscar departamentos
  const { data: departments = [] } = useQuery({
    queryKey: ['departments', profile?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('tenant_id', profile?.tenant_id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.tenant_id,
  });

  // Buscar tags
  const [tags, setTags] = useState<Array<{ id: string; name: string; color: string | null }>>([]);
  useEffect(() => {
    const fetchTags = async () => {
      if (!profile?.tenant_id) return;
      const { data } = await supabase
        .from('tags')
        .select('id, name, color')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .order('name') as { data: Array<{ id: string; name: string; color: string | null }> | null };
      if (data) setTags(data);
    };
    fetchTags();
  }, [profile?.tenant_id]);
  
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [distributionMode, setDistributionMode] = useState<'equal' | 'percentage'>('equal');
  const [channelPercentages, setChannelPercentages] = useState<Record<string, number>>({});
  const [logoSize, setLogoSize] = useState(64);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: campaign?.name || '',
      slug: campaign?.slug || '',
      title: campaign?.title || 'Fale com nosso time!',
      subtitle: campaign?.subtitle || '',
      button_text: campaign?.button_text || 'Enviar',
      button_color: campaign?.button_color || '#8B5CF6',
      background_color: campaign?.background_color || '#FFFFFF',
      logo_url: campaign?.logo_url || '',
      logo_size: (campaign as any)?.logo_size || 64,
      thank_you_message: (campaign as any)?.thank_you_message || 'Obrigado! Entraremos em contato em breve.',
      department_id: (campaign as any)?.department_id || '',
      tag_id: (campaign as any)?.tag_id || '',
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
    
    // Carregar tamanho da logo
    if ((campaign as any)?.logo_size) {
      setLogoSize((campaign as any).logo_size);
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
      logo_size: logoSize,
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

            {/* Slider de tamanho da logo */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Tamanho do Logo</Label>
                <span className="text-sm text-muted-foreground">{logoSize}px</span>
              </div>
              <Slider
                value={[logoSize]}
                onValueChange={(value) => setLogoSize(value[0])}
                min={40}
                max={200}
                step={4}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Ajuste a altura do logo entre 40px e 200px
              </p>
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
                placeholder="Enviar"
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

      {/* Mensagem de Obrigado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mensagem de Obrigado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="thank_you_message">Mensagem exibida após o lead se cadastrar</Label>
            <Textarea
              id="thank_you_message"
              {...register('thank_you_message')}
              placeholder="Obrigado! Entraremos em contato em breve."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Destino do Lead */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Destino do Lead
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Defina para qual departamento e com qual tag o lead será cadastrado
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select
                value={watch('department_id') || ''}
                onValueChange={(value) => setValue('department_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O lead será atribuído a este departamento
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                TAG (opcional)
              </Label>
              <Select
                value={watch('tag_id') || ''}
                onValueChange={(value) => setValue('tag_id', value === 'none' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma tag</SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center gap-2">
                        <span 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: tag.color || '#888' }}
                        />
                        {tag.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tag aplicada automaticamente ao lead
              </p>
            </div>
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
          </CardContent>
        </Card>
      )}

      {/* Preview da Landing Page */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview da Landing Page
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className="rounded-xl overflow-hidden border shadow-sm mx-auto max-w-sm"
            style={{ backgroundColor: watch('background_color') || '#FFFFFF' }}
          >
            <div className="p-6">
              <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
                {/* Logo com tamanho dinâmico */}
                {watch('logo_url') ? (
                  <div className="flex justify-center">
                    <img 
                      src={watch('logo_url')} 
                      alt="Logo" 
                      style={{ height: `${logoSize}px` }}
                      className="object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <div 
                      className="rounded-full bg-gray-100 flex items-center justify-center"
                      style={{ height: `${logoSize}px`, width: `${logoSize}px` }}
                    >
                      <span className="font-bold text-gray-400" style={{ fontSize: `${logoSize / 3}px` }}>S</span>
                    </div>
                  </div>
                )}

                {/* Título e Subtítulo */}
                <div className="text-center space-y-1">
                  <h1 className="text-lg font-bold text-gray-900">
                    {watch('title') || 'Fale com nosso time!'}
                  </h1>
                  {watch('subtitle') && (
                    <p className="text-sm text-gray-600">{watch('subtitle')}</p>
                  )}
                </div>

                {/* Simulação do input */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50">
                    <span className="text-sm text-gray-500">🇧🇷 +55</span>
                    <span className="text-sm text-gray-400">(00) 00000-0000</span>
                  </div>
                  
                  <button
                    type="button"
                    className="w-full py-3 px-4 rounded-lg text-white font-medium text-sm transition-colors"
                    style={{ backgroundColor: watch('button_color') || '#8B5CF6' }}
                  >
                    {watch('button_text') || 'Enviar'}
                  </button>
                </div>
              </div>

              {/* Preview da tela de obrigado */}
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="text-center space-y-2">
                  <div className="text-3xl">✅</div>
                  <p className="text-sm font-medium text-green-800">Após enviar:</p>
                  <p className="text-xs text-green-700">
                    {watch('thank_you_message') || 'Obrigado! Entraremos em contato em breve.'}
                  </p>
                </div>
              </div>

              <p className="text-center text-xs text-gray-400 mt-3">
                Seus dados estão seguros conosco
              </p>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground text-center mt-4">
            Este é um preview aproximado de como a landing page aparecerá para os visitantes
          </p>
        </CardContent>
      </Card>

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
