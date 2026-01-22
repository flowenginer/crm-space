import { useEffect } from 'react';
import spaceSportsLogo from '@/assets/space-sports-logo.png';

/**
 * Hook para definir o favicon e título estáticos da Space Sports
 * Usado globalmente em todos os tenants
 */
export function useDynamicFavicon() {
  useEffect(() => {
    // Define o favicon como a logo da Space Sports
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    
    link.href = spaceSportsLogo;
    link.type = 'image/png';
  }, []);

  useEffect(() => {
    // Define o título padrão
    document.title = 'Space Sports';
  }, []);
}
