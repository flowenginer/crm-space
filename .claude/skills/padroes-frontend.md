---
name: padroes-frontend
description: Criacao de interfaces para CRM SaaS com regras estritas de componentizacao, stack correta, estados de erro, acessibilidade. Retorna codigo + justificativa de design.
---

# Skill: Padroes de Frontend

Voce eh o agente `@frontend` criando ou revisando interfaces. Siga TODAS as regras abaixo sem excecao. Toda entrega DEVE incluir o codigo gerado E a justificativa das escolhas de design.

## Stack Obrigatoria

- **Framework:** React 18 com Vite 5 (SPA, nao Next.js)
- **Estilo:** Tailwind CSS 3.4 + shadcn/ui + Radix UI primitives
- **Icones:** Lucide React (NUNCA outro icon pack)
- **Toasts:** Sonner (NUNCA alert() ou window.confirm())
- **Formularios:** React Hook Form + Zod
- **State server:** TanStack Query 5
- **State local:** useState / useReducer
- **State global:** Zustand 5 (logica compartilhada) + Context (auth/theme)
- **Rotas:** React Router DOM (SEM lazy loading — projeto nao usa)
- **Animacoes:** Framer Motion 12 (`import from 'framer-motion'`, NUNCA `motion/react`)
- **Flow Builder:** @xyflow/react 12 (para automacoes e fluxos)
- **Graficos:** Recharts (para dashboards e relatorios)
- **Utilitarios:** cn() (clsx + tailwind-merge), date-fns

---

## REGRAS INVIOLAVEIS

1. **Desktop-first, responsivo** — base eh desktop CRM, adaptar para tablet/mobile com breakpoints
2. **Componentes < 150 linhas** — se exceder, quebrar (ATENCAO: Conversations.tsx tem 310KB — nao repetir esse erro)
3. **Props tipadas via interface** — nunca inline, nunca `any`
4. **Logica em hooks, UI nos componentes** — separacao obrigatoria
5. **Nunca definir componente dentro de outro** — sempre escopo do modulo
6. **Nunca `style={{}}` inline** — usar Tailwind
7. **Nunca `any`** — tipar tudo explicitamente (tsconfig nao eh strict — DIVIDA TECNICA, trabalhar rumo a strictness)
8. **Todo componente com dados tem 3 estados:** loading, error, success
9. **Acessibilidade obrigatoria** — ARIA, keyboard nav, contraste, reduced motion
10. **Todo codigo entregue vem com justificativa de design**

### NOTA SOBRE TIPAGEM

O tsconfig atual tem `noImplicitAny: false` e `strictNullChecks: false`. Isso eh divida tecnica herdada do Lovable. Mesmo assim:
- Tipar TUDO explicitamente em codigo novo
- Nunca adicionar `any` novo — sempre criar interface/type apropriado
- Nunca adicionar `@ts-ignore` novo — usar `@ts-expect-error` com justificativa se inevitavel
- Marcar TODOs para migrar progressivamente para strict

---

## 1. LINGUAGEM VISUAL — CRM Profissional

### Paleta
- **Fundo:** Tema claro/escuro via CSS variables (shadcn/ui theming)
- **Texto:** Hierarquia clara — `text-foreground` (primario), `text-muted-foreground` (secundario)
- **Accent:** Cor primaria do tema para CTAs e estados ativos
- **Cards:** `bg-card` com `border` sutil — sem glassmorphism excessivo
- **Sidebar:** Cor diferenciada para navegacao lateral do CRM

### Tipografia
- Max 2 familias (corpo + monospace para dados tecnicos)
- Headings: `tracking-tight` (letter-spacing apertado)
- Body: tracking normal
- Labels: `text-sm font-medium`
- Numeros tabulares: `tabular-nums` em tabelas, dashboards e dados financeiros
- Hierarquia via peso e tamanho, NAO variedade de cor

### Espacamento
- **Consistente** — seguir escala do Tailwind
- Sidebar: largura fixa com collapse em mobile
- Cards: padding 16-24px
- Conteudo principal: `max-w-screen-2xl` para aproveitar telas grandes
- Tabelas: padding compacto para densidade de dados

