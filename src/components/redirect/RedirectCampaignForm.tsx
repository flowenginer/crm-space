import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Palette } from 'lucide-react';
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

interface RedirectCampaignFormProps {
  campaign?: RedirectCampaign | null;
  onSubmit: (data: CampaignFormData & { channel_ids: string[] }) => void;
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
        .select('id, name, is_active')
        .eq('tenant_id', profile?.tenant_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.tenant_id,
  });
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

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
    }
  }, [campaign]);

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
    setSelectedChannels(prev => 
      prev.includes(channelId) 
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    );
  };

  const handleFormSubmit = (data: CampaignFormData) => {
    onSubmit({ ...data, channel_ids: selectedChannels });
  };

  const buttonColor = watch('button_color');
  const backgroundColor = watch('background_color');

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
            Selecione os canais que receberão os leads (distribuição round-robin)
          </p>
        </CardHeader>
        <CardContent>
          {channels.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhum canal de WhatsApp conectado. Configure um canal primeiro.
            </p>
          ) : (
            <div className="space-y-3">
              {channels.filter(c => c.is_active).map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleChannel(channel.id)}
                >
                  <Checkbox
                    checked={selectedChannels.includes(channel.id)}
                    onCheckedChange={() => toggleChannel(channel.id)}
                  />
                  <div className="flex-1">
                    <p className="font-medium">{channel.name}</p>
                    <p className="text-sm text-muted-foreground">{channel.phone_number}</p>
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

      {/* Ações */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading || selectedChannels.length === 0}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {campaign ? 'Salvar Alterações' : 'Criar Campanha'}
        </Button>
      </div>
    </form>
  );
}
