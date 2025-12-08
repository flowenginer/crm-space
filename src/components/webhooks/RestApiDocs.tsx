import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, Database, MessageSquare, Users, Tag, Briefcase, Phone, Shield, Zap, Search, Settings, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = "https://lkxrmjqrzhaivviuuamp.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxreHJtanFyemhhaXZ2aXV1YW1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MDA0NTksImV4cCI6MjA4MDM3NjQ1OX0.h5Z0o7OwO_P-IzC29MA20VJ9W6Ch0tyecrzobXbjju8";

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
        <code className="text-foreground/90 whitespace-pre-wrap break-all">{code}</code>
      </pre>
      <Button
        size="sm"
        variant="outline"
        className="absolute top-2 right-2 gap-1.5"
        onClick={handleCopy}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" />
            <span className="text-xs">Copiado!</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            <span className="text-xs">Copiar</span>
          </>
        )}
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

interface EndpointProps {
  method: string;
  endpoint: string;
  description: string;
  curl: string;
  response?: string;
}

const Endpoint = ({ method, endpoint, description, curl, response }: EndpointProps) => (
  <div className="border rounded-lg p-4 mb-4 bg-card">
    <div className="flex items-start gap-3 mb-3">
      <MethodBadge method={method} />
      <div className="flex-1 min-w-0">
        <code className="text-sm font-mono text-primary break-all">{endpoint}</code>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
    
    <div className="space-y-3">
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium">Requisição:</p>
        <CodeBlock code={curl} />
      </div>
      
      {response && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium">Resposta:</p>
          <CodeBlock code={response} language="json" />
        </div>
      )}
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
            API REST do CRM
          </CardTitle>
          <CardDescription>
            Documentação completa para integrar com N8N, Make, Zapier e outras ferramentas.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Quick Start N8N */}
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-emerald-500" />
            Quick Start - N8N / Make / Zapier
          </CardTitle>
          <CardDescription>
            Configure sua integração em 2 minutos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Badge variant="default" className="rounded-full h-5 w-5 p-0 flex items-center justify-center text-xs">1</Badge>
                Obtenha sua Service Role Key
              </h4>
              <p className="text-sm text-muted-foreground">
                Acesse o <a href="https://supabase.com/dashboard/project/lkxrmjqrzhaivviuuamp/settings/api" target="_blank" rel="noopener noreferrer" className="text-primary underline">Supabase Dashboard → Settings → API</a> e copie a <strong>service_role</strong> key.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Badge variant="default" className="rounded-full h-5 w-5 p-0 flex items-center justify-center text-xs">2</Badge>
                Configure no N8N
              </h4>
              <p className="text-sm text-muted-foreground">
                Use um nó <strong>HTTP Request</strong> com os 2 headers obrigatórios.
              </p>
            </div>
          </div>

          <div className="bg-background border rounded-lg p-4">
            <p className="text-sm font-medium mb-3">Configuração do HTTP Request no N8N:</p>
            <CodeBlock code={`URL: ${SUPABASE_URL}/rest/v1/contacts?select=*&limit=10

Headers (ambos obrigatórios):
  apikey: SUA_SERVICE_ROLE_KEY
  Authorization: Bearer SUA_SERVICE_ROLE_KEY
  Content-Type: application/json`} />
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-blue-700 dark:text-blue-400 flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>Dica:</strong> Use a mesma Service Role Key nos dois headers (<code>apikey</code> e <code>Authorization</code>).
              </span>
            </p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>Importante:</strong> A Service Role Key tem acesso total aos dados. Nunca exponha em frontend ou código público.
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Autenticação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="service" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="service">Service Role Key (Recomendado)</TabsTrigger>
              <TabsTrigger value="jwt">JWT Token (Aplicações)</TabsTrigger>
            </TabsList>
            
            <TabsContent value="service" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Para integrações server-to-server (N8N, Make, Zapier), use a <strong>Service Role Key</strong>.
                Ela bypassa as políticas de segurança (RLS) e dá acesso completo aos dados.
              </p>
              
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">2 Headers obrigatórios:</p>
                <CodeBlock code={`apikey: SUA_SERVICE_ROLE_KEY
Authorization: Bearer SUA_SERVICE_ROLE_KEY`} />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Exemplo completo:</p>
                <CodeBlock code={`curl -X GET "${SUPABASE_URL}/rest/v1/contacts?select=*&limit=10" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json"`} />
              </div>

              <div className="text-sm text-muted-foreground">
                <strong>Onde encontrar:</strong> <a href="https://supabase.com/dashboard/project/lkxrmjqrzhaivviuuamp/settings/api" target="_blank" rel="noopener noreferrer" className="text-primary underline">Supabase Dashboard → Settings → API → service_role</a>
              </div>
            </TabsContent>
            
            <TabsContent value="jwt" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Para aplicações frontend, use autenticação via JWT Token. Requer 2 headers e respeita as políticas de segurança (RLS).
              </p>

              <div className="space-y-2">
                <p className="text-sm font-medium">1. Fazer login para obter o JWT:</p>
                <CodeBlock code={`curl -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{"email": "usuario@email.com", "password": "senha123"}'`} />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">2. Usar o access_token nas requisições:</p>
                <CodeBlock code={`curl -X GET "${SUPABASE_URL}/rest/v1/contacts" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer ACCESS_TOKEN_DO_LOGIN" \\
  -H "Content-Type: application/json"`} />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Endpoints by Category */}
      <Accordion type="multiple" className="space-y-4" defaultValue={["read", "write", "whatsapp"]}>
        
        {/* READ - GET Endpoints */}
        <AccordionItem value="read" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-emerald-500" />
              <span className="font-semibold">Leitura de Dados (GET)</span>
              <Badge variant="secondary">Consultas</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-6">
            
            {/* Contacts */}
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" /> Contatos
              </h4>
              
              <Endpoint
                method="GET"
                endpoint="/contacts?select=*&limit=50"
                description="Listar todos os contatos"
                curl={`curl -X GET "${SUPABASE_URL}/rest/v1/contacts?select=id,full_name,phone,email,lead_status&limit=50" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY"`}
                response={`[
  {
    "id": "uuid-123",
    "full_name": "João Silva",
    "phone": "5521999999999",
    "email": "joao@email.com",
    "lead_status": "new"
  }
]`}
              />

              <Endpoint
                method="GET"
                endpoint="/contacts?phone=eq.{telefone}"
                description="Buscar contato por telefone (exato)"
                curl={`curl -X GET "${SUPABASE_URL}/rest/v1/contacts?phone=eq.5521999999999&select=*" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY"`}
                response={`[
  {
    "id": "uuid-123",
    "full_name": "João Silva",
    "phone": "5521999999999",
    "email": "joao@email.com",
    "lead_status": "qualified"
  }
]`}
              />

              <Endpoint
                method="GET"
                endpoint="/contacts?phone=like.*{parcial}*"
                description="Buscar contato por telefone (parcial)"
                curl={`curl -X GET "${SUPABASE_URL}/rest/v1/contacts?phone=like.*999999999*&select=*" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY"`}
              />

              <Endpoint
                method="GET"
                endpoint="/contacts?id=eq.{uuid}"
                description="Buscar contato por ID"
                curl={`curl -X GET "${SUPABASE_URL}/rest/v1/contacts?id=eq.UUID_DO_CONTATO&select=*" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY"`}
              />
            </div>

            {/* Conversations */}
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Conversas
              </h4>
              
              <Endpoint
                method="GET"
                endpoint="/conversations?status=eq.open"
                description="Listar conversas abertas (básico)"
                curl={`curl -X GET "${SUPABASE_URL}/rest/v1/conversations?status=eq.open&select=id,contact_id,assigned_to,last_message_at&order=last_message_at.desc" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY"`}
                response={`[
  {
    "id": "conv-uuid",
    "contact_id": "contact-uuid",
    "assigned_to": "agent-uuid",
    "last_message_at": "2024-12-07T15:30:00Z"
  }
]`}
              />

              <Endpoint
                method="GET"
                endpoint="/conversations?select=*,contacts(*),profiles(*),departments(*),whatsapp_channels(*)"
                description="⭐ Listar conversas COM TODOS OS DADOS RELACIONADOS (contato, atendente, departamento, canal)"
                curl={`curl -X GET "${SUPABASE_URL}/rest/v1/conversations?status=eq.open&select=*,contacts:contact_id(id,full_name,phone,email,lead_status,avatar_url,negotiated_value,origin,first_contact_at),assigned_agent:assigned_to(id,full_name,role,avatar_url),departments:department_id(id,name,color),whatsapp_channels:channel_id(id,name,phone_number)&order=last_message_at.desc" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY"`}
                response={`[
  {
    "id": "eac777cd-0819-4161-bc63-ed9d4942ed7f",
    "contact_id": "365262e1-2292-4810-aeb8-e1077fab87a3",
    "channel_id": "1b81ac1d-418d-4ce6-91ae-aa2e0ae40c9d",
    "assigned_to": "uuid-do-atendente",
    "department_id": "440b4be6-5833-44ae-a1a9-c61162fc0afa",
    "status": "open",
    "lead_status": "new",
    "last_message_at": "2025-12-08T02:28:51.961+00:00",
    "last_message_preview": "Olá, vim pelo Linktree...",
    "contacts": {
      "id": "365262e1-2292-4810-aeb8-e1077fab87a3",
      "full_name": "João Silva",
      "phone": "5521994576762",
      "email": "joao@email.com",
      "lead_status": "new",
      "avatar_url": null,
      "negotiated_value": 0,
      "origin": "linktree",
      "first_contact_at": "2025-12-05T10:00:00Z"
    },
    "assigned_agent": {
      "id": "uuid-do-atendente",
      "full_name": "Diego",
      "role": "vendedor",
      "avatar_url": null
    },
    "departments": {
      "id": "440b4be6-5833-44ae-a1a9-c61162fc0afa",
      "name": "Vendas",
      "color": "#8B5CF6"
    },
    "whatsapp_channels": {
      "id": "1b81ac1d-418d-4ce6-91ae-aa2e0ae40c9d",
      "name": "VENDAS 01",
      "phone_number": "5521999999999"
    }
  }
]`}
              />

              <Endpoint
                method="GET"
                endpoint="/conversations?contact_id=eq.{uuid}"
                description="Buscar conversas de um contato específico"
                curl={`curl -X GET "${SUPABASE_URL}/rest/v1/conversations?contact_id=eq.UUID_DO_CONTATO&select=*,contacts:contact_id(full_name,phone),assigned_agent:assigned_to(full_name),departments:department_id(name)" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY"`}
              />

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-4 mb-4">
                <p className="text-sm text-blue-700 dark:text-blue-400 flex items-start gap-2">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Dica de JOINs:</strong> Use a sintaxe <code>nome_alias:coluna_fk(campos)</code> para trazer dados relacionados. 
                    Por exemplo: <code>assigned_agent:assigned_to(full_name)</code> traz o nome do atendente usando a FK <code>assigned_to</code>.
                  </span>
                </p>
              </div>
            </div>

            {/* Messages */}
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Mensagens
              </h4>
              
              <Endpoint
                method="GET"
                endpoint="/messages?conversation_id=eq.{uuid}"
                description="Listar mensagens de uma conversa"
                curl={`curl -X GET "${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.UUID_DA_CONVERSA&select=id,content,is_from_me,created_at&order=created_at.desc&limit=50" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY"`}
                response={`[
  {
    "id": "msg-uuid",
    "content": "Olá, tudo bem?",
    "is_from_me": false,
    "created_at": "2024-12-07T15:30:00Z"
  }
]`}
              />
            </div>

            {/* Other entities */}
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4" /> Outros Dados
              </h4>
              
              <Endpoint
                method="GET"
                endpoint="/tags?select=*"
                description="Listar todas as tags"
                curl={`curl -X GET "${SUPABASE_URL}/rest/v1/tags?select=id,name,color" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY"`}
              />

              <Endpoint
                method="GET"
                endpoint="/departments?select=*"
                description="Listar departamentos"
                curl={`curl -X GET "${SUPABASE_URL}/rest/v1/departments?select=id,name,color" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY"`}
              />

              <Endpoint
                method="GET"
                endpoint="/whatsapp_channels?select=*"
                description="Listar canais WhatsApp"
                curl={`curl -X GET "${SUPABASE_URL}/rest/v1/whatsapp_channels?is_deleted=eq.false&select=id,name,phone_number,status" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY"`}
              />

              <Endpoint
                method="GET"
                endpoint="/profiles?select=*"
                description="Listar usuários/agentes"
                curl={`curl -X GET "${SUPABASE_URL}/rest/v1/profiles?is_active=eq.true&select=id,full_name,role" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY"`}
              />
            </div>

          </AccordionContent>
        </AccordionItem>

        {/* WRITE - POST/PATCH Endpoints */}
        <AccordionItem value="write" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-blue-500" />
              <span className="font-semibold">Escrita de Dados (POST/PATCH)</span>
              <Badge variant="secondary">Criação e Atualização</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-6">

            {/* Create Contact */}
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" /> Contatos
              </h4>
              
              <Endpoint
                method="POST"
                endpoint="/contacts"
                description="Criar novo contato"
                curl={`curl -X POST "${SUPABASE_URL}/rest/v1/contacts" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Prefer: return=representation" \\
  -d '{
    "full_name": "João Silva",
    "phone": "5521999999999",
    "email": "joao@email.com",
    "lead_status": "new",
    "origin": "landing_page"
  }'`}
                response={`{
  "id": "uuid-novo-contato",
  "full_name": "João Silva",
  "phone": "5521999999999",
  "email": "joao@email.com",
  "lead_status": "new",
  "created_at": "2024-12-07T15:30:00Z"
}`}
              />

              <Endpoint
                method="PATCH"
                endpoint="/contacts?id=eq.{uuid}"
                description="Atualizar contato"
                curl={`curl -X PATCH "${SUPABASE_URL}/rest/v1/contacts?id=eq.UUID_DO_CONTATO" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "lead_status": "qualified",
    "negotiated_value": 5000
  }'`}
              />
            </div>

            {/* Conversations */}
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Conversas
              </h4>
              
              <Endpoint
                method="PATCH"
                endpoint="/conversations?id=eq.{uuid}"
                description="Atribuir conversa a um agente"
                curl={`curl -X PATCH "${SUPABASE_URL}/rest/v1/conversations?id=eq.UUID_DA_CONVERSA" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "assigned_to": "UUID_DO_AGENTE",
    "department_id": "UUID_DO_DEPARTAMENTO"
  }'`}
              />

              <Endpoint
                method="PATCH"
                endpoint="/conversations?id=eq.{uuid}"
                description="Fechar conversa"
                curl={`curl -X PATCH "${SUPABASE_URL}/rest/v1/conversations?id=eq.UUID_DA_CONVERSA" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "closed",
    "close_reason": "sold",
    "closed_at": "2024-12-07T15:30:00Z"
  }'`}
              />
            </div>

            {/* Tags */}
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Tag className="h-4 w-4" /> Tags
              </h4>
              
              <Endpoint
                method="POST"
                endpoint="/contact_tags"
                description="Adicionar tag ao contato"
                curl={`curl -X POST "${SUPABASE_URL}/rest/v1/contact_tags" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contact_id": "UUID_DO_CONTATO",
    "tag_id": "UUID_DA_TAG"
  }'`}
              />

              <Endpoint
                method="DELETE"
                endpoint="/contact_tags?contact_id=eq.{uuid}&tag_id=eq.{uuid}"
                description="Remover tag do contato"
                curl={`curl -X DELETE "${SUPABASE_URL}/rest/v1/contact_tags?contact_id=eq.UUID_DO_CONTATO&tag_id=eq.UUID_DA_TAG" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY"`}
              />
            </div>

          </AccordionContent>
        </AccordionItem>

        {/* WhatsApp */}
        <AccordionItem value="whatsapp" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-green-500" />
              <span className="font-semibold">Enviar Mensagens WhatsApp</span>
              <Badge variant="secondary">Edge Function</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                Para enviar mensagens WhatsApp, use a Edge Function <code className="bg-background px-1 rounded">whatsapp-instance</code>.
                Esta função cuida da integração com os provedores (Evolution API, UAZAPI, Z-API).
              </p>
            </div>

            <Endpoint
              method="POST"
              endpoint="/functions/v1/whatsapp-instance"
              description="Enviar mensagem de texto"
              curl={`curl -X POST "${SUPABASE_URL}/functions/v1/whatsapp-instance" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "send",
    "channelId": "UUID_DO_CANAL",
    "phone": "5521999999999",
    "content": "Olá! Tudo bem?",
    "type": "text"
  }'`}
              response={`{
  "success": true,
  "messageId": "WHATSAPP_MESSAGE_ID"
}`}
            />

            <Endpoint
              method="POST"
              endpoint="/functions/v1/whatsapp-instance"
              description="Enviar imagem"
              curl={`curl -X POST "${SUPABASE_URL}/functions/v1/whatsapp-instance" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "send",
    "channelId": "UUID_DO_CANAL",
    "phone": "5521999999999",
    "content": "Confira nossa oferta!",
    "type": "image",
    "mediaUrl": "https://exemplo.com/imagem.jpg"
  }'`}
            />

            <Endpoint
              method="POST"
              endpoint="/functions/v1/whatsapp-instance"
              description="Enviar documento/PDF"
              curl={`curl -X POST "${SUPABASE_URL}/functions/v1/whatsapp-instance" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "send",
    "channelId": "UUID_DO_CANAL",
    "phone": "5521999999999",
    "content": "proposta.pdf",
    "type": "document",
    "mediaUrl": "https://exemplo.com/proposta.pdf"
  }'`}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Deals */}
        <AccordionItem value="deals" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-purple-500" />
              <span className="font-semibold">Negócios (Deals)</span>
              <Badge variant="secondary">CRM</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-4">
            
            <Endpoint
              method="GET"
              endpoint="/deals?select=*"
              description="Listar todos os negócios"
              curl={`curl -X GET "${SUPABASE_URL}/rest/v1/deals?select=id,title,value,status,stage_id,contact_id&order=created_at.desc" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY"`}
            />

            <Endpoint
              method="POST"
              endpoint="/deals"
              description="Criar novo negócio"
              curl={`curl -X POST "${SUPABASE_URL}/rest/v1/deals" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Prefer: return=representation" \\
  -d '{
    "title": "Venda - João Silva",
    "value": 5000,
    "contact_id": "UUID_DO_CONTATO",
    "pipeline_id": "UUID_DO_PIPELINE",
    "stage_id": "UUID_DA_ETAPA",
    "status": "open"
  }'`}
            />

            <Endpoint
              method="PATCH"
              endpoint="/deals?id=eq.{uuid}"
              description="Mover para outra etapa"
              curl={`curl -X PATCH "${SUPABASE_URL}/rest/v1/deals?id=eq.UUID_DO_DEAL" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "stage_id": "UUID_DA_NOVA_ETAPA"
  }'`}
            />

            <Endpoint
              method="PATCH"
              endpoint="/deals?id=eq.{uuid}"
              description="Marcar como ganho"
              curl={`curl -X PATCH "${SUPABASE_URL}/rest/v1/deals?id=eq.UUID_DO_DEAL" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "won",
    "closed_at": "2024-12-07T15:30:00Z"
  }'`}
            />

            <Endpoint
              method="PATCH"
              endpoint="/deals?id=eq.{uuid}"
              description="Marcar como perdido"
              curl={`curl -X PATCH "${SUPABASE_URL}/rest/v1/deals?id=eq.UUID_DO_DEAL" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "lost",
    "lost_reason": "Preço alto",
    "closed_at": "2024-12-07T15:30:00Z"
  }'`}
            />

          </AccordionContent>
        </AccordionItem>

      </Accordion>

      {/* Query Parameters Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Referência de Filtros</CardTitle>
          <CardDescription>
            Operadores disponíveis para filtrar dados nas requisições GET.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Comparação</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li><code className="bg-muted px-1 rounded">eq.</code> - Igual (exato)</li>
                <li><code className="bg-muted px-1 rounded">neq.</code> - Diferente</li>
                <li><code className="bg-muted px-1 rounded">gt.</code> - Maior que</li>
                <li><code className="bg-muted px-1 rounded">gte.</code> - Maior ou igual</li>
                <li><code className="bg-muted px-1 rounded">lt.</code> - Menor que</li>
                <li><code className="bg-muted px-1 rounded">lte.</code> - Menor ou igual</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Texto</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li><code className="bg-muted px-1 rounded">like.*texto*</code> - Contém (case sensitive)</li>
                <li><code className="bg-muted px-1 rounded">ilike.*texto*</code> - Contém (ignora maiúsculas)</li>
                <li><code className="bg-muted px-1 rounded">is.null</code> - É nulo</li>
                <li><code className="bg-muted px-1 rounded">is.not.null</code> - Não é nulo</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Ordenação e Paginação</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li><code className="bg-muted px-1 rounded">order=campo.desc</code> - Ordenar decrescente</li>
                <li><code className="bg-muted px-1 rounded">order=campo.asc</code> - Ordenar crescente</li>
                <li><code className="bg-muted px-1 rounded">limit=50</code> - Limitar resultados</li>
                <li><code className="bg-muted px-1 rounded">offset=100</code> - Pular registros</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Seleção de Campos</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li><code className="bg-muted px-1 rounded">select=*</code> - Todos os campos</li>
                <li><code className="bg-muted px-1 rounded">select=id,nome</code> - Campos específicos</li>
                <li><code className="bg-muted px-1 rounded">select=*,contatos(*)</code> - Com relações</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Limites e Boas Práticas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• <strong>Rate Limit:</strong> 1000 requisições por hora por IP</li>
            <li>• <strong>Limite por consulta:</strong> Máximo de 1000 registros por requisição</li>
            <li>• <strong>Paginação:</strong> Use <code>limit</code> e <code>offset</code> para grandes volumes</li>
            <li>• <strong>Campos:</strong> Selecione apenas os campos necessários para melhor performance</li>
            <li>• <strong>Cache:</strong> Implemente cache local para dados que mudam pouco</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