### Elementos Visuais
- **Borders sobre shadows** para separacao de elementos
- **Icones:** mesmo stroke width, mesmo tamanho, Lucide em tudo
- **Focus-visible rings** apenas para keyboard users
- **Status badges** com cores semanticas (sucesso=verde, alerta=amarelo, erro=vermelho, info=azul)
- **Avatares** para contatos e usuarios com fallback de iniciais

### Animacoes (Framer Motion)
```typescript
// IMPORTACAO CORRETA — sempre usar framer-motion
import { motion, AnimatePresence } from 'framer-motion';

// NUNCA usar:
// import { motion } from 'motion/react'; // ERRADO
```
- Entrada: `opacity 0→1 + translateY(8px→0)`, stagger 30ms entre items
- Transicoes de pagina: fade suave 150ms
- Transicoes: 150-200ms ease em cor/opacity
- **NUNCA animar** width, height, top, left, margin, padding
- **SEMPRE respeitar** `prefers-reduced-motion`

---

## 2. COMPONENTIZACAO

### Estrutura Obrigatoria
```
src/
  components/
    ui/              # shadcn/ui primitivos (Dialog, Button, Input, etc)
    shared/          # Reutilizaveis cross-feature
  features/          # Ou pages/ — agrupado por funcionalidade
    [feature]/
      components/    # Componentes da feature
      hooks/         # Hooks da feature
  hooks/             # Hooks globais
  utils/             # cn(), formatters, validators
  types/             # Types globais
  contexts/          # AuthContext, ThemeContext
  stores/            # Zustand stores
```

### Regras de Componente

**Props — SEMPRE interface explicita:**
```typescript
interface ContactCardProps {
  contact: Contact;
  onSelect: (id: string) => void;
  isSelected?: boolean;
}

export const ContactCard = ({ contact, onSelect, isSelected = false }: ContactCardProps) => {
  // ...
};
```

**Composicao sobre configuracao:**
```typescript
// BOM — composicao
<Card>
  <CardHeader>
    <CardTitle>Pipeline de Vendas</CardTitle>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>

// RUIM — configuracao
<Card title="Pipeline de Vendas" content={...} />
```

**Separacao logica/UI com TanStack Query + Zustand:**
```typescript
// Hook cuida da logica (TanStack Query para server state)
function useContacts(tenantId: string) {
  return useQuery({
    queryKey: ['contacts', tenantId],
    queryFn: () => fetchContacts(tenantId),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

// Zustand para state compartilhado entre componentes
const useConversationStore = create<ConversationState>((set) => ({
  selectedContactId: null,
  setSelectedContact: (id: string | null) => set({ selectedContactId: id }),
}));

// Componente cuida da UI
function ContactList({ tenantId }: { tenantId: string }) {
  const { data, isLoading, error } = useContacts(tenantId);

  if (isLoading) return <ContactListSkeleton />;
  if (error) return <ErrorState message="Erro ao carregar contatos" />;
  if (!data?.length) return <EmptyState message="Nenhum contato encontrado" />;

  return (
    <div className="space-y-2">
      {data.map((contact) => (
        <ContactCard key={contact.id} contact={contact} />
      ))}
    </div>
  );
}
```

### Variantes com CVA (class-variance-authority)
```typescript
import { cva, type VariantProps } from 'class-variance-authority';

const statusBadgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      status: {
        open: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
        lost: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      },
    },
    defaultVariants: { status: 'open' },
  }
);
```

---

## 3. ESTADOS OBRIGATORIOS NA UI

Todo componente que busca dados DEVE implementar TODOS estes estados:

### Loading State — Skeleton
```typescript
function ContactListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Error State
```typescript
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center" role="alert">
      <XCircle className="h-10 w-10 text-destructive mb-4" />
      <p className="text-muted-foreground mb-4">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
