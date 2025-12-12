import { useState, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

// Lista de ícones mais comuns para menu
const COMMON_ICONS = [
  'LayoutDashboard', 'Home', 'Settings', 'Users', 'User', 'UserCircle',
  'MessageSquare', 'MessagesSquare', 'Mail', 'Bell', 'Calendar', 'CalendarClock',
  'Package', 'ShoppingCart', 'ShoppingBag', 'Wallet', 'DollarSign', 'CreditCard',
  'BarChart3', 'TrendingUp', 'Target', 'Zap', 'Workflow', 'GitPullRequest',
  'FileText', 'Files', 'Folder', 'Database', 'Server', 'Cloud',
  'Link2', 'Globe', 'Radio', 'Megaphone', 'Tag', 'Tags',
  'Shield', 'Lock', 'Key', 'Eye', 'Search', 'Filter',
  'Plus', 'Minus', 'X', 'Check', 'ChevronRight', 'ChevronDown',
  'Building2', 'Store', 'MapPin', 'Phone', 'Camera', 'Image',
  'Play', 'Pause', 'Clock', 'Timer', 'Layers', 'LayoutTemplate',
  'Settings2', 'Wrench', 'Plug', 'Share2', 'Download', 'Upload',
  'Shirt', 'Heart', 'Star', 'Bookmark', 'Flag', 'Award',
  'ClipboardList', 'ListTodo', 'CheckSquare', 'AlertCircle', 'Info', 'HelpCircle',
];

interface IconSelectorProps {
  value: string;
  onChange: (icon: string) => void;
}

export function IconSelector({ value, onChange }: IconSelectorProps) {
  const [search, setSearch] = useState('');

  const filteredIcons = useMemo(() => {
    if (!search) return COMMON_ICONS;
    const searchLower = search.toLowerCase();
    return COMMON_ICONS.filter(icon => 
      icon.toLowerCase().includes(searchLower)
    );
  }, [search]);

  const renderIcon = (iconName: string) => {
    const IconComponent = (LucideIcons as any)[iconName];
    if (!IconComponent) return null;
    return <IconComponent className="h-5 w-5" />;
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar ícone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      
      <ScrollArea className="h-[200px] rounded-md border p-2">
        <div className="grid grid-cols-6 gap-2">
          {filteredIcons.map((iconName) => (
            <button
              key={iconName}
              type="button"
              onClick={() => onChange(iconName)}
              className={cn(
                'flex items-center justify-center p-2 rounded-lg transition-colors hover:bg-muted',
                value === iconName && 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
              title={iconName}
            >
              {renderIcon(iconName)}
            </button>
          ))}
        </div>
        {filteredIcons.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Nenhum ícone encontrado
          </p>
        )}
      </ScrollArea>

      <p className="text-xs text-muted-foreground">
        Selecionado: <span className="font-medium">{value}</span>
      </p>
    </div>
  );
}

// Componente para renderizar ícone por nome
export function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = (LucideIcons as any)[name];
  if (!IconComponent) {
    return <LucideIcons.Circle className={className} />;
  }
  return <IconComponent className={className} />;
}
