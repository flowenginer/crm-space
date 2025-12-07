import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Key, Database, MessageSquare, Users, Tag, Briefcase, Building, Phone, FileText } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = "https://lkxrmjqrzhaivviuuamp.supabase.co";

const CodeBlock = ({ code, language = "bash" }: { code: string; language?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Código copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-muted/50 border rounded-lg p-4 overflow-x-auto text-sm">
        <code className="text-foreground/90">{code}</code>
      </pre>
      <Button
        size="sm"
        variant="ghost"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
};

const MethodBadge = ({ method }: { method: string }) => {
  const colors: Record<string, string> = {
    GET: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30",
    POST: "bg-blue-500/20 text-blue-600 border-blue-500/30",
    PATCH: "bg-amber-500/20 text-amber-600 border-amber-500/30",
    DELETE: "bg-red-500/20 text-red-600 border-red-500/30",
  };

  return (
    <Badge variant="outline" className={`font-mono font-semibold ${colors[method] || ""}`}>
      {method}
    </Badge>
  );
};

const EndpointRow = ({ method, endpoint, description }: { method: string; endpoint: string; description: string }) => (
  <div className="flex items-start gap-3 py-3 border-b last:border-0">
    <MethodBadge method={method} />
    <div className="flex-1 min-w-0">
      <code className="text-sm font-mono text-primary break-all">{endpoint}</code>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  </div>
);

export function RestApiDocs() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Documentação da API REST
          </CardTitle>
          <CardDescription>
            Integre seu sistema com o CRM usando nossa API REST completa. 
            Gerencie contatos, conversas, mensagens, negócios e muito mais.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="h-5 w-5" />
            Autenticação
          </CardTitle>
          <CardDescription>
            Todas as requisições devem incluir os headers de autenticação abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div>
              <h4 className="font-medium mb-2">Base URL</h4>
              <CodeBlock code={`${SUPABASE_URL}/rest/v1`} />
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Headers Obrigatórios</h4>
              <CodeBlock code={`apikey: SUA_SUPABASE_ANON_KEY
Authorization: Bearer SEU_JWT_TOKEN
Content-Type: application/json`} />
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <strong>Importante:</strong> O JWT Token é obtido após login do usuário via Supabase Auth. 
                Para integrações server-to-server, use a Service Role Key (com cuidado, ela bypassa RLS).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Accordion type="multiple" className="space-y-4">
        {/* Contacts */}
        <AccordionItem value="contacts" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <span className="font-semibold">Contatos</span>
              <Badge variant="secondary">6 endpoints</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-6">
            <div className="space-y-2">
              <EndpointRow method="GET" endpoint="/contacts" description="Listar todos os contatos" />
              <EndpointRow method="GET" endpoint="/contacts?id=eq.{uuid}" description="Buscar contato por ID" />
              <EndpointRow method="GET" endpoint="/contacts?phone=ilike.*{telefone}*" description="Buscar contato por telefone" />
              <EndpointRow method="POST" endpoint="/contacts" description="Criar novo contato" />
              <EndpointRow method="PATCH" endpoint="/contacts?id=eq.{uuid}" description="Atualizar contato" />
              <EndpointRow method="DELETE" endpoint="/contacts?id=eq.{uuid}" description="Deletar contato" />
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Exemplos</h4>
              
              <div>
                <p className="text-sm text-muted-foreground mb-2">Listar contatos com paginação:</p>
                <CodeBlock code={`curl -X GET "${SUPABASE_URL}/rest/v1/contacts?select=id,full_name,phone,email,lead_status&limit=50&offset=0" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN"`} />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Buscar por telefone:</p>
                <CodeBlock code={`curl -X GET "${SUPABASE_URL}/rest/v1/contacts?phone=ilike.*5521999999999*" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN"`} />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Criar contato:</p>
                <CodeBlock code={`curl -X POST "${SUPABASE_URL}/rest/v1/contacts" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Prefer: return=representation" \\
  -d '{
    "full_name": "João Silva",
    "phone": "5521999999999",
    "email": "joao@email.com",
    "lead_status": "new",
    "state": "RJ",
    "city": "Rio de Janeiro"
  }'`} />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Atualizar contato:</p>
                <CodeBlock code={`curl -X PATCH "${SUPABASE_URL}/rest/v1/contacts?id=eq.UUID_DO_CONTATO" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "lead_status": "qualified",
    "negotiated_value": 5000
  }'`} />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Resposta de exemplo:</p>
                <CodeBlock language="json" code={`{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "full_name": "João Silva",
  "phone": "5521999999999",
  "email": "joao@email.com",
  "lead_status": "new",
  "state": "RJ",
  "city": "Rio de Janeiro",
  "created_at": "2024-12-07T10:00:00Z",
  "updated_at": "2024-12-07T10:00:00Z"
}`} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Conversations */}
        <AccordionItem value="conversations" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-primary" />
              <span className="font-semibold">Conversas</span>
              <Badge variant="secondary">5 endpoints</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-6">
            <div className="space-y-2">
              <EndpointRow method="GET" endpoint="/conversations?status=eq.open" description="Listar conversas abertas" />
              <EndpointRow method="GET" endpoint="/conversations?id=eq.{uuid}" description="Buscar conversa por ID" />
              <EndpointRow method="GET" endpoint="/conversations?contact_id=eq.{uuid}" description="Buscar conversas de um contato" />
              <EndpointRow method="PATCH" endpoint="/conversations?id=eq.{uuid}" description="Atualizar conversa (atribuir, fechar)" />
              <EndpointRow method="POST" endpoint="/conversations" description="Criar nova conversa" />
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Exemplos</h4>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Listar conversas abertas:</p>
                <CodeBlock code={`curl -X GET "${SUPABASE_URL}/rest/v1/conversations?status=eq.open&select=id,contact_id,assigned_to,status,last_message_at&order=last_message_at.desc" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN"`} />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Atribuir conversa a atendente:</p>
                <CodeBlock code={`curl -X PATCH "${SUPABASE_URL}/rest/v1/conversations?id=eq.UUID_DA_CONVERSA" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "assigned_to": "UUID_DO_ATENDENTE",
    "department_id": "UUID_DO_DEPARTAMENTO"
  }'`} />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Fechar conversa:</p>
                <CodeBlock code={`curl -X PATCH "${SUPABASE_URL}/rest/v1/conversations?id=eq.UUID_DA_CONVERSA" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "closed",
    "closed_at": "2024-12-07T15:00:00Z",
    "close_reason": "sold"
  }'`} />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Reabrir conversa:</p>
                <CodeBlock code={`curl -X PATCH "${SUPABASE_URL}/rest/v1/conversations?id=eq.UUID_DA_CONVERSA" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "open",
    "closed_at": null,
    "close_reason": null
  }'`} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Messages */}
        <AccordionItem value="messages" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-primary" />
              <span className="font-semibold">Mensagens & WhatsApp</span>
              <Badge variant="secondary">4 endpoints</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-6">
            <div className="space-y-2">
              <EndpointRow method="GET" endpoint="/messages?conversation_id=eq.{uuid}" description="Histórico de mensagens" />
              <EndpointRow method="POST" endpoint="/messages" description="Criar mensagem no banco" />
              <EndpointRow method="POST" endpoint="/functions/v1/whatsapp-instance" description="Enviar mensagem via WhatsApp" />
              <EndpointRow method="PATCH" endpoint="/messages?id=eq.{uuid}" description="Atualizar status da mensagem" />
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Exemplos</h4>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Buscar histórico de mensagens:</p>
                <CodeBlock code={`curl -X GET "${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.UUID_DA_CONVERSA&select=id,content,is_from_me,status,created_at&order=created_at.desc&limit=50" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN"`} />
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  <strong>Envio via WhatsApp:</strong> Para enviar mensagens pelo WhatsApp, use a Edge Function 
                  <code className="mx-1 bg-blue-500/20 px-1 rounded">whatsapp-instance</code> com a action "send".
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Enviar mensagem de texto via WhatsApp:</p>
                <CodeBlock code={`curl -X POST "${SUPABASE_URL}/functions/v1/whatsapp-instance" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "send",
    "channelId": "UUID_DO_CANAL",
    "phone": "5521999999999",
    "content": "Olá! Esta é uma mensagem via API.",
    "type": "text"
  }'`} />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Enviar imagem via WhatsApp:</p>
                <CodeBlock code={`curl -X POST "${SUPABASE_URL}/functions/v1/whatsapp-instance" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "send",
    "channelId": "UUID_DO_CANAL",
    "phone": "5521999999999",
    "content": "Legenda da imagem",
    "type": "image",
    "mediaUrl": "https://exemplo.com/imagem.jpg"
  }'`} />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Resposta de envio:</p>
                <CodeBlock language="json" code={`{
  "success": true,
  "messageId": "BAED5F1234567890",
  "status": "PENDING"
}`} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Tags */}
        <AccordionItem value="tags" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Tag className="h-5 w-5 text-primary" />
              <span className="font-semibold">Tags</span>
              <Badge variant="secondary">5 endpoints</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-6">
            <div className="space-y-2">
              <EndpointRow method="GET" endpoint="/tags" description="Listar todas as tags" />
              <EndpointRow method="POST" endpoint="/tags" description="Criar nova tag" />
              <EndpointRow method="GET" endpoint="/contact_tags?contact_id=eq.{uuid}" description="Listar tags de um contato" />
              <EndpointRow method="POST" endpoint="/contact_tags" description="Adicionar tag ao contato" />
              <EndpointRow method="DELETE" endpoint="/contact_tags?contact_id=eq.{uuid}&tag_id=eq.{uuid}" description="Remover tag do contato" />
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Exemplos</h4>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Listar todas as tags:</p>
                <CodeBlock code={`curl -X GET "${SUPABASE_URL}/rest/v1/tags?select=id,name,color,usage_count" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN"`} />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Adicionar tag a um contato:</p>
                <CodeBlock code={`curl -X POST "${SUPABASE_URL}/rest/v1/contact_tags" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contact_id": "UUID_DO_CONTATO",
    "tag_id": "UUID_DA_TAG"
  }'`} />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Remover tag de um contato:</p>
                <CodeBlock code={`curl -X DELETE "${SUPABASE_URL}/rest/v1/contact_tags?contact_id=eq.UUID_DO_CONTATO&tag_id=eq.UUID_DA_TAG" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN"`} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Deals */}
        <AccordionItem value="deals" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-primary" />
              <span className="font-semibold">Negócios (Deals)</span>
              <Badge variant="secondary">6 endpoints</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-6">
            <div className="space-y-2">
              <EndpointRow method="GET" endpoint="/pipelines" description="Listar pipelines" />
              <EndpointRow method="GET" endpoint="/pipeline_stages?pipeline_id=eq.{uuid}" description="Listar etapas do pipeline" />
              <EndpointRow method="GET" endpoint="/deals?pipeline_id=eq.{uuid}" description="Listar negócios do pipeline" />
              <EndpointRow method="POST" endpoint="/deals" description="Criar novo negócio" />
              <EndpointRow method="PATCH" endpoint="/deals?id=eq.{uuid}" description="Atualizar negócio / mover etapa" />
              <EndpointRow method="DELETE" endpoint="/deals?id=eq.{uuid}" description="Arquivar negócio" />
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Exemplos</h4>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Listar pipelines:</p>
                <CodeBlock code={`curl -X GET "${SUPABASE_URL}/rest/v1/pipelines?is_active=eq.true&select=id,name,description" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN"`} />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Criar negócio:</p>
                <CodeBlock code={`curl -X POST "${SUPABASE_URL}/rest/v1/deals" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Prefer: return=representation" \\
  -d '{
    "title": "Venda para João",
    "pipeline_id": "UUID_DO_PIPELINE",
    "stage_id": "UUID_DA_ETAPA",
    "contact_id": "UUID_DO_CONTATO",
    "value": 5000,
    "assigned_to": "UUID_DO_VENDEDOR"
  }'`} />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Mover negócio para outra etapa:</p>
                <CodeBlock code={`curl -X PATCH "${SUPABASE_URL}/rest/v1/deals?id=eq.UUID_DO_NEGOCIO" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "stage_id": "UUID_DA_NOVA_ETAPA",
    "stage_entered_at": "2024-12-07T15:00:00Z"
  }'`} />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Marcar negócio como ganho:</p>
                <CodeBlock code={`curl -X PATCH "${SUPABASE_URL}/rest/v1/deals?id=eq.UUID_DO_NEGOCIO" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "won",
    "closed_at": "2024-12-07T15:00:00Z"
  }'`} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Departments & Users */}
        <AccordionItem value="auxiliary" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Building className="h-5 w-5 text-primary" />
              <span className="font-semibold">Departamentos, Canais & Usuários</span>
              <Badge variant="secondary">6 endpoints</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-6">
            <div className="space-y-2">
              <EndpointRow method="GET" endpoint="/departments" description="Listar departamentos" />
              <EndpointRow method="GET" endpoint="/whatsapp_channels?is_deleted=eq.false" description="Listar canais WhatsApp ativos" />
              <EndpointRow method="GET" endpoint="/profiles" description="Listar usuários/atendentes" />
              <EndpointRow method="GET" endpoint="/profiles?role=eq.vendedor" description="Listar vendedores" />
              <EndpointRow method="GET" endpoint="/profiles?is_online=eq.true" description="Listar usuários online" />
              <EndpointRow method="GET" endpoint="/close_reasons" description="Listar motivos de fechamento" />
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Exemplos</h4>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Listar departamentos ativos:</p>
                <CodeBlock code={`curl -X GET "${SUPABASE_URL}/rest/v1/departments?is_active=eq.true&select=id,name,color,icon" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN"`} />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Listar canais WhatsApp conectados:</p>
                <CodeBlock code={`curl -X GET "${SUPABASE_URL}/rest/v1/whatsapp_channels?is_deleted=eq.false&status=eq.connected&select=id,name,owner,status" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN"`} />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Listar vendedores disponíveis:</p>
                <CodeBlock code={`curl -X GET "${SUPABASE_URL}/rest/v1/profiles?role=eq.vendedor&is_active=eq.true&select=id,full_name,is_online,current_conversations" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN"`} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Templates */}
        <AccordionItem value="templates" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-semibold">Templates de Mensagem</span>
              <Badge variant="secondary">4 endpoints</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-6">
            <div className="space-y-2">
              <EndpointRow method="GET" endpoint="/message_templates" description="Listar todos os templates" />
              <EndpointRow method="GET" endpoint="/message_templates?id=eq.{uuid}" description="Buscar template por ID" />
              <EndpointRow method="POST" endpoint="/message_templates" description="Criar novo template" />
              <EndpointRow method="PATCH" endpoint="/message_templates?id=eq.{uuid}" description="Atualizar template" />
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Exemplos</h4>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Listar templates ativos:</p>
                <CodeBlock code={`curl -X GET "${SUPABASE_URL}/rest/v1/message_templates?is_active=eq.true&select=id,title,content,shortcut,category" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN"`} />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Buscar template por atalho:</p>
                <CodeBlock code={`curl -X GET "${SUPABASE_URL}/rest/v1/message_templates?shortcut=eq.ola&select=id,title,content" \\
  -H "apikey: SUA_KEY" \\
  -H "Authorization: Bearer SEU_TOKEN"`} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* JavaScript Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Exemplo em JavaScript/TypeScript</CardTitle>
          <CardDescription>
            Usando o Supabase Client para integração simplificada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CodeBlock language="typescript" code={`import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  '${SUPABASE_URL}',
  'SUA_SUPABASE_ANON_KEY'
)

// Buscar contatos
const { data: contacts, error } = await supabase
  .from('contacts')
  .select('id, full_name, phone, email, lead_status')
  .limit(50)

// Criar contato
const { data: newContact, error: createError } = await supabase
  .from('contacts')
  .insert({
    full_name: 'João Silva',
    phone: '5521999999999',
    email: 'joao@email.com',
    lead_status: 'new'
  })
  .select()
  .single()

// Atualizar contato
const { error: updateError } = await supabase
  .from('contacts')
  .update({ lead_status: 'qualified' })
  .eq('id', 'UUID_DO_CONTATO')

// Enviar mensagem via WhatsApp (Edge Function)
const { data, error: sendError } = await supabase.functions.invoke('whatsapp-instance', {
  body: {
    action: 'send',
    channelId: 'UUID_DO_CANAL',
    phone: '5521999999999',
    content: 'Olá! Mensagem via API.',
    type: 'text'
  }
})`} />
        </CardContent>
      </Card>

      {/* Rate Limits & Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Limites e Observações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium">Rate Limits</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Máximo de 1000 requisições por minuto</li>
                <li>• Limite de 50 mensagens WhatsApp por minuto por canal</li>
                <li>• Paginação recomendada: 50-100 registros por página</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Políticas RLS</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Usuários veem apenas dados do próprio departamento</li>
                <li>• Admins têm acesso completo</li>
                <li>• Service Role Key bypassa todas as políticas</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
