import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  CheckCircle2, 
  Truck, 
  CreditCard, 
  Package, 
  Factory, 
  Clock,
  Play,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Copy,
  Info,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateMetaTemplate, type MetaTemplateComponent } from '@/hooks/useMetaTemplates';
import { toast } from 'sonner';

interface BlingTemplatesWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BlingTemplate {
  id: string;
  name: string;
  displayName: string;
  icon: React.ElementType;
  iconColor: string;
  description: string;
  variables: { num: number; name: string; example: string }[];
  bodyText: string;
  category: 'UTILITY';
  status: 'Pedido Enviado' | 'Cobrar Cliente' | 'Pedido Entregue' | 'Em Produção' | 'Pronto para Envio' | 'Em Andamento';
}

// Templates pré-configurados baseados no fluxo N8N
const BLING_TEMPLATES: BlingTemplate[] = [
  {
    id: 'pedido_enviado',
    name: 'pedido_enviado',
    displayName: 'Pedido Enviado',
    icon: Truck,
    iconColor: 'text-green-500',
    description: 'Notifica o cliente que o pedido foi enviado com código de rastreio',
    variables: [
      { num: 1, name: 'nome_cliente', example: 'João' },
      { num: 2, name: 'numero_pedido', example: '12345' },
      { num: 3, name: 'codigo_rastreio', example: 'BR123456789XX' },
    ],
    bodyText: `Olá, {{1}}
Seu pedido *{{2}}* foi enviado com sucesso! 🚚 📦

Esse é o seu código de rastreio: {{3}}
Para acompanhar: https://melhorrastreio.com.br/app/correios/{{3}}

Obs: Como a coleta dos produtos é feita pelos correios, pode levar até 24H para o código ser inserido no sistema.

Mais uma vez agradecemos por escolher a Space Sports.
Desejamos muito sucesso com o uso das camisas e nos colocamos a disposição para quaisquer dúvidas!

Nos vemos em breve para novos pedidos! 😉`,
    category: 'UTILITY',
    status: 'Pedido Enviado',
  },
  {
    id: 'cobrar_cliente',
    name: 'cobrar_cliente',
    displayName: 'Cobrar Cliente',
    icon: CreditCard,
    iconColor: 'text-yellow-500',
    description: 'Notifica o cliente que o pedido está pronto e aguarda pagamento',
    variables: [
      { num: 1, name: 'nome_cliente', example: 'João' },
      { num: 2, name: 'numero_pedido', example: '12345' },
    ],
    bodyText: `Olá, {{1}}
Seu pedido *#{{2}}* está pronto! 😃

O próximo passo agora é a conclusão do pagamento (caso haja pendências) para liberação do envio!

Podemos enviar a cotação de envio?`,
    category: 'UTILITY',
    status: 'Cobrar Cliente',
  },
  {
    id: 'pedido_entregue',
    name: 'pedido_entregue',
    displayName: 'Pedido Entregue',
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
    description: 'Notifica o cliente que o pedido foi entregue e pede avaliação',
    variables: [
      { num: 1, name: 'nome_cliente', example: 'João' },
      { num: 2, name: 'numero_pedido', example: '12345' },
    ],
    bodyText: `Olá, {{1}}
Seu pedido *#{{2}}* foi entregue com sucesso! 🚚 📦

Mais uma vez agradecemos por escolher a Space Sports.
Desejamos muito sucesso com o uso das camisas e nos colocamos a disposição para quaisquer dúvidas!

*A sua avaliação é muito importante para nós*. Deixe o seu Feedback no link a seguir: https://g.page/r/CQ37qTN0lGb9EBM/review

Nos vemos em breve para novos pedidos! 😉`,
    category: 'UTILITY',
    status: 'Pedido Entregue',
  },
  {
    id: 'producao_ecommerce',
    name: 'producao_ecommerce',
    displayName: 'Em Produção (E-commerce)',
    icon: Factory,
    iconColor: 'text-blue-500',
    description: 'Notifica o cliente que o pedido entrou em produção',
    variables: [
      { num: 1, name: 'nome_cliente', example: 'João' },
      { num: 2, name: 'numero_pedido', example: '12345' },
    ],
    bodyText: `Olá, {{1}}
Seu pedido *#{{2}}* acaba de ser enviado para produção! 😃

Em breve daremos mais informações.

Space Sports agradece pela preferência.`,
    category: 'UTILITY',
    status: 'Em Produção',
  },
  {
    id: 'pedido_pronto_envio',
    name: 'pedido_pronto_envio',
    displayName: 'Pronto para Envio',
    icon: Package,
    iconColor: 'text-purple-500',
    description: 'Notifica o cliente que o pedido está pronto para ser enviado',
    variables: [
      { num: 1, name: 'nome_cliente', example: 'João' },
      { num: 2, name: 'numero_pedido', example: '12345' },
    ],
    bodyText: `Olá, {{1}}

Seu pedido *#{{2}}* está pronto para ser enviado! 😃

Em breve lhe enviaremos o código de rastreio.

Space Sports agradece pela preferência.`,
    category: 'UTILITY',
    status: 'Pronto para Envio',
  },
  {
    id: 'em_andamento',
    name: 'em_andamento',
    displayName: 'Em Andamento',
    icon: Clock,
    iconColor: 'text-orange-500',
    description: 'Notifica o cliente que o pedido está em andamento',
    variables: [
      { num: 1, name: 'nome_cliente', example: 'João' },
      { num: 2, name: 'numero_pedido', example: '12345' },
    ],
    bodyText: `Olá, {{1}}

Seu pedido *#{{2}}* acaba de ser enviado para produção! 😃

Em breve daremos mais informações.

Space Sports agradece pela preferência.`,
    category: 'UTILITY',
    status: 'Em Andamento',
  },
];

