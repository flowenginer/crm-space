import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Inbox,
  Send,
  FileEdit,
  Star,
  Archive,
  Trash2,
  Plus,
  Tag,
  Palette,
  FileCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Factory
} from 'lucide-react';
import { useInternalEmailFolderCounts, useInternalEmailLabels, type EmailFolder } from '@/hooks/useInternalEmail';

interface EmailSidebarProps {
  currentFolder: EmailFolder;
  onFolderChange: (folder: EmailFolder) => void;
  onCompose: () => void;
}

const folderItems: { id: EmailFolder; label: string; icon: React.ReactNode }[] = [
  { id: 'inbox', label: 'Entrada', icon: <Inbox className="h-4 w-4" /> },
  { id: 'sent', label: 'Enviados', icon: <Send className="h-4 w-4" /> },
  { id: 'drafts', label: 'Rascunhos', icon: <FileEdit className="h-4 w-4" /> },
  { id: 'starred', label: 'Favoritos', icon: <Star className="h-4 w-4" /> },
  { id: 'archive', label: 'Arquivados', icon: <Archive className="h-4 w-4" /> },
  { id: 'trash', label: 'Lixeira', icon: <Trash2 className="h-4 w-4" /> }
];

const labelIcons: Record<string, React.ReactNode> = {
  'Palette': <Palette className="h-3.5 w-3.5" />,
  'FileCheck': <FileCheck className="h-3.5 w-3.5" />,
  'CheckCircle': <CheckCircle className="h-3.5 w-3.5" />,
  'XCircle': <XCircle className="h-3.5 w-3.5" />,
  'AlertTriangle': <AlertTriangle className="h-3.5 w-3.5" />,
  'Factory': <Factory className="h-3.5 w-3.5" />,
  'Tag': <Tag className="h-3.5 w-3.5" />
};

export function EmailSidebar({ currentFolder, onFolderChange, onCompose }: EmailSidebarProps) {
  const { data: counts } = useInternalEmailFolderCounts();
  const { data: labels } = useInternalEmailLabels();

  return (
    <div className="w-64 border-r bg-muted/30 flex flex-col">
      {/* Botão Novo E-mail */}
      <div className="p-4">
        <Button onClick={onCompose} className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Novo E-mail
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 py-2">
          {/* Pastas */}
          <div className="space-y-1">
            {folderItems.map((item) => {
              const count = counts?.[item.id] || 0;
              const isActive = currentFolder === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => onFolderChange(item.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {count > 0 && (
                    <Badge 
                      variant={isActive ? 'secondary' : 'outline'} 
                      className="h-5 min-w-[20px] justify-center text-xs"
                    >
                      {count}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          <Separator className="my-4" />

          {/* Marcadores */}
          <div className="space-y-1">
            <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Marcadores
            </p>
            {labels?.map((label) => (
              <button
                key={label.id}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <span style={{ color: label.color }}>
                  {labelIcons[label.icon] || <Tag className="h-3.5 w-3.5" />}
                </span>
                <span>{label.name}</span>
              </button>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
