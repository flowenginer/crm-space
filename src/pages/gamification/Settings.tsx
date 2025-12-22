import { useState } from "react";
import { Settings as SettingsIcon, Trophy, Sliders, Target, Palette, Users, Save, Database, ShoppingCart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useGamificationSettings } from "@/hooks/useGamificationSettings";
import { useCompanySettings, useUpdateCompanySettings } from "@/hooks/useCompanySettings";
import { useERPEnabled } from "@/hooks/useERPEnabled";
import { toast } from "sonner";

export default function GamificationSettings() {
  const { settings, updateSetting, isLoading } = useGamificationSettings();
  const { data: companySettings } = useCompanySettings();
  const updateCompanySettings = useUpdateCompanySettings();
  const erpEnabled = useERPEnabled();
  const [activeTab, setActiveTab] = useState('source');
  const [gamificationSource, setGamificationSource] = useState<'crm' | 'erp'>(
    (companySettings?.gamification_source as 'crm' | 'erp') || 'crm'
  );

  const handleSave = async () => {
    try {
      await updateCompanySettings.mutateAsync({ gamification_source: gamificationSource });
      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar configurações");
    }
  };

  return (
    <div className="min-h-screen bg-racing-bg">
      <div className="bg-gradient-to-r from-racing-primary/20 to-racing-accent/10 border-b border-racing-border">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-racing-accent" />
            <div>
              <h1 className="text-2xl font-bold text-white">Configurações da Gamificação</h1>
              <p className="text-muted-foreground">
                Configure pontuação, rankings, conquistas e visual do sistema
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-racing-card border border-racing-border grid grid-cols-6 w-full mb-6">
            <TabsTrigger value="source" className="data-[state=active]:bg-racing-primary data-[state=active]:text-white">
              <Database className="w-4 h-4 mr-2" />
              Fonte
            </TabsTrigger>
            <TabsTrigger value="points" className="data-[state=active]:bg-racing-primary data-[state=active]:text-white">
              <Sliders className="w-4 h-4 mr-2" />
              Pontuação
            </TabsTrigger>
            <TabsTrigger value="rankings" className="data-[state=active]:bg-racing-primary data-[state=active]:text-white">
              <Trophy className="w-4 h-4 mr-2" />
              Rankings
            </TabsTrigger>
            <TabsTrigger value="goals" className="data-[state=active]:bg-racing-primary data-[state=active]:text-white">
              <Target className="w-4 h-4 mr-2" />
              Metas
            </TabsTrigger>
            <TabsTrigger value="visual" className="data-[state=active]:bg-racing-primary data-[state=active]:text-white">
              <Palette className="w-4 h-4 mr-2" />
              Visual
            </TabsTrigger>
            <TabsTrigger value="participants" className="data-[state=active]:bg-racing-primary data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-2" />
              Participantes
            </TabsTrigger>
          </TabsList>

          {/* Aba Fonte de Dados */}
          <TabsContent value="source">
            <Card className="bg-racing-card border-racing-border">
              <CardHeader>
                <CardTitle className="text-white">Fonte de Faturamento</CardTitle>
                <CardDescription>
                  Defina de onde os dados de vendas serão extraídos para o ranking
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <RadioGroup 
                  value={gamificationSource} 
                  onValueChange={(value) => setGamificationSource(value as 'crm' | 'erp')}
                  className="space-y-4"
                >
                  <div className={`flex items-start space-x-4 p-4 rounded-lg border ${gamificationSource === 'crm' ? 'border-racing-accent bg-racing-accent/10' : 'border-racing-border bg-racing-bg'}`}>
                    <RadioGroupItem value="crm" id="crm" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="crm" className="text-white font-semibold cursor-pointer flex items-center gap-2">
                        <Database className="w-5 h-5 text-blue-400" />
                        CRM (Contatos)
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        O faturamento é calculado pelo <strong>valor negociado</strong> dos contatos que atingiram os <strong>status de conversão</strong> definidos em Configurações &gt; Métricas.
                      </p>
                      <div className="mt-2 text-xs text-muted-foreground">
                        ✓ Status considerados: Pedido Fechado, Em Andamento, Cobrança, Aguardando Envio, Enviado, Entregue
                      </div>
                    </div>
                  </div>

                  <div className={`flex items-start space-x-4 p-4 rounded-lg border ${gamificationSource === 'erp' ? 'border-racing-accent bg-racing-accent/10' : 'border-racing-border bg-racing-bg'} ${!erpEnabled ? 'opacity-50' : ''}`}>
                    <RadioGroupItem value="erp" id="erp" className="mt-1" disabled={!erpEnabled} />
                    <div className="flex-1">
                      <Label htmlFor="erp" className={`text-white font-semibold cursor-pointer flex items-center gap-2 ${!erpEnabled ? 'cursor-not-allowed' : ''}`}>
                        <ShoppingCart className="w-5 h-5 text-green-400" />
                        ERP (Pedidos)
                        {!erpEnabled && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">Módulo desativado</span>}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        O faturamento é calculado pelo <strong>valor total dos pedidos</strong> criados no módulo ERP. Orçamentos não são contabilizados.
                      </p>
                      <div className="mt-2 text-xs text-muted-foreground">
                        ✓ Apenas pedidos de venda são considerados (não orçamentos)
                      </div>
                    </div>
                  </div>
                </RadioGroup>

                <div className="bg-racing-bg p-4 rounded-lg border border-racing-border">
                  <h4 className="font-semibold text-white mb-2">⚡ Atualização em Tempo Real</h4>
                  <p className="text-sm text-muted-foreground">
                    O ranking é atualizado automaticamente sempre que houver mudanças nos dados. 
                    Não é necessário recarregar a página.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Pontuação */}
          <TabsContent value="points">
            <Card className="bg-racing-card border-racing-border">
              <CardHeader>
                <CardTitle className="text-white">Configuração de Pontos</CardTitle>
                <CardDescription>
                  Defina quantos pontos cada ação vale no sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Vendas */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-white border-b border-racing-border pb-2">💰 Vendas</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Pontos por R$10 vendidos</Label>
                        <Input type="number" defaultValue={1} className="w-24 bg-racing-bg" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Bônus venda rápida (24h)</Label>
                        <Input type="number" defaultValue={50} className="w-24 bg-racing-bg" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Bônus ticket alto (&gt;R$2000)</Label>
                        <Input type="number" defaultValue={100} className="w-24 bg-racing-bg" />
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-white border-b border-racing-border pb-2">📊 Mudança de Status</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Catálogo</Label>
                        <Input type="number" defaultValue={10} className="w-24 bg-racing-bg" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Orçamento</Label>
                        <Input type="number" defaultValue={20} className="w-24 bg-racing-bg" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Layout</Label>
                        <Input type="number" defaultValue={30} className="w-24 bg-racing-bg" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Aguardando Pagamento</Label>
                        <Input type="number" defaultValue={40} className="w-24 bg-racing-bg" />
                      </div>
                    </div>
                  </div>

                  {/* Atendimento */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-white border-b border-racing-border pb-2">💬 Atendimento</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Resposta em &lt;5 min</Label>
                        <Input type="number" defaultValue={15} className="w-24 bg-racing-bg" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Resposta em &lt;30 min</Label>
                        <Input type="number" defaultValue={10} className="w-24 bg-racing-bg" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Resposta em &lt;1h</Label>
                        <Input type="number" defaultValue={5} className="w-24 bg-racing-bg" />
                      </div>
                    </div>
                  </div>

                  {/* Streaks */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-white border-b border-racing-border pb-2">🔥 Streaks</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>3 dias vendendo</Label>
                        <Input type="number" defaultValue={50} className="w-24 bg-racing-bg" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>5 dias vendendo</Label>
                        <Input type="number" defaultValue={100} className="w-24 bg-racing-bg" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>7 dias vendendo</Label>
                        <Input type="number" defaultValue={200} className="w-24 bg-racing-bg" />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Rankings */}
          <TabsContent value="rankings">
            <Card className="bg-racing-card border-racing-border">
              <CardHeader>
                <CardTitle className="text-white">Rankings</CardTitle>
                <CardDescription>
                  Ative ou desative os rankings disponíveis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { id: 'general', name: 'Ranking Geral', desc: 'Soma total de pontos' },
                  { id: 'sales', name: 'Ranking de Vendas', desc: 'Ordenado por valor total vendido' },
                  { id: 'speed', name: 'Ranking de Velocidade', desc: 'Tempo médio de fechamento' },
                  { id: 'ticket', name: 'Ranking de Ticket Médio', desc: 'Valor médio por venda' },
                  { id: 'conversion', name: 'Ranking de Conversão', desc: 'Taxa de conversão de leads' },
                  { id: 'attendance', name: 'Ranking de Atendimentos', desc: 'Clientes únicos atendidos' },
                ].map((ranking) => (
                  <div key={ranking.id} className="flex items-center justify-between p-4 bg-racing-bg rounded-lg">
                    <div>
                      <div className="font-medium text-white">{ranking.name}</div>
                      <div className="text-sm text-muted-foreground">{ranking.desc}</div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Metas */}
          <TabsContent value="goals">
            <Card className="bg-racing-card border-racing-border">
              <CardHeader>
                <CardTitle className="text-white">Metas do Time</CardTitle>
                <CardDescription>
                  Defina metas gerais e individuais
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-racing-bg rounded-lg">
                    <div>
                      <Label className="text-white">Meta mensal do time (R$)</Label>
                      <p className="text-sm text-muted-foreground">Valor total de vendas esperado</p>
                    </div>
                    <Input type="number" defaultValue={50000} className="w-32 bg-racing-card" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-racing-bg rounded-lg">
                    <div>
                      <Label className="text-white">Meta individual padrão (R$)</Label>
                      <p className="text-sm text-muted-foreground">Meta padrão por vendedor</p>
                    </div>
                    <Input type="number" defaultValue={10000} className="w-32 bg-racing-card" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Visual */}
          <TabsContent value="visual">
            <Card className="bg-racing-card border-racing-border">
              <CardHeader>
                <CardTitle className="text-white">Configurações Visuais</CardTitle>
                <CardDescription>
                  Personalize a aparência e sons do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-white border-b border-racing-border pb-2">🔊 Sons</h3>
                    {[
                      { id: 'overtake', name: 'Som de Ultrapassagem' },
                      { id: 'pole', name: 'Som de Pole Position' },
                      { id: 'badge', name: 'Som de Conquista' },
                      { id: 'sale', name: 'Som de Venda' },
                    ].map((sound) => (
                      <div key={sound.id} className="flex items-center justify-between">
                        <Label>{sound.name}</Label>
                        <Switch defaultChecked />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-white border-b border-racing-border pb-2">✨ Animações</h3>
                    {[
                      { id: 'confetti', name: 'Confetti ao assumir 1º' },
                      { id: 'pulse', name: 'Pulse no líder' },
                      { id: 'overtake_anim', name: 'Animação de ultrapassagem' },
                    ].map((anim) => (
                      <div key={anim.id} className="flex items-center justify-between">
                        <Label>{anim.name}</Label>
                        <Switch defaultChecked />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-white border-b border-racing-border pb-2">🏁 Temporada</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label>Nome da Temporada</Label>
                      <Input defaultValue="Temporada Dezembro 2024" className="mt-1 bg-racing-bg" />
                    </div>
                    <div className="flex-1">
                      <Label>Multiplicador de Pontos</Label>
                      <Input type="number" step="0.1" defaultValue={1} className="mt-1 bg-racing-bg" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Participantes */}
          <TabsContent value="participants">
            <Card className="bg-racing-card border-racing-border">
              <CardHeader>
                <CardTitle className="text-white">Participantes</CardTitle>
                <CardDescription>
                  Gerencie os vendedores que participam do ranking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  Os participantes são automaticamente adicionados com base nos usuários ativos do sistema.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Botão Salvar */}
        <div className="flex justify-end mt-6">
          <Button onClick={handleSave} className="bg-racing-primary hover:bg-racing-primary/90">
            <Save className="w-4 h-4 mr-2" />
            Salvar Configurações
          </Button>
        </div>
      </div>
    </div>
  );
}
