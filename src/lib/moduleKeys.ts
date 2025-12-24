/**
 * Utilitário para normalizar chaves de módulo (module_key)
 * 
 * IMPORTANTE: Este arquivo está DEPRECATED.
 * Usar sempre `item.module_key` diretamente do banco de dados.
 * Manter apenas para compatibilidade com código legado.
 */

/**
 * Normaliza uma chave de módulo que pode vir em qualquer formato
 * para o padrão do banco (com underscores)
 * 
 * @deprecated Usar item.module_key diretamente do banco
 */
export function normalizeModuleKey(key: string): string {
  return key.replace(/-/g, '_');
}

/**
 * @deprecated Este utilitário está obsoleto. 
 * Usar item.module_key diretamente do banco de dados.
 * Mantido apenas para compatibilidade com código legado.
 */
export function normalizeModuleKeyFromHref(href: string | null | undefined): string | null {
  if (!href) return null;
  
  const pathWithoutQuery = href.split('?')[0];
  
  // Dashboard especial
  if (pathWithoutQuery === '/') return 'dashboard';
  
  // Gerar module_key usando a MESMA lógica do banco de dados
  return href
    .substring(1)
    .replace(/\//g, '_')
    .replace(/-/g, '_')
    .replace(/\?tab=/g, '_')
    .replace(/\?/g, '_');
}
