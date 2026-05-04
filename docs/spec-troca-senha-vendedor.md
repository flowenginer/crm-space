# Spec — Troca de Senha pelo Vendedor

**Data:** 2026-05-04
**Contexto:** CRM Space (`flowenginer/crm-space`) — hoje as senhas são definidas pelo admin (Ricardo Grion) e compartilhadas. Precisamos dar autonomia pra cada vendedor mudar a própria senha.

---

## Escopo

Adicionar funcionalidade para qualquer usuário autenticado trocar a própria senha através de uma página "Minha Conta".

**Fora de escopo (decididos por agora):**
- Reset por email ("Esqueci minha senha") — não implementar agora.
- Forçar troca no primeiro login — não implementar agora.
- Painel admin com lista/auditoria de senhas — **NUNCA**: senha não pode ser visível a terceiros (Supabase Auth armazena hash bcrypt; expor senha viola LGPD e privacidade).
- Impersonate (admin acessar como vendedor) — não implementar agora.

---

## Decisões já tomadas pelo usuário

| Decisão | Escolha |
|---|---|
| Pede senha atual antes de trocar? | **Não** — só nova senha + confirmar |
| Política de senha forte | **Mínimo 8 caracteres, com pelo menos: 1 letra maiúscula, 1 letra minúscula, 1 número, 1 símbolo** |
| Localização do acesso | "Minha Conta" — clicar no nome do usuário na sidebar abre a página |

⚠️ **Observação técnica sobre não pedir senha atual:** isso é uma escolha de UX simplificada do usuário. O risco é: se alguém deixar a aba aberta e sair do computador, qualquer pessoa pode trocar a senha sem precisar saber a atual. Aceito o trade-off pelo simplicity-first do usuário.

---

## Implementação

### 1. Rota e arquivo
- Rota: `/minha-conta`
- Componente: `src/pages/MinhaConta.tsx`
- Adicionar rota em `src/App.tsx` dentro do bloco autenticado, sem `permission` gate específico (qualquer user logado acessa).

### 2. Acesso na UI
- Em `src/components/layout/Sidebar.tsx` (linhas 650-661): tornar o bloco do nome do usuário clicável (`<Link to="/minha-conta">` ou `<button onClick={() => navigate('/minha-conta')}`). Adicionar cursor-pointer e hover state pra indicar interatividade.
- Não criar item separado no menu lateral (manter sidebar limpo).

### 3. UI da página
Layout:
- Cabeçalho: "Minha Conta"
- Card "Dados pessoais" (somente leitura): nome, email, role, departamento — apenas display, sem edição.
- Card "Trocar senha":
  - Input "Nova senha" (`type="password"`, com toggle de mostrar/ocultar via ícone Eye/EyeOff já existente em lucide-react).
  - Input "Confirmar nova senha" (`type="password"`, com toggle).
  - Indicador visual de força da senha — mostra em tempo real quais critérios já foram atendidos (✓ verde / ✗ cinza):
    - Mínimo 8 caracteres
    - Pelo menos 1 letra maiúscula
    - Pelo menos 1 letra minúscula
    - Pelo menos 1 número
    - Pelo menos 1 símbolo (caractere especial)
  - Botão "Salvar nova senha" (desabilitado enquanto critérios não atendidos OU senhas não conferirem).

### 4. Validação (frontend)
Schema Zod:
```ts
const passwordSchema = z.string()
  .min(8, 'Mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Precisa de pelo menos 1 letra maiúscula')
  .regex(/[a-z]/, 'Precisa de pelo menos 1 letra minúscula')
  .regex(/[0-9]/, 'Precisa de pelo menos 1 número')
  .regex(/[^A-Za-z0-9]/, 'Precisa de pelo menos 1 símbolo');

const formSchema = z.object({
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'As senhas não conferem',
  path: ['confirmPassword'],
});
```

### 5. Backend (Supabase Auth)
```ts
const { error } = await supabase.auth.updateUser({
  password: newPassword,
});
```
- Não precisa Edge Function. `updateUser` aceita o JWT do user logado.
- Em sucesso: toast "Senha alterada com sucesso" + redireciona pra `/dashboard` (ou rota inicial padrão) após 1.5s.
- Em erro: toast com mensagem da `error.message` traduzida pro PT-BR quando possível (ex: "New password should be different from the old password" → "A nova senha precisa ser diferente da atual").

