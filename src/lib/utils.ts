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
