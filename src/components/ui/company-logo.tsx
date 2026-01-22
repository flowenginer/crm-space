import { cn } from '@/lib/utils';
import spaceSportsLogo from '@/assets/space-sports-logo.png';

interface CompanyLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: 'h-8 w-8',
  md: 'h-11 w-11',
  lg: 'h-16 w-16',
  xl: 'h-20 w-20',
};

/**
 * Componente de logo estático da Space Sports
 * Usado em todo o CRM independente do tenant
 */
export function CompanyLogo({
  size = 'md',
  className,
}: CompanyLogoProps) {
  const sizeClass = sizeMap[size];

  return (
    <div
      className={cn(
        sizeClass,
        'rounded-xl overflow-hidden flex-shrink-0',
        className
      )}
    >
      <img
        src={spaceSportsLogo}
        alt="Space Sports"
        className="w-full h-full object-cover"
      />
    </div>
  );
}
