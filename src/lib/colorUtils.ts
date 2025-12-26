/**
 * Converte cor HEX para HSL
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  // Remove # se existir
  hex = hex.replace(/^#/, '');

  // Expande formato abreviado (#RGB -> #RRGGBB)
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }

  if (hex.length !== 6) return null;

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Converte HSL para HEX
 */
function hslToHex(h: number, s: number, l: number): string {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Ajusta automaticamente cores muito claras para melhor contraste no modo light.
 * No modo dark, retorna a cor original sem alterações.
 * 
 * @param color - Cor em formato HEX (ex: "#FFEB3B")
 * @param theme - Tema atual ('light' ou 'dark')
 * @returns Cor ajustada ou original
 */
export function adjustColorForLightMode(
  color: string | null | undefined,
  theme: 'light' | 'dark'
): string | undefined {
  if (!color) return undefined;

  // No modo dark, retorna a cor original
  if (theme === 'dark') return color;

  const hsl = hexToHsl(color);
  if (!hsl) return color;

  let { h, s, l } = hsl;

  // Se a luminosidade é muito alta (cor clara), reduz para garantir contraste
  // Limite: cores com L > 55% são consideradas "claras demais" para texto
  if (l > 55) {
    // Reduz a luminosidade para no máximo 40% (garante bom contraste)
    l = Math.min(l, 40);
    
    // Se a saturação é baixa, aumenta um pouco para manter vivacidade
    if (s < 50 && s > 10) {
      s = Math.min(s + 15, 70);
    }
  }

  return hslToHex(h, s, l);
}
