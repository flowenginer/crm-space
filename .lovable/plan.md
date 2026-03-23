

# Diagnóstico: Leads da Bia e Nadia sumiram

## Causa Raiz

O problema é o **canal EMPREGA-MAIS duplicado** no banco de dados:

| Canal | ID | Status | Conversas |
|---|---|---|---|
| EMPREGA-MAIS (antigo) | `ed6f2c8c` | **disconnected** | **3.244** conversas (onde estão os leads da Bia e Nadia) |
| EMPREGA-MAIS (novo) | `0e2f9022` | **connected** | apenas 2 conversas |

A tabela `user_channels` controla quais canais cada usuário pode ver:

- **Beatriz**: só tem permissão no canal NOVO (`0e2f9022`) → só vê 2 conversas
- **Nadia**: tem permissão nos dois canais, MAS o filtro `allowedChannelIds` no frontend restringe a lista

Como as **3.244 conversas** (incluindo as 1.544 da Beatriz e 1.729 da Nadia) estão vinculadas ao canal ANTIGO (`ed6f2c8c`), e esse canal está marcado como "disconnected", elas simplesmente não aparecem.

## Solução

Migrar todas as conversas do canal antigo para o canal novo (que está connected), e depois desativar o antigo.

### Passo 1: Migrar conversas do canal antigo para o novo
```sql
UPDATE conversations 
SET channel_id = '0e2f9022-76b5-450e-a0a1-fe65f1f85104'
WHERE channel_id = 'ed6f2c8c-7339-4e92-8948-3f74baf280df';
```

### Passo 2: Migrar mensagens vinculadas ao canal antigo
```sql
UPDATE messages
SET channel_id = '0e2f9022-76b5-450e-a0a1-fe65f1f85104'
WHERE channel_id = 'ed6f2c8c-7339-4e92-8948-3f74baf280df';
```

### Passo 3: Limpar registros de user_channels do canal antigo
```sql
DELETE FROM user_channels 
WHERE channel_id = 'ed6f2c8c-7339-4e92-8948-3f74baf280df';
```

### Passo 4: Desativar/remover o canal duplicado antigo
```sql
DELETE FROM whatsapp_channels 
WHERE id = 'ed6f2c8c-7339-4e92-8948-3f74baf280df';
```

### Passo 5: Verificar se MASTER-LEADS também está duplicado
O MASTER-LEADS também tem 2 registros — precisa do mesmo tratamento se houver conversas no antigo.

### Resultado Esperado
- Todas as 3.244+ conversas passam a estar no canal connected
- Beatriz e Nadia voltam a ver seus leads normalmente
- Sem canal fantasma "disconnected" poluindo o sistema

