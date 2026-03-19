# 05 - UX Conversacional e Fluxo de Chat

**Especialista: UX Designer de Chatbots**

---

## Diagnóstico de UX

### Mapa de Calor da Jornada do Cliente

```
😊 POSITIVO    😐 NEUTRO    😡 NEGATIVO    💀 ABANDONO

[😊] Saudação → Mariah é simpática, tom OK
[😊] Área de atuação → Funciona bem, bom mapeamento
[😊] Quantidade → Direto e simples
[😐] Site ou WhatsApp → Desnecessário (99% escolhe WA)
[😐] Tipo de manga → OK mas poderia vir com imagens
[😡] Link do catálogo → GRANDE FRICÇÃO - sair do WA
[💀] Escolha de número → 56% ABANDONA AQUI
[😊] Tem logo? → Pergunta simples e clara
[😊] Envio de logo → Funciona bem
[😐] Posição da logo → Muitas opções sem visual
[😐] Tamanho da logo → Texto sem referência visual
[😐] WhatsApp/Instagram/Site/Slogan → 4 perguntas separadas
[😊] Geração de mockup → Impressiona quando funciona
[😡] SVG não abre → PROBLEMA TÉCNICO
[😡] Disclaimer ANTES do mockup → Mata expectativa
[😐] Plus Size → OK
[😊] CEP → Simples
[😊] Cálculo de frete → Funciona bem
[😡] Orçamento sem preparação prévia → Choque de preço
[😡] Coleta CPF/email de uma vez → Gera desconfiança
[😐] Link pagamento → Funciona mas cliente quer PIX direto
[😡] Endereço DEPOIS do pagamento → Cliente questiona
```

---

## Os 10 Problemas de UX Mais Críticos

### 1. Saída do WhatsApp para Catálogo

**Gravidade:** CRÍTICA (causa 56% dos abandonos)

**Problema:** Enviar link externo para escolher modelo força o cliente a sair do WhatsApp, abrir navegador, carregar site, navegar, voltar.

**Solução:**
- Enviar carrossel de imagens direto no WhatsApp (3-5 top sellers)
- Usar WhatsApp Business API com catálogo nativo se disponível
- No mínimo, enviar as 5 imagens mais populares do segmento como mensagens separadas com o número sobreposto

**Impacto estimado:** +25-35% de progressão nesta etapa

### 2. Mensagens em Rajada (Flooding)

**Gravidade:** ALTA

**Problema:** Bot envia 3-5 mensagens em 10-30 segundos. No WhatsApp, isso:
- Causa múltiplas notificações
- Dificulta leitura
- Sente-se como spam
- Pode fazer o cliente silenciar a conversa

**Dados das conversas:**
- Conversa com Jobyson: 5 mensagens em 14 segundos
- Conversa com Pesca: 4 mensagens em 30 segundos
- Conversa com Construção: 3 mensagens em 10 segundos

**Solução:**
- Máximo 2 mensagens por turno
- Delay mínimo de 3 segundos entre mensagens
- Agrupar informações relacionadas em 1 mensagem

### 3. Pergunta "Site ou WhatsApp?" é Inútil

**Gravidade:** MÉDIA-ALTA

**Problema:** 99% dos clientes escolhem WhatsApp (afinal, já estão no WhatsApp). A pergunta:
- Adiciona 2 mensagens desnecessárias ao fluxo
- Confunde clientes que não entendem a pergunta
- Alguns respondem "site" achando que é onde verão os modelos

**Solução:** Eliminar. Assumir WhatsApp. Se o cliente quiser o site, ele mesmo pedirá.

### 4. Dupla Identidade (Bot Genérico → Mariah)

**Gravidade:** MÉDIA-ALTA

**Problema:** O fluxo atual tem 2 personas:
1. Bot de qualificação (sem nome) que pergunta área, quantidade, manga
2. "Mariah" que faz a venda

A transição inclui "Estou te encaminhando para a equipe de vendas" seguido de "Oi! Sou a Mariah". Isso:
- Soa como transferência para outra pessoa
- Cria expectativa de humano
- Faz o cliente repetir contexto
- Em alguns casos as mensagens chegam na ordem errada

**Solução:** Uma persona única (Mariah) desde o início. Sem transição artificial.

### 5. Formato das Opções (Texto vs. Botões)

**Gravidade:** MÉDIA

**Problema:** Opções são apresentadas como texto:
```
👉 Frente
👉 Costas
👉 Frente e costas
👉 Sem logo
```

Cliente precisa DIGITAR a resposta. Erros comuns: "Frente e cost", "As 2", "Nos dois lados".

**Solução:** Usar Quick Reply Buttons da API do WhatsApp Business:
- Máximo 3 botões por mensagem
- Cliente toca em vez de digitar
- Elimina erros de digitação
- 45% mais rápido que digitação manual (fonte: Cue/Infobip)

