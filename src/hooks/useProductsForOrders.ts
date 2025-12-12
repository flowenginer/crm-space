import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductForOrder {
  id: string;
  type: 'product' | 'variation';
  product_id: string;
  product_name: string;
  variation_name?: string;
  display_name: string;
  sku?: string;
  price: number;
  stock_quantity?: number;
  image_url?: string;
  is_low_stock: boolean;
}

export function useProductsForOrders(search?: string) {
  return useQuery({
    queryKey: ['products-for-orders', search],
    queryFn: async (): Promise<ProductForOrder[]> => {
      const results: ProductForOrder[] = [];

      // 1. Fetch simple products (without variations)
      const { data: simpleProducts, error: productsError } = await supabase
        .from('products')
        .select('id, name, base_price, sku, main_image_url')
        .eq('is_active', true)
        .eq('has_variations', false);

      if (productsError) throw productsError;

      // Add simple products to results
      if (simpleProducts) {
        for (const product of simpleProducts) {
          results.push({
            id: product.id,
            type: 'product',
            product_id: product.id,
            product_name: product.name,
            display_name: product.name,
            sku: product.sku || undefined,
            price: product.base_price || 0,
            stock_quantity: undefined,
            image_url: product.main_image_url || undefined,
            is_low_stock: false,
          });
        }
      }

      // 2. Fetch product variations
      const { data: variations, error: variationsError } = await supabase
        .from('product_variations')
        .select(`
          id,
          variation_name,
          sku,
          price,
          stock_quantity,
          low_stock_threshold,
          image_url,
          is_active,
          product:products!inner(id, name, base_price, main_image_url, is_active)
        `)
        .eq('is_active', true);

      if (variationsError) throw variationsError;

      // Add variations to results
      if (variations) {
        for (const variation of variations) {
          const product = variation.product as { id: string; name: string; base_price: number; main_image_url: string | null; is_active: boolean };
          
          // Skip if parent product is inactive
          if (!product.is_active) continue;

          const displayName = variation.variation_name 
            ? `${product.name} - ${variation.variation_name}`
            : product.name;

          results.push({
            id: variation.id,
            type: 'variation',
            product_id: product.id,
            product_name: product.name,
            variation_name: variation.variation_name || undefined,
            display_name: displayName,
            sku: variation.sku || undefined,
            price: variation.price || product.base_price || 0,
            stock_quantity: variation.stock_quantity || 0,
            image_url: variation.image_url || product.main_image_url || undefined,
            is_low_stock: (variation.stock_quantity || 0) <= (variation.low_stock_threshold || 5),
          });
        }
      }

      // Sort by product name
      results.sort((a, b) => a.display_name.localeCompare(b.display_name));

      // Filter by search if provided
      if (search && search.trim()) {
        const searchLower = search.toLowerCase().trim();
        return results.filter(item => 
          item.display_name.toLowerCase().includes(searchLower) ||
          item.sku?.toLowerCase().includes(searchLower) ||
          item.product_name.toLowerCase().includes(searchLower)
        );
      }

      return results;
    },
  });
}
