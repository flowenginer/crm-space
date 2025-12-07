import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Copy, 
  Check,
  MessageSquare,
  Users,
  MessagesSquare,
  Briefcase,
  Radio,
  Lock,
  Code2,
  Webhook
} from "lucide-react";

const CodeBlock = ({ code, language = "json" }: { code: string; language?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-muted/50 border rounded-lg p-4 text-sm overflow-x-auto">
        <code className="text-foreground">{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
};

const EVENTS_DOCS = {
  messages: {
    icon: MessageSquare,
    title: "Mensagens",
    events: [
      {
        name: "message.received",
        description: "Disparado quando uma nova mensagem é recebida de um contato",
        payload: `{
  "event": "message.received",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "message": {
      "id": "uuid",
      "content": "Olá, preciso de ajuda",
      "message_type": "text",
      "media_url": null,
      "created_at": "2025-01-15T10:30:00Z"
    },
    "contact": {
      "id": "uuid",
      "full_name": "João Silva",
      "phone": "5511999999999",
      "email": "joao@email.com",
      "lead_status": "novo"
    },
    "conversation": {
      "id": "uuid",
      "status": "open",
      "assigned_to": null
    },
    "channel": {
      "id": "uuid",
      "name": "WhatsApp Principal"
    }
  }
}`
      },
      {
        name: "message.sent",
        description: "Disparado quando uma mensagem é enviada por um agente",
        payload: `{
  "event": "message.sent",
  "timestamp": "2025-01-15T10:31:00Z",
  "data": {
    "message": {
      "id": "uuid",
      "content": "Olá! Como posso ajudar?",
      "message_type": "text",
      "sender_id": "agent-uuid"
    },
    "contact": { ... },
    "conversation": { ... },
    "agent": {
      "id": "uuid",
      "full_name": "Maria Atendente"
    }
  }
}`
      },
      {
        name: "message.status",
        description: "Disparado quando o status de uma mensagem muda (enviado, entregue, lido)",
        payload: `{
  "event": "message.status",
  "timestamp": "2025-01-15T10:31:05Z",
  "data": {
    "message_id": "uuid",
    "status": "read",
    "previous_status": "delivered"
  }
}`
      }
    ]
  },
  contacts: {
    icon: Users,
    title: "Contatos",
    events: [
      {
        name: "contact.created",
        description: "Disparado quando um novo contato é criado",
        payload: `{
  "event": "contact.created",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "contact": {
      "id": "uuid",
      "full_name": "João Silva",
      "phone": "5511999999999",
      "email": "joao@email.com",
      "origin": "whatsapp",
      "origin_campaign": null,
      "lead_status": "novo",
      "created_at": "2025-01-15T10:30:00Z"
    }
  }
}`
      },
      {
        name: "contact.updated",
        description: "Disparado quando os dados de um contato são atualizados",
        payload: `{
  "event": "contact.updated",
  "timestamp": "2025-01-15T10:35:00Z",
  "data": {
    "contact": {
      "id": "uuid",
      "full_name": "João Silva",
      "lead_status": "qualificado"
    },
    "changes": {
      "lead_status": {
        "old": "novo",
        "new": "qualificado"
      }
    }
  }
}`
      },
      {
        name: "contact.tag.added",
        description: "Disparado quando uma tag é adicionada a um contato",
        payload: `{
  "event": "contact.tag.added",
  "timestamp": "2025-01-15T10:36:00Z",
  "data": {
    "contact": { "id": "uuid", "full_name": "João Silva" },
    "tag": {
      "id": "uuid",
      "name": "VIP",
      "color": "#FFD700"
    }
  }
}`
      },
      {
        name: "contact.tag.removed",
        description: "Disparado quando uma tag é removida de um contato",
        payload: `{
  "event": "contact.tag.removed",
  "timestamp": "2025-01-15T10:37:00Z",
  "data": {
    "contact": { "id": "uuid", "full_name": "João Silva" },
    "tag": {
      "id": "uuid",
      "name": "Novo"
    }
  }
}`
      }
    ]
  },
  conversations: {
    icon: MessagesSquare,
    title: "Conversas",
    events: [
      {
        name: "conversation.created",
        description: "Disparado quando uma nova conversa é iniciada",
        payload: `{
  "event": "conversation.created",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "conversation": {
      "id": "uuid",
      "status": "open",
      "created_at": "2025-01-15T10:30:00Z"
    },
    "contact": {
      "id": "uuid",
      "full_name": "João Silva",
      "phone": "5511999999999"
    },
    "channel": {
      "id": "uuid",
      "name": "WhatsApp Principal"
    }
  }
}`
      },
      {
        name: "conversation.assigned",
        description: "Disparado quando uma conversa é atribuída a um agente",
        payload: `{
  "event": "conversation.assigned",
  "timestamp": "2025-01-15T10:32:00Z",
  "data": {
    "conversation": { "id": "uuid" },
    "contact": { ... },
    "agent": {
      "id": "uuid",
      "full_name": "Maria Atendente"
    },
    "previous_agent": null
  }
}`
      },
      {
        name: "conversation.transferred",
        description: "Disparado quando uma conversa é transferida para outro agente/departamento",
        payload: `{
  "event": "conversation.transferred",
  "timestamp": "2025-01-15T10:40:00Z",
  "data": {
    "conversation": { "id": "uuid" },
    "contact": { ... },
    "from_agent": { "id": "uuid", "full_name": "Maria" },
    "to_agent": { "id": "uuid", "full_name": "Carlos" },
    "from_department": { "id": "uuid", "name": "Vendas" },
    "to_department": { "id": "uuid", "name": "Suporte" },
    "transfer_note": "Cliente precisa de suporte técnico"
  }
}`
      },
      {
        name: "conversation.closed",
        description: "Disparado quando uma conversa é encerrada",
        payload: `{
  "event": "conversation.closed",
  "timestamp": "2025-01-15T11:00:00Z",
  "data": {
    "conversation": {
      "id": "uuid",
      "status": "closed",
      "close_reason": "resolvido",
      "closed_at": "2025-01-15T11:00:00Z"
    },
    "contact": { ... },
    "closed_by": {
      "id": "uuid",
      "full_name": "Maria Atendente"
    },
    "duration_minutes": 30
  }
}`
      }
    ]
  },
  deals: {
    icon: Briefcase,
    title: "Negócios",
    events: [
      {
        name: "deal.created",
        description: "Disparado quando um novo negócio é criado",
        payload: `{
  "event": "deal.created",
  "timestamp": "2025-01-15T10:45:00Z",
  "data": {
    "deal": {
      "id": "uuid",
      "title": "Venda Produto X",
      "value": 5000.00,
      "status": "open",
      "stage": "Qualificação",
      "expected_close_date": "2025-02-15"
    },
    "contact": { ... },
    "assigned_to": { "id": "uuid", "full_name": "Carlos Vendedor" }
  }
}`
      },
      {
        name: "deal.stage.changed",
        description: "Disparado quando um negócio muda de etapa no funil",
        payload: `{
  "event": "deal.stage.changed",
  "timestamp": "2025-01-16T14:00:00Z",
  "data": {
    "deal": { "id": "uuid", "title": "Venda Produto X" },
    "previous_stage": { "id": "uuid", "name": "Qualificação" },
    "new_stage": { "id": "uuid", "name": "Proposta" },
    "days_in_previous_stage": 1
  }
}`
      },
      {
        name: "deal.won",
        description: "Disparado quando um negócio é ganho",
        payload: `{
  "event": "deal.won",
  "timestamp": "2025-02-10T16:00:00Z",
  "data": {
    "deal": {
      "id": "uuid",
      "title": "Venda Produto X",
      "value": 5000.00,
      "closed_at": "2025-02-10T16:00:00Z"
    },
    "contact": { ... },
    "won_by": { "id": "uuid", "full_name": "Carlos Vendedor" }
  }
}`
      },
      {
        name: "deal.lost",
        description: "Disparado quando um negócio é perdido",
        payload: `{
  "event": "deal.lost",
  "timestamp": "2025-02-10T16:00:00Z",
  "data": {
    "deal": {
      "id": "uuid",
      "title": "Venda Produto Y",
      "value": 3000.00,
      "lost_reason": "Preço muito alto"
    },
    "contact": { ... }
  }
}`
      }
    ]
  },
  channels: {
    icon: Radio,
    title: "Canais",
    events: [
      {
        name: "channel.connected",
        description: "Disparado quando um canal WhatsApp é conectado",
        payload: `{
  "event": "channel.connected",
  "timestamp": "2025-01-15T09:00:00Z",
  "data": {
    "channel": {
      "id": "uuid",
      "name": "WhatsApp Vendas",
      "phone": "5511988887777",
      "status": "connected"
    }
  }
}`
      },
      {
        name: "channel.disconnected",
        description: "Disparado quando um canal WhatsApp é desconectado",
        payload: `{
  "event": "channel.disconnected",
  "timestamp": "2025-01-15T18:00:00Z",
  "data": {
    "channel": {
      "id": "uuid",
      "name": "WhatsApp Vendas",
      "status": "disconnected",
      "reason": "logout"
    }
  }
}`
      }
    ]
  }
};

export function WebhookApiDocs() {
  return (
    <div className="space-y-6">
      {/* Introduction */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Introdução
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            A API de Webhooks permite que você receba notificações em tempo real sobre eventos que ocorrem no CRM.
            Configure URLs de callback para receber payloads JSON sempre que eventos específicos acontecerem.
          </p>
          
          <div className="grid gap-4 md:grid-cols-3">
            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="font-medium mb-2">Formato</h4>
              <p className="text-sm text-muted-foreground">
                Todos os payloads são enviados como <Badge variant="outline">POST</Badge> com corpo JSON
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="font-medium mb-2">Timeout</h4>
              <p className="text-sm text-muted-foreground">
                Webhooks devem responder em até <Badge variant="outline">30 segundos</Badge>
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="font-medium mb-2">Retentativas</h4>
              <p className="text-sm text-muted-foreground">
                Falhas são retentadas até <Badge variant="outline">3 vezes</Badge> com backoff exponencial
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Autenticação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Para validar que as requisições são originárias do CRM, você pode configurar autenticação de duas formas:
          </p>
          
          <Tabs defaultValue="bearer" className="w-full">
            <TabsList>
              <TabsTrigger value="bearer">Bearer Token</TabsTrigger>
              <TabsTrigger value="custom">Header Customizado</TabsTrigger>
            </TabsList>
            
            <TabsContent value="bearer" className="mt-4">
              <p className="text-sm text-muted-foreground mb-3">
                O token é enviado no header Authorization:
              </p>
              <CodeBlock code={`Authorization: Bearer seu_token_secreto`} language="http" />
            </TabsContent>
            
            <TabsContent value="custom" className="mt-4">
              <p className="text-sm text-muted-foreground mb-3">
                Defina o nome e valor do header customizado:
              </p>
              <CodeBlock code={`X-Webhook-Secret: seu_valor_secreto`} language="http" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            Eventos Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="messages" className="w-full">
            <TabsList className="flex-wrap h-auto gap-1 p-1">
              {Object.entries(EVENTS_DOCS).map(([key, category]) => (
                <TabsTrigger key={key} value={key} className="flex items-center gap-1.5">
                  <category.icon className="h-4 w-4" />
                  {category.title}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {Object.entries(EVENTS_DOCS).map(([key, category]) => (
              <TabsContent key={key} value={key} className="mt-6">
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-6">
                    {category.events.map((event, idx) => (
                      <div key={idx} className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="default" className="font-mono">
                            {event.name}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          {event.description}
                        </p>
                        <div>
                          <h5 className="text-sm font-medium mb-2">Payload de Exemplo:</h5>
                          <CodeBlock code={event.payload} />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Response */}
      <Card>
        <CardHeader>
          <CardTitle>Resposta Esperada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Seu endpoint deve retornar um código de status HTTP 2xx para confirmar o recebimento. 
            Qualquer outro código será considerado uma falha e o webhook será retentado.
          </p>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-2 text-green-600 flex items-center gap-2">
                <Check className="h-4 w-4" /> Sucesso
              </h4>
              <CodeBlock code={`HTTP/1.1 200 OK
Content-Type: application/json

{
  "received": true
}`} />
            </div>
            <div>
              <h4 className="font-medium mb-2 text-destructive flex items-center gap-2">
                Falha (será retentado)
              </h4>
              <CodeBlock code={`HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "error": "Database connection failed"
}`} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Exemplos de Integração</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="n8n">
            <TabsList>
              <TabsTrigger value="n8n">N8N</TabsTrigger>
              <TabsTrigger value="make">Make (Integromat)</TabsTrigger>
              <TabsTrigger value="zapier">Zapier</TabsTrigger>
            </TabsList>
            
            <TabsContent value="n8n" className="mt-4 space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Crie um novo workflow no N8N</li>
                <li>Adicione um nó <Badge variant="outline">Webhook</Badge> como trigger</li>
                <li>Configure como <Badge variant="outline">POST</Badge></li>
                <li>Copie a URL gerada e configure no CRM</li>
                <li>Adicione autenticação se necessário (Header Auth)</li>
              </ol>
            </TabsContent>
            
            <TabsContent value="make" className="mt-4 space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Crie um novo cenário no Make</li>
                <li>Adicione o módulo <Badge variant="outline">Webhooks → Custom Webhook</Badge></li>
                <li>Clique em "Add" para criar um novo webhook</li>
                <li>Copie a URL e configure no CRM</li>
                <li>Execute uma vez para registrar a estrutura de dados</li>
              </ol>
            </TabsContent>
            
            <TabsContent value="zapier" className="mt-4 space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Crie um novo Zap</li>
                <li>Escolha <Badge variant="outline">Webhooks by Zapier</Badge> como trigger</li>
                <li>Selecione <Badge variant="outline">Catch Hook</Badge></li>
                <li>Copie a URL gerada e configure no CRM</li>
                <li>Envie um teste para mapear os campos</li>
              </ol>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
