# 01 - Análise das 50 Conversas Reais (VENDAS IA)

**Data da análise:** 05/03/2026
**Período analisado:** 04-05 de março de 2026
**Total de conversas:** 50
**Total de mensagens:** ~2.200+
**Departamento:** VENDAS IA (Space Sports)
**Bot:** Mariah v3.15

---

## Resumo Executivo

Das 50 conversas analisadas, **ZERO resultaram em venda concluída**. O funil tem um gargalo crítico na etapa de seleção de modelo do catálogo, onde 70-80% dos leads abandonam. A IA funciona bem nas etapas técnicas (mockup, frete, pagamento), mas falha em engajamento comercial e flexibilidade.

---

## Funil de Conversão Consolidado

| Etapa | Quantidade | % do Total |
|---|---|---|
| Qualificação (área, qtd, modelo) | 50/50 | 100% |
| Catálogo enviado | 48/50 | 96% |
| Modelo número escolhido | 22/50 | 44% |
| Logo/Personalização | 19/50 | 38% |
| Mockup gerado | 14/50 | 28% |
| Mockup aprovado | 8/50 | 16% |
| Orçamento/Frete enviado | 8/50 | 16% |
| Dados pagamento coletados | 3/50 | 6% |
| Link pagamento enviado | 3/50 | 6% |
| **Pagamento confirmado** | **0/50** | **0%** |

### O Gargalo Principal: Catálogo → Escolha de Modelo

**56% dos leads abandonam na etapa do catálogo.** O cliente recebe um link externo para o site, precisa abrir no navegador, navegar pelos produtos, identificar um número e voltar ao WhatsApp para informar. Isso é fricção demais para o contexto de WhatsApp.

---

## Conversas que Chegaram Mais Longe

### Conversa com SdS Construtora (Batch 2)
- **Etapa:** Link de pagamento enviado (R$ 725,02)
- **Problema:** Links SVG do mockup não abriram no celular do cliente
- **Status:** Aguardando comprovante

### Conversa com Ms Serviços (Batch 2)
- **Etapa:** Link de pagamento enviado (R$ 510,51 via SEDEX)
- **Problema:** Cliente ficou em silêncio após pedido de CPF/dados pessoais
- **Status:** Abandonou na coleta de dados

### Conversa com Almir Quintero (Batch 3)
- **Etapa:** Link de pagamento enviado (R$ 318,96)
- **Problema:** Bot ESQUECEU a etapa de logo e pulou direto para pagamento
- **Cliente pegou o erro:** "Mais e a logo?"
- **Status:** Abandonou após acúmulo de erros

### Conversa com Construção "R" (Batch 4)
- **Etapa:** Link de pagamento enviado (R$ 125,13)
- **Problema:** Cliente queria chave PIX direto, bot só oferecia link Mercado Pago. Depois, bot esqueceu de coletar endereço antes do pagamento.
- **Status:** Abandonou

---

## Categorização dos Abandonos

### Por Motivo de Abandono (das 50 conversas):

| Motivo | Qtd | % |
|---|---|---|
| Não escolheu modelo do catálogo (silêncio) | 28 | 56% |
| Preço alto / sem flexibilidade | 4 | 8% |
| Queria replicar design próprio (bot insistiu no catálogo) | 4 | 8% |
| Erro técnico (tool leak, SVG não abre, mockup errado) | 4 | 8% |
| Pediu atendente humano e foi negado | 3 | 6% |
| Frete caro demais | 2 | 4% |
| Queria produto de concorrente | 1 | 2% |
| Voltará depois (lead quente, não perdido) | 4 | 8% |

---

## Padrões de Comportamento dos Clientes

### 1. Pergunta Preço ANTES de Tudo (30%+ dos leads)
Clientes frequentemente pedem preço na primeira ou segunda mensagem. Bot deflecta 100% das vezes com "O orçamento completo eu monto ao final da personalização!". Isso frustra e causa abandono.

**Exemplos reais:**
- "Qual o valor pra customizar uma camisa?" → Deflectado
- "Sai por quanto cada?" → Deflectado
- "Quais tamanhos e valores?" → Deflectado
- "Quero saber o valor" (4x na mesma conversa) → Deflectado todas as vezes

### 2. Envia Áudio em vez de Texto (15-20% dos leads)
Clientes brasileiros usam muito áudio no WhatsApp. O bot não processa áudios e ignora o conteúdo, repetindo a pergunta anterior.

### 3. Quer Replicar Design Existente (8-10%)
Clientes que já têm uma camisa ou design e querem replicar. O bot não suporta isso e insiste no catálogo.

### 4. Pedido Misto (2+ modelos diferentes)
Clientes pedem "2 manga curta + 2 manga longa". O bot frequentemente erra a contagem ou ignora um dos modelos.

### 5. Pede Atendente Humano Quando Frustrado
Quando a conversa emperra, clientes pedem humano. Bot nega dizendo que pedidos <10 são só via bot. Isso gera frustração extrema.

---

## Problemas Técnicos Encontrados

### CRÍTICO: Tool Call Vazada para o Cliente
Em pelo menos 2 conversas, o bot enviou a chamada raw da tool como mensagem visível:
```
Calling melhor_envio with input: {"id":"f49b1778...","parameters0_Value":"29890000",...}
```
Cliente vê JSON/código técnico. Inaceitável.

### CRÍTICO: Links SVG Não Abrem no Celular
Mockups são gerados como SVG. Nem todos os celulares abrem SVG nativamente. Cliente relatou: "To entrando no link mas nao abre".

### ALTO: Mensagens Duplicadas
- Mariah se apresenta 2x na mesma conversa
- Menu de modelos enviado 2-3x seguidas
- Catálogo reenviado após restart por mensagem automática

### ALTO: Mensagens em Rajada (Flooding)
Bot envia 3-5 mensagens em 10-30 segundos. No WhatsApp, isso causa sobrecarga visual e sensação de spam.

### MÉDIO: Restart por Mensagem Automática do Site
Quando cliente clica no anúncio novamente, envia "Olá! Vim do site..." e o bot REINICIA todo o fluxo, perdendo dados já coletados.

### MÉDIO: Bot Envia Follow-up DEPOIS de Encerrar
Bot diz "vou encerrar nosso contato por aqui" e depois envia 2-3 mensagens de follow-up. Contraditório.

---

## O Que Funciona Bem

1. **Detecção de segmento** - Mapeia "fazenda" → agro, "ar condicionado" → refrigeração, "proteção de cabeça" → capuz
2. **Tolerância a typos** - Entende "siper" (zíper), "Contrução" (construção), "Maga logo" (manga longa)
3. **Geração de mockup** - Quando funciona, impressiona clientes ("Ficou muito bom!")
4. **Cálculo de frete** - Integração Melhor Envio funciona corretamente
5. **Geração de link de pagamento** - Mercado Pago integrado e funcional
6. **Tom da Mariah** - Simpática, emojis moderados, frases curtas
7. **Tratamento de logo recebida** - Identifica corretamente imagens como logos
8. **Personalização sequencial** - WhatsApp, Instagram, slogan coletados com paciência
