
# Melhoria da Visualização Mobile - Campo de Mensagem

## Situação Atual

No mobile, a área de input de mensagem tem 4 ícones de atalho (Anexo, Calendário, Nota Interna, Templates) alinhados horizontalmente **antes** do campo de texto. Isso faz com que o campo de texto fique estreito e curto (cerca de 40% da largura da tela), dificultando a digitação.

## Propostas de Solução

Aqui estão 3 ideias para melhorar essa experiência:

---

### **Opção 1: Menu "+" Colapsável (Recomendada)**

Agrupar todos os atalhos dentro de um único botão "+" que abre um menu pop-up.

**Layout Mobile:**
```text
┌──────────────────────────────────────────────┐
│ [+]  [      Campo de texto grande       ] [▶] │
└──────────────────────────────────────────────┘
         ↓ Ao clicar no "+"
┌──────────────────────────────────────────────┐
│  📎 Anexar    📅 Agendar    📝 Nota    ✨ IA  │
└──────────────────────────────────────────────┘
```

**Vantagens:**
- Campo de texto ocupa quase toda a largura da tela
- Todos os atalhos continuam acessíveis com 1 toque extra
- Interface limpa e moderna (padrão usado no WhatsApp/Telegram)

---

### **Opção 2: Atalhos Acima do Campo**

Mover os atalhos para uma linha separada acima do campo de texto.

**Layout Mobile:**
```text
┌──────────────────────────────────────────────┐
│  📎      📅      📝      ✨                   │
├──────────────────────────────────────────────┤
│ [      Campo de texto largo          ] [▶]   │
└──────────────────────────────────────────────┘
```

**Vantagens:**
- Atalhos sempre visíveis sem clique extra
- Campo de texto mais largo

**Desvantagens:**
- Ocupa mais espaço vertical (reduz área de mensagens)

---

### **Opção 3: Ocultar Atalhos Menos Usados no Mobile**

Manter apenas 1-2 ícones essenciais (como Anexo e Templates) e esconder os demais no mobile.

**Layout Mobile:**
```text
┌──────────────────────────────────────────────┐
│ [📎] [✨]  [   Campo de texto maior   ] [▶]  │
└──────────────────────────────────────────────┘
```

**Vantagens:**
- Implementação simples (apenas adicionar `hidden md:flex`)
- Campo de texto maior

**Desvantagens:**
- Funcionalidades de Calendário e Nota não acessíveis no mobile

---

## Recomendação

Sugiro a **Opção 1 (Menu "+" Colapsável)** por ser o padrão mais usado em apps de mensagem profissionais. Ela mantém todas as funcionalidades acessíveis enquanto maximiza o espaço para digitação.

---

## Detalhes Técnicos da Implementação (Opção 1)

### Alterações no arquivo `src/pages/Conversations.tsx`:

1. **Criar estado para controle do menu**:
   - Adicionar `const [showMobileActions, setShowMobileActions] = useState(false)`

2. **Estrutura condicional para mobile/desktop**:
   - No mobile (`isMobile === true`): Mostrar apenas um botão "+" que abre um Popover/Sheet com os atalhos
   - No desktop: Manter layout atual sem mudanças

3. **Componente do botão "+"**:
   ```tsx
   {isMobile && (
     <Popover open={showMobileActions} onOpenChange={setShowMobileActions}>
       <PopoverTrigger asChild>
         <button className="p-2 hover:bg-muted rounded-lg">
           <Plus size={22} className="text-muted-foreground" />
         </button>
       </PopoverTrigger>
       <PopoverContent side="top" className="w-auto p-2">
         <div className="flex gap-4">
           {/* Ícones de Anexo, Calendário, Nota, Templates */}
         </div>
       </PopoverContent>
     </Popover>
   )}
   ```

4. **Ocultar ícones individuais no mobile**:
   - Adicionar `hidden md:flex` aos botões de Anexo, Calendário, Nota e Templates
   - Eles só aparecem no desktop, enquanto o "+" aparece apenas no mobile

### Resultado Final

- **Mobile**: Um botão "+" + Campo de texto largo + Botão enviar
- **Desktop**: Layout permanece inalterado (todos os ícones visíveis)