### 6. Sem Feedback Visual nas Escolhas de Logo

**Gravidade:** MÉDIA

**Problema:** Cliente escolhe "pequena no peito esquerdo" sem ver como fica. Só vê o resultado no mockup final. Se não gostar, precisa recomeçar.

**Solução:**
- Enviar uma imagem de referência mostrando as posições ANTES de perguntar
- Exemplo: silhueta de camisa com marcações "A = peito esq pequena", "B = centro média"

### 7. Disclaimer do Mockup ANTES do Mockup

**Gravidade:** MÉDIA

**Problema:** O disclaimer "⚠️ Esse mockup é apenas ilustrativo" aparece ANTES da imagem. Isso:
- Cria expectativa negativa antes de ver
- Diminui o impacto emocional do mockup
- Pode fazer o cliente nem abrir a imagem

**Solução:** Mostrar o mockup primeiro, disclaimer depois:
```
Olha como ficou! 🤩
[imagem frente]
[imagem costas]

Gostou? 😊

📌 Esse é um preview — o designer faz a versão final
e te envia pra aprovação antes de produzir!
```

### 8. Endereço Coletado DEPOIS do Pagamento

**Gravidade:** MÉDIA

**Problema:** Clientes estranham pagar antes de informar endereço:
- "Mas vcs nem tem o meu endereço para mandar a encomenda"
- Gera desconfiança sobre legitimidade

**Solução:** Coletar CEP + cidade/estado ANTES do pagamento (já coleta CEP pro frete). Complementar endereço depois.

### 9. Follow-up Após Encerramento

**Gravidade:** BAIXA-MÉDIA

**Problema:** Bot diz "vou encerrar" e depois envia mais 2-3 mensagens. Contraditório e irritante.

**Solução:** 
- Nunca dizer "vou encerrar"
- Último follow-up: "Quando quiser retomar, é só me chamar! 😊" e parar

### 10. Áudio Não Processado

**Gravidade:** ALTA (contexto brasileiro)

**Problema:** Brasileiros usam MUITO áudio no WhatsApp. Bot ignora áudios e repete a pergunta anterior. Isso:
- Frustra clientes que preferem falar
- Ignora informações valiosas
- Faz o bot parecer burro

**Dados:** 15-20% das conversas tiveram áudios do cliente ignorados.

**Solução:**
- Integrar transcrição de áudio (Whisper API ou similar)
- Se não possível, ao menos reconhecer: "Recebi seu áudio! Infelizmente ainda não consigo ouvir mensagens de voz. Pode me escrever? 😊"

---

## Fluxo Otimizado Proposto

### Jornada Atual: 10 etapas, ~30-50 mensagens
### Jornada Proposta: 7 etapas, ~18-25 mensagens

```
┌─────────────────────────────────────────┐
│ ETAPA 1: BOAS-VINDAS + PREVIEW (2 msg)  │
│ • Saudação com nome + social proof       │
│ • 3-5 imagens top sellers do segmento    │
│ • "Qual desses te chamou atenção?"       │
├─────────────────────────────────────────┤
│ ETAPA 2: PERSONALIZAÇÃO (3-4 msg)       │
│ • "Tem logo? Manda aqui!"               │
│ • Posição (com imagem referência)        │
│ • Extras agrupados (WA/IG/site/slogan)  │
├─────────────────────────────────────────┤
│ ETAPA 3: MOCKUP + PREÇO (2 msg)         │
│ • Mockup (PNG) + preço estimado juntos   │
│ • "Aprova? Vou calcular o frete!"       │
├─────────────────────────────────────────┤
│ ETAPA 4: FRETE + ORÇAMENTO (2 msg)      │
│ • CEP → Cálculo → Orçamento completo    │
│ • Plus Size se necessário               │
├─────────────────────────────────────────┤
│ ETAPA 5: PAGAMENTO (3-4 msg)            │
│ • Dados progressivos (1 por vez)        │
│ • Link Mercado Pago (PIX + cartão)      │
├─────────────────────────────────────────┤
│ ETAPA 6: ENDEREÇO + TAMANHOS (2 msg)    │
│ • Endereço completo                     │
│ • Tamanhos de cada camisa               │
├─────────────────────────────────────────┤
│ ETAPA 7: CONFIRMAÇÃO (2 msg)            │
│ • Criar pedido + número SS-XXXXXX       │
│ • Transferir para pós-venda             │
└─────────────────────────────────────────┘
```

### Redução:
- De 10 etapas → 7 etapas
- De ~50 mensagens → ~22 mensagens
- De ~40 min → ~15-20 min
- Pergunta "site ou WA" eliminada
- Handoff artificial eliminado
- Extras agrupados em 1 pergunta
