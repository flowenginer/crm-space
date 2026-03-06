

## Diagnóstico: Por que "Fechados" está errado no Redirect

### Problemas encontrados

1. **Contatos duplicados inflam os números**: O `redirect_logs` tem múltiplas entradas para o mesmo contato (ex: LUAN ATAIDE aparece 2x no AGRO, A.H.MORAES aparece 2x no ENSOL). O código conta cada log entry como +1 lead e +1 fechado, em vez de contar **contatos únicos**.

2. **Critério de conversão incompleto**: O `isFechadoStatus` só verifica se o status contém "fechado" (07 - Pedido Fechado), mas deveria incluir os status **07 a 10** (07 - Pedido Fechado, 08 - Em andamento, 09 - Cobrança, 10 - Aguardando envio), além de verificar o campo `custom_fields.conversoes`.

### Solução

**Arquivo**: `src/hooks/useRedirectDashboardEnhanced.ts`

1. **Deduplicar contatos por UTM**: Usar um `Set<contact_id>` para cada chave UTM, contando apenas contatos únicos (como já faz com `visitors` para visitas)

2. **Expandir critério de conversão**: Substituir `isFechadoStatus` por uma função que verifica:
   - Status que começa com "07", "08", "09" ou "10" (Pedido Fechado até Aguardando envio)
   - Ou `custom_fields.conversoes` preenchido

3. **Buscar `custom_fields` no join**: Alterar o select do `redirect_logs` para incluir `contact:contacts(id, lead_status, custom_fields)` para poder verificar o campo de conversões

### Resultado esperado
Os números de "Fechados" refletirão contatos únicos realmente convertidos, sem duplicatas e com critério alinhado ao resto do sistema (status 07-10 + campo conversões).