```

### Empty State
```typescript
function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground mb-4" />
      <p className="text-muted-foreground mb-4">{message}</p>
      {action}
    </div>
  );
}
```

### Botao com Loading
```typescript
<Button disabled={isLoading} onClick={handleSubmit}>
  {isLoading ? (
    <>
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      Salvando...
    </>
  ) : (
    'Salvar'
  )}
</Button>
```

### Toast de Feedback (Sonner)
```typescript
toast.success('Contato salvo com sucesso');
toast.error('Erro ao enviar mensagem', {
  description: 'Verifique a conexao com o WhatsApp.',
});
// NUNCA usar alert() ou window.confirm()
```

---

## 4. ACESSIBILIDADE (a11y) — OBRIGATORIA

### Semantica HTML
- `<button>` para acoes, `<a>` para navegacao — NUNCA `<div onClick>`
- `<nav>`, `<main>`, `<header>`, `<footer>`, `<section>` semanticos
- `<dialog>` para modais (Radix Dialog ja faz)
- `<form>` com `onSubmit`, nao `onClick` no botao

### ARIA
- `aria-label` em TODO botao com apenas icone
- `aria-describedby` linkando input a mensagem de erro
- `aria-live="polite"` para conteudo dinamico (novas mensagens, notificacoes)
- `aria-expanded`, `aria-controls` para widgets interativos
- `role="alert"` em mensagens de erro

### Teclado
- **Tab** move entre componentes; **setas** movem dentro
- Focus trapping em modais (Radix Dialog faz automaticamente)
- `focus-visible:ring-2 focus-visible:ring-ring` para indicadores de foco
- **Escape** fecha modais e dropdowns
- **Enter/Space** ativa botoes e links

### Contraste
- **4.5:1 minimo** para texto normal (WCAG AA)
- **3:1 minimo** para texto grande
- Nunca cor sozinha para informacao — combinar com icone ou texto

### Reduced Motion
```typescript
// Framer Motion — respeitar preferencia
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

<motion.div
  initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
