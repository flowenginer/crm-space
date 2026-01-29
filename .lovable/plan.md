
# Plano: Atribuição em Massa da Planilha Emprega Mais

## Situação Atual

Analisei a planilha com **1.629 contatos** e identifiquei os seguintes atendentes:

| Atendente na Planilha | Existe no CRM? | ID do Perfil |
|----------------------|----------------|--------------|
| Beatriz | SIM | `e7a9fd22-e3ff-40b9-b01c-93549db399d0` |
| Nadia | SIM | `dfccab80-7c0c-4bf2-827d-f09574793b14` |
| Rainy | SIM | `326e11b2-e643-48b6-8cda-661e642a126b` |
| Wallan | NÃO | - |

## Problema

O perfil **"Wallan"** não existe no sistema. Há aproximadamente ~170 contatos atribuídos a ele na planilha (linhas 1462-1630).

## Solução Proposta

### Passo 1: Criar o Perfil "Wallan"

Criar um novo usuário/perfil com o nome "Wallan" no sistema para que a importação funcione corretamente.

**Opções:**
- **Opção A**: Você cria o usuário "Wallan" manualmente nas configurações de usuários
- **Opção B**: Eu crio o perfil via código (preciso aprovar o plano para poder fazer alterações)

### Passo 2: Reimportar a Planilha pelo Sistema

Após criar o perfil Wallan, você pode reimportar a planilha usando o sistema de importação existente em:
**CRM → Importar Contatos**

Certifique-se de:
1. Marcar a opção **"Atualizar vendedor atribuído"**
2. Mapear a coluna **"Agente"** para o campo de vendedor
3. Selecionar o canal WhatsApp correto

### Alternativa: Atualização Direta via SQL

Se preferir uma solução mais rápida, posso criar um script SQL que você pode executar diretamente no Supabase Cloud View (Run SQL):

```sql
-- Atualizar contatos para Beatriz
UPDATE contacts 
SET assigned_to = 'e7a9fd22-e3ff-40b9-b01c-93549db399d0'
WHERE phone IN ('5521974188411', '5521971543343', ...);

-- Atualizar contatos para Nadia
UPDATE contacts 
SET assigned_to = 'dfccab80-7c0c-4bf2-827d-f09574793b14'
WHERE phone IN ('5521990261654', ...);

-- Atualizar contatos para Rainy
UPDATE contacts 
SET assigned_to = '326e11b2-e643-48b6-8cda-661e642a126b'
WHERE phone IN ('5521969373682', ...);
```

## Próximos Passos

1. **Você decide**: Quer que eu crie o perfil "Wallan" automaticamente ou você prefere criar manualmente?
2. **Após criar Wallan**: Reimportar a planilha pelo sistema ou executar SQL direto

## Observações Técnicas

- A planilha contém status de lead que podem não existir no sistema (como "ABORDAGEM SEM RESPOSTA", "AGENDAMENTO", "JA FEZ EMP +", "VISITA")
- O sistema agora deve criar esses status automaticamente durante a importação (correção implementada anteriormente)
- As etiquetas também serão criadas automaticamente se não existirem
