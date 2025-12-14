import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generates a color from the lilac→pink gradient based on position (0 to 1)
export function getGradientColor(position: number): string {
  // Gradient from sidebar menu:
  // Start: hsl(262, 83%, 58%) - Lilac/Purple
  // End: hsl(330, 81%, 60%) - Pink/Magenta
  const startHue = 262;
  const endHue = 330;
  const hue = startHue + (position * (endHue - startHue));
  const saturation = 83 - (position * 2); // 83% → 81%
  const lightness = 58 + (position * 2); // 58% → 60%
  
  return `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`;
}

// Generates an array of gradient colors for N items
export function generateGradientColors(count: number): string[] {
  if (count <= 0) return [];
  if (count === 1) return [getGradientColor(0)];
  return Array.from({ length: count }, (_, i) => 
    getGradientColor(i / (count - 1))
  );
}

// Valid clothing sizes to extract from SKU
const VALID_SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'G1', 'G2', 'G3', 'G4', 'G5',
  '1', '2', '3', '4', '5', '6', '7', '8', '10', '12', '14', '16', '18', '20',
  'U', 'UN', 'UNICO', 'ÚNICO'];

// Extracts size from SKU (last part after the last hyphen)
export function extractSizeFromSku(sku: string | null | undefined): string | null {
  if (!sku) return null;
  const parts = sku.split('-');
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1].toUpperCase();
    if (VALID_SIZES.includes(lastPart)) {
      return lastPart;
    }
  }
  return null;
}

// Returns formatted product display name with size in parentheses
export function getProductDisplayName(
  productName: string, 
  variationName?: string | null, 
  sku?: string | null
): string {
  // Priority: variation_name > extracted from SKU
  let size = variationName?.trim();
  
  if (!size) {
    size = extractSizeFromSku(sku);
  }
  
  if (size) {
    return `${productName} (${size})`;
  }
  
  return productName;
}
