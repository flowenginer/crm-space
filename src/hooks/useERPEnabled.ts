import { useMenuItems } from './useMenuConfig';

/**
 * Hook to check if ERP module is enabled in menu configuration
 */
export function useERPEnabled() {
  const { data: menuItems } = useMenuItems();
  
  // Find the ERP menu item and check if it's active
  const erpMenu = menuItems?.find(item => item.title === 'ERP');
  
  return erpMenu?.is_active ?? false;
}
