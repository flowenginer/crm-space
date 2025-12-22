import { useState, useRef } from 'react';
import { Building2, Upload, Users, Contact, Calendar, CheckCircle, AlertTriangle, Crown, Sparkles, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentTenant, useUpdateTenant } from '@/hooks/useTenant';
import { useTenantStats } from '@/hooks/useTenantStats';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function TenantSettings() {
  const { data: tenant, isLoading: tenantLoading } = useCurrentTenant();
  const { data: stats, isLoading: statsLoading } = useTenantStats();
  const updateTenant = useUpdateTenant();
  
  const [name, setName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Inicializar nome quando tenant carregar
  useState(() => {
    if (tenant?.name && !name) {
      setName(tenant.name);
    }
  });

  const handleSaveName = async () => {
    if (!tenant?.id || !name.trim()) return;
    
    await updateTenant.mutateAsync({
      id: tenant.id,
      name: name.trim(),
    });
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !tenant?.id) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem');
      return;
    }

    // Validar tamanho (máx 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB');
      return;
    }

    setIsUploading(true);
    
    try {
      // Nome do arquivo: tenant_id/logo.extensão
      const fileExt = file.name.split('.').pop();
      const fileName = `${tenant.id}/logo.${fileExt}`;

      // Upload para o Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('tenant-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('tenant-logos')
        .getPublicUrl(fileName);

      // Atualizar tenant com nova URL da logo
      await updateTenant.mutateAsync({
        id: tenant.id,
        logo_url: urlData.publicUrl,
      });

      toast.success('Logo atualizada com sucesso!');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Erro ao fazer upload da logo');
    } finally {
      setIsUploading(false);
    }
  };

  const getPlanBadge = (planType: string) => {
    switch (planType) {
      case 'enterprise':
        return (
          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
            <Crown className="w-3 h-3 mr-1" />
            Enterprise
          </Badge>
        );
      case 'pro':
        return (
          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
            <Sparkles className="w-3 h-3 mr-1" />
            Pro
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            Free
          </Badge>
        );
    }
  };

  const getUsagePercentage = (current: number, max: number) => {
    if (max === 0) return 0;
    return Math.min((current / max) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 100) return 'text-destructive';
    if (percentage >= 80) return 'text-amber-500';
    return 'text-green-500';
  };

  if (tenantLoading) {
    return (
      <div className="container max-w-4xl py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="container max-w-4xl py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma empresa configurada</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const usersPercentage = getUsagePercentage(stats?.usersCount || 0, tenant.max_users || 5);
  const contactsPercentage = getUsagePercentage(stats?.contactsCount || 0, tenant.max_contacts || 1000);

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-primary/10">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Configurações da Empresa</h1>
          <p className="text-muted-foreground">Gerencie as informações e limites do seu tenant</p>
        </div>
      </div>

      {/* Informações Básicas */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
          <CardDescription>Dados principais da sua empresa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Logo */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden bg-muted/50">
                {tenant.logo_url ? (
                  <img 
                    src={tenant.logo_url} 
                    alt="Logo da empresa" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building2 className="w-10 h-10 text-muted-foreground" />
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                {tenant.logo_url ? 'Alterar' : 'Upload'}
              </Button>
            </div>

            {/* Campos */}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Empresa</Label>
                <div className="flex gap-2">
                  <Input
                    id="name"
                    value={name || tenant.name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome da empresa"
                  />
                  <Button 
                    onClick={handleSaveName}
                    disabled={updateTenant.isPending || name === tenant.name}
                  >
                    {updateTenant.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Salvar'
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Slug (URL única)</Label>
                <Input
                  value={tenant.slug}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  O slug não pode ser alterado após a criação
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plano e Limites */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Plano e Limites</CardTitle>
              <CardDescription>Uso atual dos recursos do seu plano</CardDescription>
            </div>
            {getPlanBadge(tenant.plan_type || 'free')}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Usuários */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Usuários</span>
              </div>
              <span className={`text-sm font-medium ${getUsageColor(usersPercentage)}`}>
                {statsLoading ? (
                  <Skeleton className="h-4 w-16 inline-block" />
                ) : (
                  `${stats?.usersCount || 0} / ${tenant.max_users || 5}`
                )}
                {usersPercentage >= 100 && (
                  <AlertTriangle className="w-4 h-4 inline ml-1" />
                )}
              </span>
            </div>
            <Progress value={usersPercentage} className="h-2" />
          </div>

          {/* Contatos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Contact className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Contatos</span>
              </div>
              <span className={`text-sm font-medium ${getUsageColor(contactsPercentage)}`}>
                {statsLoading ? (
                  <Skeleton className="h-4 w-20 inline-block" />
                ) : (
                  `${(stats?.contactsCount || 0).toLocaleString('pt-BR')} / ${(tenant.max_contacts || 1000).toLocaleString('pt-BR')}`
                )}
                {contactsPercentage >= 100 && (
                  <AlertTriangle className="w-4 h-4 inline ml-1" />
                )}
              </span>
            </div>
            <Progress value={contactsPercentage} className="h-2" />
          </div>

          {(usersPercentage >= 80 || contactsPercentage >= 80) && (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                {usersPercentage >= 100 || contactsPercentage >= 100 
                  ? 'Você atingiu o limite do seu plano. Considere fazer upgrade.'
                  : 'Você está próximo do limite do seu plano.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações do Tenant */}
      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
          <CardDescription>Detalhes do seu tenant</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Calendar className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Criado em</p>
                <p className="font-medium">
                  {tenant.created_at 
                    ? format(new Date(tenant.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : '-'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-medium flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${tenant.is_active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  {tenant.is_active ? 'Ativo' : 'Inativo'}
                </p>
              </div>
            </div>

            {tenant.trial_ends_at && (
              <div className="flex items-center gap-3 sm:col-span-2">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Período de Trial</p>
                  <p className="font-medium text-amber-600 dark:text-amber-400">
                    Expira em {format(new Date(tenant.trial_ends_at), "dd/MM/yyyy")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
