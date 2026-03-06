# 02 - Diagnóstico do Funil de Vendas

**Especialista: Analista de Dados e Funil**

---

## Visão Geral do Funil

```
[100%] Qualificação (SDR → Mariah)
  │
  ▼
[96%] Catálogo Enviado
  │
  ▼ ← ⚠️ GARGALO PRINCIPAL: -52% de perda
[44%] Modelo Escolhido
  │
  ▼
[38%] Personalização/Logo
  │
  ▼
[28%] Mockup Gerado
  │
  ▼ ← ⚠️ GARGALO SECUNDÁRIO: -12% (rejeição de mockup)
[16%] Mockup Aprovado → Orçamento
  │
  ▼
[6%] Dados Pagamento Coletados
  │
  ▼
[6%] Link Pagamento Enviado
  │
  ▼
[0%] PAGAMENTO CONFIRMADO ← ❌ ZERO CONVERSÕES
```

---

## Análise por Gargalo

### GARGALO 1: Catálogo → Escolha de Modelo (52% de perda)

**O que acontece:** O bot envia um link para o site (`spacesportspersonalizados.com.br/produtos?categoria=X`) e pede que o cliente escolha um número de modelo. O cliente precisa:
1. Clicar no link
2. Sair do WhatsApp
3. Carregar o site
4. Navegar pelos produtos
5. Identificar o número do modelo
6. Voltar ao WhatsApp
7. Digitar o número

**Por que falha:**
- 7 passos de fricção para uma ação que deveria ser 1 clique
- Usuários de WhatsApp esperam experiência in-app
- Muitos clientes estão no celular com internet ruim
- O catálogo mostra MUITOS modelos - paralisia de escolha
- Não há contexto de preço nos modelos para ajudar a decisão

**Evidência das conversas:**
- "Onde vejo os numeros?" - cliente não entendeu o sistema
- "So encontrei manga curta" - cliente não achou o produto no site
- "Nao tem como fazer uma arte so pra ter ideia?" - queria preview antes
- "Ok ja olho" - procrastinou e nunca voltou
- "Ainda estou escolhendo" - ficou perdido no site

**Recomendação:** Enviar 3-5 imagens dos modelos MAIS POPULARES direto no WhatsApp com números sobrepostos. Reduzir escolha de 15+ opções para 5 curadas.

### GARGALO 2: Mockup Rejeitado (50% de rejeição)

**O que acontece:** Dos 14 mockups gerados, apenas 8 foram aprovados. Quando rejeitado, o bot só oferece "escolher outro modelo" - não consegue fazer ajustes pontuais.

**Por que falha:**
- Bot não suporta revisões incrementais ("aumenta a logo", "muda a posição")
- Links SVG nem sempre abrem no celular
- Mockup com fundo escuro não mostra bem a arte
- Cliente quer ajustar detalhes, não recomeçar

**Evidência:**
- "Quero alterar tamanho e local do slogam" → Bot ofereceu escolher OUTRO modelo
- "To entrando no link mas nao abre" → SVG incompatível
- "Esse a arte nao ta aparecendo" → Logo invisível em fundo escuro
- "Eu preciso de uma camisa identica com aquela que eu mandei" → Bot entrou em loop

**Recomendação:** Permitir regeneração com parâmetros ajustados. Converter SVG para PNG/JPG antes de enviar.

### GARGALO 3: Preço → Pagamento (62% de perda)

**O que acontece:** Dos 8 orçamentos enviados, apenas 3 coletaram dados de pagamento. Motivos:
- Frete caro (até 73% do valor do produto)
- Choque de preço sem preparação prévia
- Cliente queria PIX direto, não link
- Coleta de CPF/email gera desconfiança

**Recomendação:** Ancorar preço antes do orçamento formal. Oferecer frete grátis acima de X unidades. Simplificar coleta de dados.

---

## Métricas de Performance do Bot

### Tempo Médio por Etapa
| Etapa | Tempo Médio |
|---|---|
| Qualificação completa | 5-8 min |
| Envio de catálogo | 1-2 min após qualificação |
| Espera por modelo (quando escolhe) | 15-45 min |
| Personalização completa | 20-40 min |
| Mockup geração | 30-60 seg |
| Orçamento completo | 2-5 min |

### Taxa de Resposta por Mensagem do Bot
- Perguntas fechadas ("Frente ou costas?"): ~85% resposta
- Link de catálogo: ~40% retorno
- Pedido de dados pessoais (CPF): ~30% resposta
- Follow-up após silêncio: ~15% retorno

### Mensagens por Conversa
- Média: 30 mensagens
- Conversas que chegaram a pagamento: 60-90 mensagens
- Conversas que abandonaram no catálogo: 12-18 mensagens

---

## Segmentação dos Leads

### Por Segmento/Área
| Segmento | Qtd Leads | Chegaram ao Mockup | % |
|---|---|---|---|
| Construção Civil | 18 | 6 | 33% |
| Agro | 10 | 3 | 30% |
| Pesca | 3 | 1 | 33% |
| Refrigeração/AC | 3 | 2 | 67% |
| Telecom | 2 | 0 | 0% |
| Eletricista | 3 | 0 | 0% |
| Outros (segurança, saúde, etc.) | 11 | 2 | 18% |

**Insight:** Refrigeração/AC teve a maior taxa de engajamento. Construção Civil é o maior volume mas com conversão média. Eletricistas e Telecom abandonam cedo.

### Por Quantidade Solicitada
| Quantidade | Qtd Leads | Chegaram ao Orçamento | % |
|---|---|---|---|
| 1-2 unidades | 5 | 2 | 40% |
| 3-5 unidades | 30 | 4 | 13% |
| 6-9 unidades | 15 | 2 | 13% |

**Insight:** Pedidos de 1-2 unidades têm melhor taxa de progressão (clientes mais decididos), mas frete proporcionalmente mais caro mata a venda.

---

## Pontos de Perda Irrecuperáveis

Estes são os momentos onde o lead é DEFINITIVAMENTE perdido:

1. **"Achei em outra empresa por R$59,90"** - Sem contra-oferta, cliente vai embora
2. **"Quero falar com um atendente" (negado 3x)** - Frustração irreversível
3. **Tool call vazada** - Perde credibilidade instantaneamente
4. **Frete > 50% do valor do produto** - Matematicamente inviável para 1-2 peças
5. **Bot reinicia conversa perdendo todos os dados** - Cliente desiste

---

## Oportunidades Imediatas (Quick Wins)

1. **Informar faixa de preço antes do catálogo** (R$49,90 a R$119,90 dependendo do modelo)
2. **Enviar 3-5 imagens dos top sellers IN-CHAT** em vez de link externo
3. **Converter SVG para PNG** antes de enviar mockup
4. **Corrigir tool leak** - bug que expõe JSON ao cliente
5. **Não reiniciar fluxo** quando recebe mensagem automática do site
6. **Limitar a 2 mensagens por vez** (anti-flooding)
7. **Permitir escalação para humano** após 3ª solicitação do cliente
