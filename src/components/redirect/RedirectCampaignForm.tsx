import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Palette, Eye, Building2, Tag, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
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
  background_image_url: z.string().optional(),
  background_image_opacity: z.number().min(0.1).max(1).optional(),
  background_image_position: z.string().optional(),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

interface RedirectCampaignFormProps {
  campaign?: RedirectCampaign | null;
  onSubmit: (data: CampaignFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function RedirectCampaignForm({ campaign, onSubmit, onCancel, isLoading }: RedirectCampaignFormProps) {
  const { profile } = useAuth();

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
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, color')
        .eq('tenant_id', profile.tenant_id)
        .order('name');
      if (!error && data) {
        setTags(data);
      }
    };
    fetchTags();
  }, [profile?.tenant_id]);

  const [logoSize, setLogoSize] = useState(64);
  
  // Create tag dialog state
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#8B5CF6');
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  const [backgroundImageOpacity, setBackgroundImageOpacity] = useState((campaign as any)?.background_image_opacity || 0.3);

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
      background_image_url: (campaign as any)?.background_image_url || '',
      background_image_opacity: (campaign as any)?.background_image_opacity || 0.3,
      background_image_position: (campaign as any)?.background_image_position || 'cover',
    },
  });

  useEffect(() => {
    // Carregar tamanho da logo
    if ((campaign as any)?.logo_size) {
      setLogoSize((campaign as any).logo_size);
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

  const handleFormSubmit = (data: CampaignFormData) => {
    onSubmit({ 
      ...data,
      logo_size: logoSize,
      background_image_opacity: backgroundImageOpacity,
    });
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !profile?.tenant_id) return;
    
    setIsCreatingTag(true);
    try {
      const { data, error } = await supabase
        .from('tags')
        .insert({
          tenant_id: profile.tenant_id,
          name: newTagName.trim(),
          color: newTagColor,
          created_by: profile.id,
        })
        .select('id, name, color')
        .single();
      
      if (error) throw error;
      
      if (data) {
        setTags(prev => [...prev, data]);
        setValue('tag_id', data.id);
        setShowCreateTag(false);
        setNewTagName('');
        setNewTagColor('#8B5CF6');
        toast.success('Tag criada com sucesso!');
      }
    } catch (error) {
      console.error('Error creating tag:', error);
      toast.error('Erro ao criar tag');
    } finally {
      setIsCreatingTag(false);
    }
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

            {/* Imagem de Fundo */}
            <div className="space-y-4 pt-4 border-t">
              <Label className="text-base font-medium">Imagem de Fundo (Marca d'Água)</Label>
              
              <div className="space-y-2">
                <Label htmlFor="background_image_url">URL da Imagem</Label>
                <Input
                  id="background_image_url"
                  {...register('background_image_url')}
                  placeholder="https://exemplo.com/imagem.png"
                />
                <p className="text-xs text-muted-foreground">
                  A imagem aparecerá como marca d'água atrás do conteúdo
                </p>
              </div>

              {watch('background_image_url') && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Opacidade</Label>
                      <span className="text-sm text-muted-foreground">{Math.round(backgroundImageOpacity * 100)}%</span>
                    </div>
                    <Slider
                      value={[backgroundImageOpacity * 100]}
                      onValueChange={(value) => setBackgroundImageOpacity(value[0] / 100)}
                      min={10}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Posição da Imagem</Label>
                    <Select
                      value={watch('background_image_position') || 'cover'}
                      onValueChange={(value) => setValue('background_image_position', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cover">Cobrir toda tela</SelectItem>
                        <SelectItem value="contain">Manter proporção</SelectItem>
                        <SelectItem value="center">Centralizar</SelectItem>
                        <SelectItem value="repeat">Repetir padrão</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
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
              <div className="flex gap-2">
                <Select
                  value={watch('tag_id') || ''}
                  onValueChange={(value) => setValue('tag_id', value === 'none' ? '' : value)}
                >
                  <SelectTrigger className="flex-1">
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
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowCreateTag(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Tag aplicada automaticamente ao lead
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
            className="rounded-xl overflow-hidden border shadow-sm mx-auto max-w-sm relative"
            style={{ backgroundColor: watch('background_color') || '#FFFFFF' }}
          >
            {/* Imagem de fundo como marca d'água no preview */}
            {watch('background_image_url') && (
              <div 
                className="absolute inset-0 z-0"
                style={{
                  backgroundImage: `url(${watch('background_image_url')})`,
                  backgroundSize: watch('background_image_position') === 'repeat' ? 'auto' : 
                                  watch('background_image_position') === 'contain' ? 'contain' : 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: watch('background_image_position') === 'repeat' ? 'repeat' : 'no-repeat',
                  opacity: backgroundImageOpacity,
                }}
              />
            )}
            <div className="p-6 relative z-10">
              <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
                {/* Logo com tamanho dinâmico */}
                {watch('logo_url') ? (
                  <div 
                    className="flex justify-center items-center w-full"
                    style={{ height: `${logoSize}px` }}
                  >
                    <img 
                      src={watch('logo_url')} 
                      alt="Logo" 
                      style={{ 
                        height: '100%', 
                        width: 'auto',
                        maxWidth: '100%',
                        display: 'block'
                      }}
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
          disabled={isLoading}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {campaign ? 'Salvar Alterações' : 'Criar Campanha'}
        </Button>
      </div>

      {/* Dialog para criar nova tag */}
      <Dialog open={showCreateTag} onOpenChange={setShowCreateTag}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Nova Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tag_name">Nome da Tag</Label>
              <Input
                id="tag_name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Ex: Lead Quente"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag_color">Cor</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="tag_color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="h-10 w-10 rounded border cursor-pointer"
                />
                <Input
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTag(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTag} disabled={!newTagName.trim() || isCreatingTag}>
              {isCreatingTag && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
