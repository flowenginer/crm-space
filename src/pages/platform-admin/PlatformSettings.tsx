import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Settings, Shield, Bell, Database, Globe, Lock } from 'lucide-react';

export default function PlatformSettings() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-slate-500/10">
          <Settings className="h-6 w-6 text-slate-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Configurações da Plataforma</h1>
          <p className="text-muted-foreground">
            Configurações globais que afetam todos os tenants
          </p>
        </div>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Configurações Gerais
          </CardTitle>
          <CardDescription>
            Configurações básicas da plataforma
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="platform-name">Nome da Plataforma</Label>
              <Input
                id="platform-name"
                defaultValue="Space Sports CRM"
                placeholder="Nome da plataforma"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-email">E-mail de Suporte</Label>
              <Input
                id="support-email"
                type="email"
                defaultValue="suporte@spacesports.com"
                placeholder="suporte@exemplo.com"
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Modo de Manutenção</Label>
              <p className="text-sm text-muted-foreground">
                Quando ativo, apenas Super Admins podem acessar
              </p>
            </div>
            <Switch />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Permitir Novos Registros</Label>
              <p className="text-sm text-muted-foreground">
                Permite a criação de novos tenants via onboarding
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Segurança
          </CardTitle>
          <CardDescription>
            Configurações de segurança da plataforma
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Autenticação de Dois Fatores Obrigatória</Label>
              <p className="text-sm text-muted-foreground">
                Exigir 2FA para todos os Super Admins
              </p>
            </div>
            <Switch />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Logs de Auditoria Detalhados</Label>
              <p className="text-sm text-muted-foreground">
                Registrar todas as ações com detalhes completos
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="session-timeout">Tempo de Sessão (minutos)</Label>
            <Input
              id="session-timeout"
              type="number"
              defaultValue="60"
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Tempo de inatividade antes de deslogar automaticamente
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações
          </CardTitle>
          <CardDescription>
            Configurações de alertas e notificações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Alertas de Novos Tenants</Label>
              <p className="text-sm text-muted-foreground">
                Notificar Super Admins quando um novo tenant for criado
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Alertas de Limites</Label>
              <p className="text-sm text-muted-foreground">
                Notificar quando tenants atingirem 80% dos limites
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Relatório Diário</Label>
              <p className="text-sm text-muted-foreground">
                Enviar resumo diário de métricas da plataforma
              </p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      {/* Default Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Limites Padrão
          </CardTitle>
          <CardDescription>
            Limites aplicados a novos tenants por plano
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Free Plan */}
            <div className="p-4 rounded-lg border bg-muted/30">
              <h4 className="font-medium mb-4">Plano Free</h4>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Máx. Usuários</Label>
                  <Input type="number" defaultValue="3" className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Máx. Contatos</Label>
                  <Input type="number" defaultValue="500" className="h-8" />
                </div>
              </div>
            </div>

            {/* Pro Plan */}
            <div className="p-4 rounded-lg border bg-primary/5">
              <h4 className="font-medium mb-4">Plano Pro</h4>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Máx. Usuários</Label>
                  <Input type="number" defaultValue="10" className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Máx. Contatos</Label>
                  <Input type="number" defaultValue="5000" className="h-8" />
                </div>
              </div>
            </div>

            {/* Enterprise Plan */}
            <div className="p-4 rounded-lg border bg-amber-500/5">
              <h4 className="font-medium mb-4">Plano Enterprise</h4>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Máx. Usuários</Label>
                  <Input type="number" defaultValue="999" className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Máx. Contatos</Label>
                  <Input type="number" defaultValue="999999" className="h-8" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button className="gap-2">
          <Lock className="h-4 w-4" />
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