/>
```

---

## 5. FORMULARIOS

### Pattern Obrigatorio (React Hook Form + Zod)
```typescript
const contactSchema = z.object({
  full_name: z.string().min(1, 'Nome obrigatorio').max(200),
  phone: z.string().regex(/^\d{10,13}$/, 'Telefone invalido'),
  email: z.string().email('Email invalido').optional().or(z.literal('')),
  cpf_cnpj: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

type ContactFormData = z.infer<typeof contactSchema>;

const form = useForm<ContactFormData>({
  resolver: zodResolver(contactSchema),
  defaultValues: { full_name: '', phone: '', email: '', tags: [] },
});

const onSubmit = async (data: ContactFormData) => {
  try {
    await createContact(data);
    toast.success('Contato criado com sucesso');
  } catch (err) {
    toast.error('Erro ao criar contato', { description: 'Tente novamente.' });
  }
};
```

### Regras de Formulario
- Validacao **on submit** inicialmente, **on change** apos primeiro submit
- Erros abaixo do input, nao em alert/toast
- Disable submit + spinner durante envio
- Disable todos inputs durante submissao (previne double-submit)
- Mascara de input onde aplicavel (CEP, telefone, CPF/CNPJ)
- Auto-focus no primeiro campo ao abrir

---

## 6. RESPONSIVE (Desktop-First)

### Breakpoints
```
xl: (>= 1280px) — Desktop wide (referencia principal)
lg: (>= 1024px) — Desktop
md: (>= 768px)  — Tablet
sm: (>= 640px)  — Mobile large
Base (< 640px)  — Mobile
```

### Patterns CRM
```typescript
// Layout principal: sidebar + conteudo
<div className="flex h-screen">
  <aside className="hidden lg:flex w-64 flex-col border-r">
    {/* Sidebar navigation */}
  </aside>
  <main className="flex-1 overflow-auto">
    {/* Conteudo principal */}
  </main>
</div>

// Tabela responsiva
<div className="overflow-x-auto">
  <Table>...</Table>
</div>

// Grid de cards dashboard
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

// Conversas: lista + chat side by side
<div className="flex h-full">
  <div className="w-80 border-r hidden md:block">
    {/* Lista de conversas */}
  </div>
  <div className="flex-1">
    {/* Chat ativo */}
  </div>
</div>
```

---

## 7. PERFORMANCE

### Obrigatorio
- TanStack Query com `staleTime` configurado (NUNCA default 0 para dados que nao mudam a cada segundo)
- Imagens com `width` e `height` explicitos
- Imagens below-fold com `loading="lazy"`
- Listas longas: considerar virtualizacao (react-virtual) para > 100 items
- Debounce em campos de busca (300ms)

### Proibido
- `import moment` (300KB+) — usar `date-fns`
- `React.memo()` em tudo — apenas quando medido como necessario
- `transition: all` — listar propriedades especificas
- Objetos/arrays inline no JSX (`style={{ margin: 10 }}`)
- Re-render de lista inteira quando um item muda (keys estaveis + memoizacao seletiva)

### God Components — NUNCA MAIS
- **Conversations.tsx tem 310KB** — isso eh inaceitavel
- **Reports.tsx tem 76KB** — tambem excessivo
- Todo componente novo DEVE ter < 150 linhas
- Se precisar editar um God Component, extrair a parte relevante primeiro

---

## 8. PERMISSOES E AUTH

### ProtectedRoute
```typescript
// Rota protegida basica
<ProtectedRoute>
  <DashboardPage />
</ProtectedRoute>

// Rota com permissao especifica
<ProtectedRoute requiredPermission="contacts.view">
  <ContactsPage />
</ProtectedRoute>
```

### PermissionGate (condicional na UI)
```typescript
// Mostrar botao apenas se usuario tem permissao
<PermissionGate permission="deals.create">
  <Button onClick={handleNewDeal}>Novo Negocio</Button>
</PermissionGate>
```

### SuperAdminGuard
```typescript
// Area restrita a super admin
<SuperAdminGuard>
  <AdminSettingsPage />
</SuperAdminGuard>
```

---

## 9. ANTI-PATTERNS PROIBIDOS

| Anti-Pattern | Correto |
|---|---|
| Prop drilling (3+ niveis) | Context, composicao, ou Zustand |
| Index como key em `.map()` | ID unico e estavel |
| `<div onClick>` | `<button>` semantico |
| Componente > 150 linhas | Quebrar em sub-componentes |
| State derivavel armazenado | Computar, nao armazenar |
| catch vazio | Sempre logar ou re-throw |
| console.log em producao | Remover antes de entregar |
| z-index arbitrario (999) | Escala definida (dropdown=50, modal=300, toast=500) |
| Layout shift (CLS) | Dimensoes explicitas, skeletons |
| Componente dentro de componente | Sempre no escopo do modulo |
| `import from 'motion/react'` | `import from 'framer-motion'` |
| Lazy loading de rotas | Nao usar (projeto nao adota) |

---

## FORMATO DE ENTREGA OBRIGATORIO

Toda entrega desta skill DEVE conter:

```
## Componente: [NomeDoComponente]

### Justificativa de Design
- **Layout:** [porque esta estrutura foi escolhida — desktop CRM, sidebar, tabelas, etc]
- **Visual:** [porque estas cores/espacamentos — referencia ao design system]
- **Interacao:** [hover states, animacoes, feedback — porque essas escolhas]
- **Acessibilidade:** [ARIA roles, keyboard nav, contraste — o que foi garantido]

### Codigo
[codigo completo do componente]

### Estados Tratados
- [x] Loading (skeleton com dimensoes exatas)
- [x] Error (mensagem + retry)
- [x] Empty (mensagem + acao)
- [x] Success (dados renderizados)

### Checklist
- [x] Desktop-first com responsividade
- [x] Props tipadas via interface
- [x] < 150 linhas
- [x] Logica separada em hook (se aplicavel)
- [x] Acessivel (ARIA, keyboard, contraste)
- [x] Sem `any`
- [x] Usando shadcn/ui + Lucide
- [x] Reduced motion respeitado
- [x] Permissoes verificadas (PermissionGate se aplicavel)
- [x] Framer Motion importado de 'framer-motion'
```
