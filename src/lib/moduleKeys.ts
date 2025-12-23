/**
 * Utilitário para normalizar chaves de módulo (module_key)
 * Garante que Sidebar e TenantModulesTree usem o mesmo padrão
 */

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
 */
export function normalizeModuleKeyFromHref(href: string | null | undefined): string | null {
  if (!href) return null;
  
  // Caso especial: raiz "/" é o dashboard
  if (href === '/') return 'dashboard';
  
  // Remove barra inicial e extrai primeiro segmento
  const path = href.replace(/^\//, '').split('/')[0].split('?')[0];
  
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
