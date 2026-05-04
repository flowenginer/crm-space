import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// PAUSADO em 2026-05-04 para solicitacao de restauracao do CRM.
// Codigo original (versao 36 deployada) salvo em:
//   docs/backups/instagram-webhook-index-2026-05-04.ts
// Para reverter: copiar o conteudo do backup para este arquivo e redeployar
// via mcp__up-supa__deploy_edge_function (project_id=lkxrmjqrzhaivviuuamp,
// name=instagram-webhook, verify_jwt=false).

serve(() =>
  new Response("Webhook desativado para restauracao do CRM", {
    status: 503,
    headers: { "Content-Type": "text/plain" },
  })
);