export function BlingTemplatesWizard({ open, onOpenChange }: BlingTemplatesWizardProps) {
  const createTemplate = useCreateMetaTemplate();
  const [step, setStep] = useState<'select' | 'customize' | 'confirm'>('select');
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [customizations, setCustomizations] = useState<Record<string, { body: string; examples: string[] }>>({});
  const [creatingIndex, setCreatingIndex] = useState(-1);
  const [createdTemplates, setCreatedTemplates] = useState<Set<string>>(new Set());

  const handleTemplateToggle = (templateId: string) => {
    const newSelected = new Set(selectedTemplates);
    if (newSelected.has(templateId)) {
      newSelected.delete(templateId);
    } else {
      newSelected.add(templateId);
    }
    setSelectedTemplates(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedTemplates.size === BLING_TEMPLATES.length) {
      setSelectedTemplates(new Set());
    } else {
      setSelectedTemplates(new Set(BLING_TEMPLATES.map(t => t.id)));
    }
  };

  const handleNext = () => {
    if (step === 'select') {
      // Initialize customizations for selected templates
      const initial: Record<string, { body: string; examples: string[] }> = {};
      BLING_TEMPLATES.filter(t => selectedTemplates.has(t.id)).forEach(template => {
        initial[template.id] = {
          body: template.bodyText,
          examples: template.variables.map(v => v.example),
        };
      });
      setCustomizations(initial);
      setStep('customize');
    } else if (step === 'customize') {
      setStep('confirm');
    }
  };

  const handleBack = () => {
    if (step === 'customize') {
      setStep('select');
    } else if (step === 'confirm') {
      setStep('customize');
    }
  };

  const handleCreateTemplates = async () => {
    const templatesToCreate = BLING_TEMPLATES.filter(t => selectedTemplates.has(t.id) && !createdTemplates.has(t.id));
    
    for (let i = 0; i < templatesToCreate.length; i++) {
      const template = templatesToCreate[i];
      setCreatingIndex(i);
      
      try {
        const customization = customizations[template.id];
        const bodyText = customization?.body || template.bodyText;
        const examples = customization?.examples || template.variables.map(v => v.example);
        
        const components: MetaTemplateComponent[] = [
          {
            type: 'BODY',
            text: bodyText,
            example: {
              body_text: [examples],
            },
          },
        ];

        await createTemplate.mutateAsync({
          name: template.name,
          language: 'pt_BR',
          category: template.category,
          components,
        });

        setCreatedTemplates(prev => new Set([...prev, template.id]));
      } catch (error) {
        console.error(`Failed to create template ${template.name}:`, error);
        toast.error(`Erro ao criar template "${template.displayName}": ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        // Continue with next template
      }
    }

    setCreatingIndex(-1);
    
    if (createdTemplates.size + templatesToCreate.length === selectedTemplates.size) {
      toast.success('Todos os templates foram enviados para aprovação!');
    }
  };

  const handleCopyN8NPayload = (template: BlingTemplate) => {
    const customization = customizations[template.id];
    const payload = {
      channelId: "SEU_CHANNEL_ID_AQUI",
      phone: "{{ telefone_tratado }}",
      type: "template",
      template: {
        name: template.name,
        language: "pt_BR",
        components: [
          {
            type: "body",
            parameters: template.variables.map((v, i) => ({
              type: "text",
              text: `{{ ${v.name} }}`,
            })),
          },
        ],
      },
    };

    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast.success(`Payload do template "${template.displayName}" copiado!`);
  };

  const selectedCount = selectedTemplates.size;
  const createdCount = createdTemplates.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Assistente de Templates do Bling
          </DialogTitle>
          <DialogDescription>
            Configure os 6 templates de automação do Bling para a API Oficial do WhatsApp
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-4">
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
            step === 'select' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            <span className="w-6 h-6 rounded-full bg-background/20 flex items-center justify-center text-xs">1</span>
            Selecionar
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
            step === 'customize' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            <span className="w-6 h-6 rounded-full bg-background/20 flex items-center justify-center text-xs">2</span>
            Personalizar
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
            step === 'confirm' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            <span className="w-6 h-6 rounded-full bg-background/20 flex items-center justify-center text-xs">3</span>
            Criar
          </div>
        </div>

        <ScrollArea className="flex-1 pr-4">
          {/* Step 1: Select Templates */}
          {step === 'select' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Selecione os templates que deseja criar na API Oficial do WhatsApp
                </p>
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {selectedTemplates.size === BLING_TEMPLATES.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {BLING_TEMPLATES.map((template) => {
                  const Icon = template.icon;
                  const isSelected = selectedTemplates.has(template.id);
                  
                  return (
                    <Card 
                      key={template.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        isSelected && "ring-2 ring-primary bg-primary/5"
                      )}
                      onClick={() => handleTemplateToggle(template.id)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn("p-2 rounded-lg bg-muted", template.iconColor)}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{template.displayName}</CardTitle>
                              <Badge variant="outline" className="text-xs mt-1">
                                {template.status}
                              </Badge>
                            </div>
                          </div>
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                            isSelected 
                              ? "bg-primary border-primary" 
                              : "border-muted-foreground/30"
                          )}>
                            {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="text-xs">
                          {template.description}
                        </CardDescription>
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {template.variables.map((v) => (
                            <Badge key={v.num} variant="secondary" className="text-xs">
                              {`{{${v.num}}}`} {v.name}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Customize Templates */}
          {step === 'customize' && (
            <div className="space-y-6">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Personalize os textos</p>
                  <p>Você pode ajustar o texto de cada template. Use {`{{1}}`}, {`{{2}}`}, etc. para variáveis.</p>
                </div>
              </div>

              {BLING_TEMPLATES.filter(t => selectedTemplates.has(t.id)).map((template) => {
                const Icon = template.icon;
                const customization = customizations[template.id] || { body: template.bodyText, examples: [] };
                
                return (
                  <Card key={template.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("p-2 rounded-lg bg-muted", template.iconColor)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{template.displayName}</CardTitle>
                          <code className="text-xs text-muted-foreground">{template.name}</code>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Texto da Mensagem</Label>
                        <Textarea
                          value={customization.body}
                          onChange={(e) => setCustomizations(prev => ({
                            ...prev,
                            [template.id]: { ...customization, body: e.target.value },
                          }))}
                          rows={6}
                          className="font-mono text-sm"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label>Valores de Exemplo (obrigatório para aprovação)</Label>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {template.variables.map((v, i) => (
                            <div key={v.num} className="space-y-1">
                              <Label className="text-xs text-muted-foreground">
                                {`{{${v.num}}}`} - {v.name}
                              </Label>
                              <Input
                                value={customization.examples[i] || v.example}
                                onChange={(e) => {
                                  const newExamples = [...customization.examples];
                                  newExamples[i] = e.target.value;
                                  setCustomizations(prev => ({
                                    ...prev,
                                    [template.id]: { ...customization, examples: newExamples },
                                  }));
                                }}
                                placeholder={v.example}
                                className="text-sm"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Step 3: Confirm and Create */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <Info className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Próximos passos após criação</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Templates serão enviados para revisão da Meta (24-48h)</li>
                    <li>Após aprovação, atualize o fluxo N8N com os payloads abaixo</li>
                    <li>Cada nó HTTP Request deve usar o payload correspondente</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                {BLING_TEMPLATES.filter(t => selectedTemplates.has(t.id)).map((template, index) => {
                  const Icon = template.icon;
                  const isCreating = creatingIndex === index;
                  const isCreated = createdTemplates.has(template.id);
                  
                  return (
                    <Card key={template.id} className={cn(isCreated && "bg-green-500/5 border-green-500/30")}>
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2 rounded-lg",
                              isCreated ? "bg-green-500/20 text-green-500" : "bg-muted"
                            )}>
                              {isCreating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : isCreated ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <Icon className={cn("h-4 w-4", template.iconColor)} />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{template.displayName}</p>
                              <code className="text-xs text-muted-foreground">{template.name}</code>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isCreated && (
                              <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                                Enviado
                              </Badge>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyN8NPayload(template)}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copiar Payload N8N
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t mt-4">
          <div className="text-sm text-muted-foreground">
            {step === 'select' && `${selectedCount} de ${BLING_TEMPLATES.length} selecionados`}
            {step === 'customize' && `Personalizando ${selectedCount} templates`}
            {step === 'confirm' && `${createdCount} de ${selectedCount} criados`}
          </div>
          <div className="flex gap-2">
            {step !== 'select' && (
              <Button variant="outline" onClick={handleBack} disabled={creatingIndex >= 0}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            )}
            {step !== 'confirm' ? (
              <Button 
                onClick={handleNext} 
                disabled={selectedCount === 0}
              >
                Próximo
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleCreateTemplates}
                disabled={creatingIndex >= 0 || createdCount === selectedCount}
              >
                {creatingIndex >= 0 ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando... ({creatingIndex + 1}/{selectedCount - createdCount})
                  </>
                ) : createdCount === selectedCount ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Concluído
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Criar {selectedCount - createdCount} Templates
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
