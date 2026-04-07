
Plano para eliminar o erro de áudio no Instagram

Diagnóstico confirmado

Do I know what the issue is? Sim.

- A documentação oficial da Meta confirma que o Instagram Messaging aceita áudio, então o problema não é “Instagram não suporta áudio”.
- O problema real é formato: a Meta aceita áudio apenas em `aac`, `m4a`, `wav` e `mp4`, com limite de `25MB`.
- Os logs da função `instagram-send-message` confirmam isso: o envio está chegando com `type: "audio"` e o Graph API responde com `IGApiException code 100 / subcode 2534080` (“formato de anexo não aceito”).
- No frontend atual, o fluxo de gravação em `src/pages/Conversations.tsx` trata Instagram como canal “não oficial” e acaba gerando/consolidando áudio em `MP3`, que é exatamente um formato rejeitado pela documentação do Instagram.
- Há ainda uma inconsistência no código: uma parte diz que Instagram não suporta áudio, enquanto a documentação mostra que suporta. Isso precisa ser alinhado para o sistema não continuar alternando entre bloqueio incorreto e erro 400.

O que vou implementar

1. Corrigir a regra de produto para Instagram
- Remover a suposição errada de que Instagram não aceita áudio.
- Centralizar uma matriz de formatos suportados para Instagram:
  - áudio: `aac`, `m4a`, `wav`, `mp4`
  - imagem: `png`, `jpeg`
  - vídeo: `mp4`, `ogg`, `avi`, `mov`, `webm`
  - arquivo: `pdf`

2. Ajustar o gravador para Instagram
- Em `src/pages/Conversations.tsx`, separar Instagram de WhatsApp oficial/não-oficial.
- Para Instagram, gerar áudio em formato compatível com a Meta, preferencialmente `WAV` (mais seguro no browser).
- Manter o fluxo atual de `MP3` apenas para canais WhatsApp que já usam esse formato.

3. Validar antes de enviar
- Antes de fazer upload ou chamar a edge function, validar o formato do áudio quando o canal for Instagram.
- Se o usuário anexar ou gravar um formato inválido para Instagram, mostrar erro local claro, sem disparar a API:
  - “Instagram aceita áudio apenas em AAC, M4A, WAV ou MP4.”
- Isso evita novos 400 desnecessários.

4. Endurecer a edge function
- Em `supabase/functions/instagram-send-message/index.ts`, validar o tipo real do anexo antes de chamar a Meta.
- Se o áudio for inválido, retornar erro amigável imediatamente.
- Atualizar os tipos aceitos da função para refletirem o suporte real do Instagram e parar com a lógica contraditória atual.

5. Tornar a validação mais confiável
- Passar metadados do arquivo no envio para a edge function, como `mimeType` e/ou `filename`, para não depender só da URL pública.
- Assim a validação de formato fica determinística.

6. Garantir consistência visual no CRM
- Não criar/otimizar mensagem de saída de áudio no CRM quando o formato já for inválido localmente.
- Só persistir a mensagem depois que o envio passar pela validação do canal.

Arquivos envolvidos

- `src/pages/Conversations.tsx`
- `src/lib/whatsapp/instance-creator.ts`
- `supabase/functions/instagram-send-message/index.ts`
- possivelmente um novo helper para regras de mídia do Instagram e/ou encoder WAV

Ponto importante da documentação

- A documentação da Meta mostra que enviar mídia por URL é válido para Instagram. Então não preciso trocar toda a arquitetura para Attachment Upload API agora.
- O erro atual é de compatibilidade de formato, não de endpoint.

Resultado esperado

- Áudio gravado no CRM para canais Instagram será gerado em formato aceito.
- Áudio incompatível será bloqueado antes da API.
- A edge function ficará protegida contra formatos errados.
- O erro `2534080` deixará de acontecer no fluxo normal.

Validação após implementar

1. Gravar e enviar áudio para um lead de Instagram
2. Anexar um `WAV` ou `M4A` e confirmar envio
3. Tentar anexar `MP3/OGG/WEBM` em canal Instagram e validar bloqueio local
4. Confirmar que texto, imagem e vídeo continuam funcionando
5. Verificar logs da `instagram-send-message` para garantir que não há mais rejeição de formato
