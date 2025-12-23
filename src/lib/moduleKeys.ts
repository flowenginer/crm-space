/**
 * Utilitário para normalizar chaves de módulo (module_key)
 * Garante que Sidebar e TenantModulesTree usem o mesmo padrão
 */

/**
 * Mapeamentos especiais de rota -> module_key
 * Para rotas que têm nomes diferentes da chave no banco
 */
const ROUTE_TO_MODULE_KEY: Record<string, string> = {
  '/': 'dashboard',
  '/ao-vivo': 'live_monitor',
  '/live-monitor': 'live_monitor',
  '/relatorios': 'reports',
  '/reports': 'reports',
  '/seller-dashboard': 'seller_dashboard',
  '/meta-ads': 'campaigns',
  '/campaign-report': 'campaigns',
};

/**
 * Normaliza um href em uma chave de módulo padronizada
 * Converte hífens para underscores para bater com o banco de dados
 * 
 * Exemplos:
 * - /internal-chat -> internal_chat
 * - /bulk-dispatch -> bulk_dispatch
 * - /whatsapp-channels -> whatsapp_channels
 * - /products/catalogs -> products
 * - /conversations -> conversations
 * - /ao-vivo -> live_monitor
 * - /relatorios/atendimentos -> reports
 */
export function normalizeModuleKeyFromHref(href: string | null | undefined): string | null {
  if (!href) return null;
  
  const pathWithoutQuery = href.split('?')[0];
  
  // Verificar mapeamento direto primeiro
  const directMatch = ROUTE_TO_MODULE_KEY[pathWithoutQuery];
  if (directMatch) return directMatch;
  
  // Para subrotas como /relatorios/atendimentos, verificar se começa com uma rota mapeada
  for (const [route, key] of Object.entries(ROUTE_TO_MODULE_KEY)) {
    if (route !== '/' && pathWithoutQuery.startsWith(route + '/')) {
      return key;
    }
  }
  
  // Comportamento padrão: extrai primeiro segmento e converte hífens para underscores
  const path = pathWithoutQuery.replace(/^\//, '').split('/')[0];
  
  if (!path) return null;
  
  // Converte hífens para underscores para padronizar com o banco
  return path.replace(/-/g, '_');
}

/**
 * Normaliza uma chave de módulo que pode vir em qualquer formato
 * para o padrão do banco (com underscores)
 */
export function normalizeModuleKey(key: string): string {
  return key.replace(/-/g, '_');
}