### 6. Política de senha no Supabase
Verificar e ajustar a política mínima do Supabase Auth no dashboard:
- Mínimo 8 caracteres já validado no frontend; alinhar no painel `Auth > Policies > Password requirements` para o mesmo mínimo.
- Atenção: o Supabase só valida tamanho mínimo nativamente. As regras de complexidade (maiúscula/minúscula/número/símbolo) são responsabilidade do frontend (Zod) — está OK porque o frontend é o único caminho.

### 7. Estados da UI
- **Idle:** form vazio, botão desabilitado.
- **Digitando:** indicadores de força atualizam em tempo real.
- **Válido:** botão habilita.
- **Loading (após click):** botão mostra spinner, inputs desabilitados.
- **Sucesso:** toast verde + redireciona após 1.5s.
- **Erro:** toast vermelho com mensagem, mantém form preenchido, libera botão pra tentar de novo.

---

## Testes obrigatórios (regra do CLAUDE.md global — toda feature nasce com testes)

### Unit/integration (Vitest + React Testing Library)
1. **Validação Zod:**
   - Senha < 8 chars → reprovada com msg correta.
   - Sem maiúscula → reprovada.
   - Sem minúscula → reprovada.
   - Sem número → reprovada.
   - Sem símbolo → reprovada.
   - Senha "Senha@123" → aprovada.
   - newPassword ≠ confirmPassword → reprovada.

2. **Componente `MinhaConta`:**
   - Botão desabilitado quando senha não atende critérios.
   - Botão desabilitado quando senhas não conferem.
   - Botão habilitado quando tudo OK.
   - Indicadores de força refletem critérios atendidos em tempo real.
   - Toggle de mostrar/ocultar senha funciona.

3. **Fluxo de submit:**
   - Mock de `supabase.auth.updateUser` retornando sucesso → toast verde + chamada de navigate.
   - Mock retornando erro → toast vermelho + form não limpa.
   - Mock retornando erro de senha igual à atual → mensagem traduzida.

### Manual (após deploy)
- Testar com vendedor real (sugestão: criar user de teste ou pedir que Waleska teste).
- Confirmar que após troca, login com senha antiga falha e com nova funciona.

---

## Estimativa
- Implementação: ~3-4h
- Testes: ~1h
- QA manual: ~30min

---

## Checklist de implementação (para o Claude que pegar essa task pós /clear)

- [ ] Criar `src/pages/MinhaConta.tsx`
- [ ] Adicionar rota `/minha-conta` em `App.tsx`
- [ ] Tornar nome do usuário em `Sidebar.tsx` clicável → navega pra `/minha-conta`
- [ ] Schema Zod de validação de senha
- [ ] Indicadores visuais de critérios em tempo real
- [ ] Toggle mostrar/ocultar senha (Eye/EyeOff)
- [ ] Integração com `supabase.auth.updateUser({ password })`
- [ ] Estados: idle, digitando, loading, sucesso, erro
- [ ] Toast de sucesso/erro (sonner)
- [ ] Redirecionamento pós-sucesso (`useNavigate`)
- [ ] Tradução de mensagens de erro do Supabase pro PT-BR
- [ ] Testes Vitest (validação, componente, submit flow)
- [ ] Verificar no painel Supabase Auth que o mínimo de senha não é mais permissivo que 8 chars
- [ ] `npm run typecheck` passa
- [ ] `npm test` passa
- [ ] Atualizar `PROGRESS.md` ao final

---

## Pendências conhecidas (NÃO incluir nesta task)

Registradas pra tratar em outras sessões:
1. Bug `event.timestamp * 1000` em `instagram-webhook/index.ts:163` — UPDATEs explícitos do webhook IG falham silenciosamente (ano 58000 AD rejeitado pelo Postgres). Hoje sobrevive porque trigger AFTER INSERT messages cobre `last_message_at`.
2. Buracos no modelo de permissão de canal:
   - Auto-assign atribui conv pra usuário sem permissão no canal.
   - Lista (`usePaginatedConversations`) filtra corretamente por canal.
   - Busca (`search_contacts_by_assignment`) NÃO filtra por canal — vazamento.
3. 2 vendedores inativos (Brendo, Yasmin Sant'Anna) ficaram sem o canal IG. Se reativar, adicionar manualmente.
