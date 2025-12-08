import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Key, Database, MessageSquare, Users, Tag, Briefcase, Building, Phone, FileText, Shield, Terminal, Lightbulb, AlertTriangle } from "lucide-react";
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

interface UseCaseProps {
  cases: string[];
}

const UseCaseBlock = ({ cases }: UseCaseProps) => (
  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 my-3">
    <div className="flex items-start gap-2">
      <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium text-primary mb-2">Quando usar:</p>
        <ul className="text-sm text-muted-foreground space-y-1">
          {cases.map((useCase, i) => (
            <li key={i}>• {useCase}</li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);

interface EndpointCardProps {
  method: string;
  endpoint: string;
  description: string;
  useCases: string[];
  curl: string;
  note?: string;
}

const EndpointCard = ({ method, endpoint, description, useCases, curl, note }: EndpointCardProps) => (
  <div className="border rounded-lg p-4 mb-4 bg-card">
    <div className="flex items-start gap-3 mb-3">
      <MethodBadge method={method} />
      <div className="flex-1 min-w-0">
        <code className="text-sm font-mono text-primary break-all">{endpoint}</code>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
    
    <UseCaseBlock cases={useCases} />
    
    {note && (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-3">
        <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          {note}
        </p>
      </div>
    )}
    
    <div>
      <p className="text-xs text-muted-foreground mb-2 font-medium">cURL completo (pronto para copiar):</p>
      <CodeBlock code={curl} />
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

      {/* Credentials Guide */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Como Obter Suas Credenciais
          </CardTitle>
          <CardDescription>
            Siga os passos abaixo para obter as credenciais necessárias para usar a API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: ANON KEY */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="rounded-full h-6 w-6 p-0 flex items-center justify-center">1</Badge>
              <h4 className="font-semibold">Obter a ANON KEY (apikey)</h4>
            </div>
            <p className="text-sm text-muted-foreground ml-8">
              A ANON KEY é uma chave pública usada para identificar seu projeto. Ela é segura para usar no frontend 
              pois as políticas de segurança (RLS) controlam o acesso aos dados.
            </p>
            <div className="ml-8 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-2 font-medium">
                ✓ ANON KEY deste projeto (já configurada):
              </p>
              <CodeBlock code={ANON_KEY} />
            </div>
            <p className="text-xs text-muted-foreground ml-8">
              Você também pode encontrar esta chave em: Supabase Dashboard → Settings → API → anon public
            </p>
          </div>

          {/* Step 2: JWT Token */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="rounded-full h-6 w-6 p-0 flex items-center justify-center">2</Badge>
              <h4 className="font-semibold">Obter o JWT Token (Authorization)</h4>
            </div>
            <p className="text-sm text-muted-foreground ml-8">
              O JWT Token identifica o usuário autenticado. Você obtém este token fazendo login com email e senha.
              O token expira após um período, então você precisa renová-lo periodicamente.
            </p>
            <div className="ml-8">
              <p className="text-xs text-muted-foreground mb-2 font-medium flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5" />
                cURL para fazer login e obter o JWT Token:
              </p>
              <CodeBlock code={`curl -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "seu_email@exemplo.com",
    "password": "sua_senha"
  }'`} />
            </div>
            <div className="ml-8">
              <p className="text-xs text-muted-foreground mb-2">Resposta (o access_token é seu JWT):</p>
              <CodeBlock language="json" code={`{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "xxx-refresh-token-xxx",
  "user": {
    "id": "uuid-do-usuario",
    "email": "seu_email@exemplo.com"
  }
}`} />
            </div>
          </div>

          {/* Step 3: How to use */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="rounded-full h-6 w-6 p-0 flex items-center justify-center">3</Badge>
              <h4 className="font-semibold">Como Usar nas Requisições</h4>
            </div>
            <p className="text-sm text-muted-foreground ml-8">
              Todas as requisições à API devem incluir estes dois headers:
            </p>
            <div className="ml-8">
              <CodeBlock code={`# Headers obrigatórios em todas as requisições:
apikey: ${ANON_KEY}
Authorization: Bearer SEU_JWT_TOKEN_AQUI
Content-Type: application/json`} />
            </div>
          </div>

          {/* Warning about Service Role */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>Importante:</strong> Para integrações server-to-server (N8N, Make, Zapier), você pode usar a 
                <strong> Service Role Key</strong> que bypassa as políticas de segurança. Esta chave deve ser mantida 
                em segredo e NUNCA exposta no frontend. Encontre-a em: Supabase Dashboard → Settings → API → service_role
              </span>
            </p>
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
          <AccordionContent className="pt-4 space-y-4">
            <EndpointCard
              method="GET"
              endpoint="/contacts"
              description="Listar todos os contatos com paginação"
              useCases={[
                "Sincronizar base de leads com seu sistema ERP/CRM externo",
                "Exportar dados para ferramentas de BI (Power BI, Metabase)",
                "Criar dashboards personalizados com métricas de leads",
                "Integrar com planilhas do Google Sheets via N8N/Make"
              ]}
              curl={`curl -X GET "${SUPABASE_URL}/rest/v1/contacts?select=id,full_name,phone,email,lead_status,created_at&limit=50&offset=0&order=created_at.desc" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN"`}
            />

            <EndpointCard
              method="GET"
              endpoint="/contacts?phone=ilike.*{telefone}*"
              description="Buscar contato por telefone"
              useCases={[
                "Verificar se um lead já existe antes de criar duplicata",
                "Buscar dados do cliente quando ele liga para o call center",
                "Validar número antes de enviar mensagem em massa"
              ]}
              curl={`curl -X GET "${SUPABASE_URL}/rest/v1/contacts?phone=ilike.*5521999999999*&select=id,full_name,phone,email,lead_status" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN"`}
            />

            <EndpointCard
              method="POST"
              endpoint="/contacts"
              description="Criar novo contato"
              useCases={[
                "Importar leads capturados em landing pages do seu site",
                "Integrar formulários de contato (Typeform, Google Forms)",
                "Migrar dados de outro CRM para este sistema",
                "Cadastrar leads automaticamente quando preenchem formulário"
              ]}
              note="Use o header 'Prefer: return=representation' para receber o contato criado na resposta."
              curl={`curl -X POST "${SUPABASE_URL}/rest/v1/contacts" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Prefer: return=representation" \\
  -d '{
    "full_name": "João Silva",
    "phone": "5521999999999",
    "email": "joao@email.com",
    "lead_status": "new",
    "origin": "landing_page",
    "state": "RJ",
    "city": "Rio de Janeiro"
  }'`}
            />

            <EndpointCard
              method="PATCH"
              endpoint="/contacts?id=eq.{uuid}"
              description="Atualizar dados do contato"
              useCases={[
                "Atualizar status do lead via automação quando ele avança no funil",
                "Sincronizar campos com sistema ERP (ex: valor negociado, CPF)",
                "Marcar lead como qualificado após análise automática",
                "Atualizar dados do cliente após confirmação de compra"
              ]}
              curl={`curl -X PATCH "${SUPABASE_URL}/rest/v1/contacts?id=eq.UUID_DO_CONTATO" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "lead_status": "qualified",
    "negotiated_value": 5000,
    "notes": "Cliente interessado em plano premium"
  }'`}
            />

            <EndpointCard
              method="DELETE"
              endpoint="/contacts?id=eq.{uuid}"
              description="Deletar contato"
              useCases={[
                "Remover leads inválidos ou spam após validação",
                "Limpar base de testes",
                "Atender solicitações de exclusão de dados (LGPD)"
              ]}
              note="Cuidado: Esta ação é irreversível e pode afetar conversas e negócios vinculados."
              curl={`curl -X DELETE "${SUPABASE_URL}/rest/v1/contacts?id=eq.UUID_DO_CONTATO" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN"`}
            />
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
          <AccordionContent className="pt-4 space-y-4">
            <EndpointCard
              method="GET"
              endpoint="/conversations?status=eq.open"
              description="Listar conversas abertas"
              useCases={[
                "Monitorar fila de atendimentos pendentes em dashboard externo",
                "Criar alertas quando há muitas conversas sem resposta",
                "Integrar com sistema de distribuição automática de leads",
                "Gerar relatórios de tempo de espera dos clientes"
              ]}
              curl={`curl -X GET "${SUPABASE_URL}/rest/v1/conversations?status=eq.open&select=id,contact_id,assigned_to,department_id,last_message_at,unread_count&order=last_message_at.desc&limit=50" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN"`}
            />

            <EndpointCard
              method="PATCH"
              endpoint="/conversations?id=eq.{uuid}"
              description="Atribuir conversa a atendente ou departamento"
              useCases={[
                "Distribuir leads automaticamente baseado em regras de negócio",
                "Redirecionar conversa quando detectar palavra-chave específica",
                "Integrar com chatbot para encaminhar ao setor correto",
                "Balancear carga entre atendentes via automação"
              ]}
              curl={`curl -X PATCH "${SUPABASE_URL}/rest/v1/conversations?id=eq.UUID_DA_CONVERSA" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "assigned_to": "UUID_DO_ATENDENTE",
    "department_id": "UUID_DO_DEPARTAMENTO"
  }'`}
            />

            <EndpointCard
              method="PATCH"
              endpoint="/conversations?id=eq.{uuid}"
              description="Fechar conversa com motivo"
              useCases={[
                "Fechar atendimento automaticamente após confirmação de venda no ERP",
                "Encerrar conversa quando pagamento é confirmado",
                "Marcar como perdido quando lead cancela no checkout",
                "Automatizar fechamento após inatividade prolongada"
              ]}
              curl={`curl -X PATCH "${SUPABASE_URL}/rest/v1/conversations?id=eq.UUID_DA_CONVERSA" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "closed",
    "closed_at": "2024-12-07T15:00:00Z",
    "close_reason": "sold"
  }'`}
            />

            <EndpointCard
              method="PATCH"
              endpoint="/conversations?id=eq.{uuid}"
              description="Reabrir conversa fechada"
              useCases={[
                "Reabrir quando cliente responde após fechamento",
                "Retomar atendimento após resolução de problema técnico",
                "Reativar conversa para follow-up de pós-venda"
              ]}
              curl={`curl -X PATCH "${SUPABASE_URL}/rest/v1/conversations?id=eq.UUID_DA_CONVERSA" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "open",
    "closed_at": null,
    "close_reason": null
  }'`}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Messages & WhatsApp */}
        <AccordionItem value="messages" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-primary" />
              <span className="font-semibold">Mensagens & WhatsApp</span>
              <Badge variant="secondary">4 endpoints</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-4">
            <EndpointCard
              method="GET"
              endpoint="/messages?conversation_id=eq.{uuid}"
              description="Buscar histórico de mensagens de uma conversa"
              useCases={[
                "Auditoria e compliance de atendimentos",
                "Gerar relatórios de qualidade de atendimento",
                "Exportar histórico para análise de sentimento via IA",
                "Backup de conversas para arquivo"
              ]}
              curl={`curl -X GET "${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.UUID_DA_CONVERSA&select=id,content,is_from_me,status,message_type,media_url,created_at&order=created_at.desc&limit=100" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN"`}
            />

            <EndpointCard
              method="POST"
              endpoint="/functions/v1/whatsapp-instance"
              description="Enviar mensagem de texto via WhatsApp"
              useCases={[
                "Enviar notificações automáticas de status de pedido",
                "Confirmar agendamentos e lembretes",
                "Disparar mensagens de boas-vindas após cadastro",
                "Enviar links de pagamento após fechamento de venda",
                "Integrar com chatbots externos (Dialogflow, ChatGPT)"
              ]}
              note="Esta é uma Edge Function. Use apenas o header Authorization (sem apikey)."
              curl={`curl -X POST "${SUPABASE_URL}/functions/v1/whatsapp-instance" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "send",
    "channelId": "UUID_DO_CANAL_WHATSAPP",
    "phone": "5521999999999",
    "content": "Olá! Seu pedido #12345 foi confirmado. Previsão de entrega: 3 dias úteis.",
    "type": "text"
  }'`}
            />

            <EndpointCard
              method="POST"
              endpoint="/functions/v1/whatsapp-instance"
              description="Enviar imagem/documento via WhatsApp"
              useCases={[
                "Enviar comprovantes de pagamento",
                "Enviar boletos e notas fiscais",
                "Enviar catálogos de produtos",
                "Compartilhar contratos e documentos"
              ]}
              curl={`curl -X POST "${SUPABASE_URL}/functions/v1/whatsapp-instance" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "send",
    "channelId": "UUID_DO_CANAL_WHATSAPP",
    "phone": "5521999999999",
    "content": "Segue seu boleto para pagamento",
    "type": "document",
    "mediaUrl": "https://seu-servidor.com/boleto.pdf",
    "fileName": "boleto_12345.pdf"
  }'`}
            />

            <div className="border rounded-lg p-4 bg-card">
              <p className="text-sm text-muted-foreground mb-2">Resposta de envio bem-sucedido:</p>
              <CodeBlock language="json" code={`{
  "success": true,
  "messageId": "BAED5F1234567890",
  "status": "PENDING"
}`} />
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
          <AccordionContent className="pt-4 space-y-4">
            <EndpointCard
              method="GET"
              endpoint="/tags"
              description="Listar todas as tags disponíveis"
              useCases={[
                "Carregar opções de segmentação em sistema externo",
                "Sincronizar categorias com ferramenta de marketing",
                "Mapear tags para campos de CRM externo"
              ]}
              curl={`curl -X GET "${SUPABASE_URL}/rest/v1/tags?is_active=eq.true&select=id,name,color,usage_count&order=name.asc" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN"`}
            />

            <EndpointCard
              method="POST"
              endpoint="/contact_tags"
              description="Adicionar tag a um contato"
              useCases={[
                "Segmentar leads automaticamente baseado em comportamento (ex: acessou página de preços)",
                "Marcar leads que vieram de campanha específica",
                "Categorizar leads por interesse detectado em mensagens",
                "Etiquetar clientes VIP após compra de alto valor"
              ]}
              curl={`curl -X POST "${SUPABASE_URL}/rest/v1/contact_tags" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Prefer: return=representation" \\
  -d '{
    "contact_id": "UUID_DO_CONTATO",
    "tag_id": "UUID_DA_TAG"
  }'`}
            />

            <EndpointCard
              method="DELETE"
              endpoint="/contact_tags?contact_id=eq.{uuid}&tag_id=eq.{uuid}"
              description="Remover tag de um contato"
              useCases={[
                "Limpar segmentação quando lead avança no funil",
                "Remover tag de promoção após término da campanha",
                "Atualizar categorização após mudança de status"
              ]}
              curl={`curl -X DELETE "${SUPABASE_URL}/rest/v1/contact_tags?contact_id=eq.UUID_DO_CONTATO&tag_id=eq.UUID_DA_TAG" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN"`}
            />
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
          <AccordionContent className="pt-4 space-y-4">
            <EndpointCard
              method="GET"
              endpoint="/pipelines"
              description="Listar pipelines de vendas"
              useCases={[
                "Carregar opções de pipeline em sistema de automação",
                "Sincronizar etapas com ferramenta de BI"
              ]}
              curl={`curl -X GET "${SUPABASE_URL}/rest/v1/pipelines?is_active=eq.true&select=id,name,description" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN"`}
            />

            <EndpointCard
              method="GET"
              endpoint="/pipeline_stages?pipeline_id=eq.{uuid}"
              description="Listar etapas de um pipeline"
              useCases={[
                "Mapear etapas para automações de movimentação",
                "Criar regras de negócio baseadas em estágio"
              ]}
              curl={`curl -X GET "${SUPABASE_URL}/rest/v1/pipeline_stages?pipeline_id=eq.UUID_DO_PIPELINE&select=id,name,color,order_position&order=order_position.asc" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN"`}
            />

            <EndpointCard
              method="POST"
              endpoint="/deals"
              description="Criar novo negócio"
              useCases={[
                "Criar oportunidade automaticamente quando lead demonstra interesse",
                "Integrar com checkout para criar deal quando carrinho é preenchido",
                "Gerar negócio após qualificação automática do lead",
                "Criar proposta comercial a partir de cotação no ERP"
              ]}
              curl={`curl -X POST "${SUPABASE_URL}/rest/v1/deals" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Prefer: return=representation" \\
  -d '{
    "title": "Venda Plano Premium - João Silva",
    "pipeline_id": "UUID_DO_PIPELINE",
    "stage_id": "UUID_DA_ETAPA_INICIAL",
    "contact_id": "UUID_DO_CONTATO",
    "value": 5000,
    "assigned_to": "UUID_DO_VENDEDOR",
    "expected_close_date": "2024-12-31"
  }'`}
            />

            <EndpointCard
              method="PATCH"
              endpoint="/deals?id=eq.{uuid}"
              description="Mover negócio para outra etapa"
              useCases={[
                "Avançar deal quando pagamento é confirmado no gateway",
                "Mover para 'Aguardando Documentos' após envio de contrato",
                "Integrar com sistema financeiro para atualizar status",
                "Automatizar fluxo baseado em eventos externos"
              ]}
              curl={`curl -X PATCH "${SUPABASE_URL}/rest/v1/deals?id=eq.UUID_DO_NEGOCIO" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "stage_id": "UUID_DA_NOVA_ETAPA",
    "stage_entered_at": "2024-12-07T15:00:00Z"
  }'`}
            />

            <EndpointCard
              method="PATCH"
              endpoint="/deals?id=eq.{uuid}"
              description="Marcar negócio como ganho/perdido"
              useCases={[
                "Fechar como ganho quando pagamento é confirmado",
                "Marcar como perdido quando pedido é cancelado",
                "Atualizar automaticamente via webhook do gateway de pagamento"
              ]}
              curl={`curl -X PATCH "${SUPABASE_URL}/rest/v1/deals?id=eq.UUID_DO_NEGOCIO" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "won",
    "closed_at": "2024-12-07T15:00:00Z"
  }'`}
            />
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
          <AccordionContent className="pt-4 space-y-4">
            <EndpointCard
              method="GET"
              endpoint="/departments"
              description="Listar departamentos"
              useCases={[
                "Carregar opções de departamento para roteamento de leads",
                "Mapear departamentos para regras de distribuição"
              ]}
              curl={`curl -X GET "${SUPABASE_URL}/rest/v1/departments?is_active=eq.true&select=id,name,color,icon" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN"`}
            />

            <EndpointCard
              method="GET"
              endpoint="/whatsapp_channels?is_deleted=eq.false"
              description="Listar canais WhatsApp conectados"
              useCases={[
                "Selecionar canal para envio de mensagens via API",
                "Monitorar status de conexão dos canais",
                "Rotear mensagens para canal específico baseado em regra"
              ]}
              curl={`curl -X GET "${SUPABASE_URL}/rest/v1/whatsapp_channels?is_deleted=eq.false&status=eq.connected&select=id,name,owner,status" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN"`}
            />

            <EndpointCard
              method="GET"
              endpoint="/profiles?role=eq.vendedor&is_active=eq.true"
              description="Listar vendedores disponíveis"
              useCases={[
                "Distribuir leads baseado em disponibilidade",
                "Balancear carga entre atendentes",
                "Criar regras de round-robin para atribuição"
              ]}
              curl={`curl -X GET "${SUPABASE_URL}/rest/v1/profiles?role=eq.vendedor&is_active=eq.true&select=id,full_name,is_online,is_available,current_conversations,max_conversations" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN"`}
            />

            <EndpointCard
              method="GET"
              endpoint="/close_reasons"
              description="Listar motivos de fechamento"
              useCases={[
                "Carregar opções de fechamento em automação",
                "Mapear motivos para relatórios externos"
              ]}
              curl={`curl -X GET "${SUPABASE_URL}/rest/v1/close_reasons?is_active=eq.true&select=id,name,value,color&order=order_position.asc" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN"`}
            />
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
          <AccordionContent className="pt-4 space-y-4">
            <EndpointCard
              method="GET"
              endpoint="/message_templates"
              description="Listar templates de mensagem"
              useCases={[
                "Carregar templates disponíveis em sistema de automação",
                "Usar template específico em campanhas de disparo",
                "Sincronizar templates com chatbot externo"
              ]}
              curl={`curl -X GET "${SUPABASE_URL}/rest/v1/message_templates?is_active=eq.true&select=id,title,content,shortcut,category,media_url,media_type" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN"`}
            />

            <EndpointCard
              method="GET"
              endpoint="/message_templates?shortcut=eq.{atalho}"
              description="Buscar template por atalho"
              useCases={[
                "Encontrar template específico para uso em automação",
                "Validar se atalho existe antes de usar"
              ]}
              curl={`curl -X GET "${SUPABASE_URL}/rest/v1/message_templates?shortcut=eq.ola&select=id,title,content,media_url" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer SEU_JWT_TOKEN"`}
            />
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

// Inicializar cliente
const supabase = createClient(
  '${SUPABASE_URL}',
  '${ANON_KEY}'
)

// 1. Fazer login para obter sessão
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: 'seu_email@exemplo.com',
  password: 'sua_senha'
})
// O token JWT está em: authData.session.access_token

// 2. Buscar contatos
const { data: contacts, error } = await supabase
  .from('contacts')
  .select('id, full_name, phone, email, lead_status')
  .order('created_at', { ascending: false })
  .limit(50)

// 3. Criar contato
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

// 4. Atualizar contato
const { error: updateError } = await supabase
  .from('contacts')
  .update({ lead_status: 'qualified', negotiated_value: 5000 })
  .eq('id', 'UUID_DO_CONTATO')

// 5. Adicionar tag ao contato
const { error: tagError } = await supabase
  .from('contact_tags')
  .insert({ contact_id: 'UUID_DO_CONTATO', tag_id: 'UUID_DA_TAG' })

// 6. Enviar mensagem via WhatsApp (Edge Function)
const { data, error: sendError } = await supabase.functions.invoke('whatsapp-instance', {
  body: {
    action: 'send',
    channelId: 'UUID_DO_CANAL',
    phone: '5521999999999',
    content: 'Olá! Seu pedido foi confirmado.',
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
          
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-4">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              <strong>Dica:</strong> Para integrações N8N, Make ou Zapier, use a Service Role Key para evitar 
              problemas com autenticação de usuário. Lembre-se de manter esta chave em segredo.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
