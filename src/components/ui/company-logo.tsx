import { cn } from '@/lib/utils';
import { Shirt } from 'lucide-react';

interface CompanyLogoProps {
  logoUrl?: string | null;
  companyName?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  iconClassName?: string;
  showFallbackIcon?: boolean;
}

const sizeMap = {
  sm: { container: 'h-8 w-8', icon: 'h-4 w-4', text: 'text-xs' },
  md: { container: 'h-11 w-11', icon: 'h-6 w-6', text: 'text-sm' },
  lg: { container: 'h-16 w-16', icon: 'h-8 w-8', text: 'text-lg' },
  xl: { container: 'h-20 w-20', icon: 'h-10 w-10', text: 'text-xl' },
};

export function CompanyLogo({
  logoUrl,
  companyName,
  size = 'md',
  className,
  iconClassName,
  showFallbackIcon = true,
}: CompanyLogoProps) {
  const sizes = sizeMap[size];

  // Se tem logo, exibe a imagem
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={companyName || 'Logo'}
        className={cn(
          sizes.container,
          'object-contain rounded-xl',
          className
        )}
      />
    );
  }

  // Fallback: iniciais do nome da empresa ou ícone
  if (companyName && !showFallbackIcon) {
    const initials = companyName
      .split(' ')
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();

    return (
      <div
        className={cn(
          sizes.container,
          'flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold',
          sizes.text,
          className
        )}
      >
        {initials}
      </div>
    );
  }

  // Fallback padrão: ícone de camiseta
  return (
    <div
      className={cn(
        sizes.container,
        'flex items-center justify-center rounded-xl',
        className
      )}
    >
      <Shirt className={cn(sizes.icon, iconClassName)} />
    </div>
  );
}
