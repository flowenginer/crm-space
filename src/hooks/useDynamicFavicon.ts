import { useEffect } from 'react';
import { useCompanySettings } from './useCompanySettings';

/**
 * Hook para atualizar o favicon dinamicamente com a logo da empresa
 */
export function useDynamicFavicon() {
  const { data: settings } = useCompanySettings();

  useEffect(() => {
    if (settings?.logo_url) {
      // Atualiza o favicon
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      
      link.href = settings.logo_url;
      link.type = 'image/png';
    }
  }, [settings?.logo_url]);

  useEffect(() => {
    if (settings?.company_name) {
      // Atualiza o título da aba
      document.title = `CRM ${settings.company_name}`;
    }
  }, [settings?.company_name]);
}
