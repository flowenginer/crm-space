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
  Factory,
  Users,
  Clock,
  CheckCircle2,
  Mail
} from 'lucide-react';
import { useInternalEmailFolderCounts, useInternalEmailLabels, type EmailFolder } from '@/hooks/useInternalEmail';
import { useUserSharedBoxes, useAllSharedBoxesCounts } from '@/hooks/useSharedEmailBoxes';
import { usePermissions } from '@/hooks/usePermissions';

export type ExtendedEmailFolder = EmailFolder | 'all' | `shared_${string}` | `shared_${string}_pending` | `shared_${string}_progress` | `shared_${string}_completed`;

interface EmailSidebarProps {
  currentFolder: ExtendedEmailFolder;
  onFolderChange: (folder: ExtendedEmailFolder) => void;
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
  const { data: sharedBoxes } = useUserSharedBoxes();
  const { data: sharedBoxCounts } = useAllSharedBoxesCounts();
  const { isAdmin, isSupervisor } = usePermissions();

  const showAllEmails = isAdmin || isSupervisor;

  return (
    <div className="w-60 border-r bg-muted/20 flex flex-col">
      {/* Botão Novo E-mail */}
      <div className="p-3">
        <Button onClick={onCompose} className="w-full gap-2 shadow-sm" size="sm">
          <Plus className="h-4 w-4" />
          Novo E-mail
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2 py-1">
          {/* Pasta "Todos" para Admin/Supervisor */}
          {showAllEmails && (
            <>
              <button
                onClick={() => onFolderChange('all')}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors mb-1',
                  currentFolder === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4" />
                  <span>Todos os E-mails</span>
                </div>
              </button>
              <Separator className="my-2" />
            </>
          )}

          {/* Pastas Pessoais */}
          <div className="space-y-0.5">
            {folderItems.map((item) => {
              const count = counts?.[item.id] || 0;
              const unreadCount = counts?.inbox_unread || 0;
              const isActive = currentFolder === item.id;
              const isInbox = item.id === 'inbox';
              
              // For inbox, show unread count; for others, show total count
              const displayCount = isInbox ? unreadCount : count;
              
              return (
                <button
                  key={item.id}
                  onClick={() => onFolderChange(item.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span className={cn(isInbox && unreadCount > 0 && !isActive && 'font-semibold text-foreground')}>
                      {item.label}
                    </span>
                  </div>
                  {displayCount > 0 && (
                    <Badge 
                      variant={isActive ? 'secondary' : 'outline'} 
                      className={cn(
                        "h-5 min-w-[20px] justify-center text-xs",
                        isInbox && !isActive && unreadCount > 0 && "bg-primary text-primary-foreground border-primary"
                      )}
                    >
                      {displayCount}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* Caixas Compartilhadas */}
          {sharedBoxes && sharedBoxes.length > 0 && (
            <>
              <Separator className="my-3" />
              <div className="space-y-0.5">
                <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Caixas Compartilhadas
                </p>
                {sharedBoxes.map((box) => {
                  const boxCounts = sharedBoxCounts?.[box.id];
                  const pendingCount = boxCounts?.pending || 0;
                  const inProgressCount = boxCounts?.in_progress || 0;
                  const isBoxActive = currentFolder.startsWith(`shared_${box.id}`);
                  
                  return (
                    <div key={box.id} className="space-y-0.5">
                      {/* Caixa principal */}
                      <button
                        onClick={() => onFolderChange(`shared_${box.id}` as ExtendedEmailFolder)}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-colors',
                          currentFolder === `shared_${box.id}`
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <Users className="h-4 w-4" />
                          <span className="truncate">{box.name}</span>
                        </div>
                        {(pendingCount > 0 || inProgressCount > 0) && (
                          <Badge 
                            variant={currentFolder === `shared_${box.id}` ? 'secondary' : 'outline'} 
                            className="h-5 min-w-[20px] justify-center text-xs"
                          >
                            {pendingCount + inProgressCount}
                          </Badge>
                        )}
                      </button>

                      {/* Sub-pastas da caixa compartilhada */}
                      {isBoxActive && (
                        <div className="ml-3 space-y-0.5 border-l border-border/50 pl-2">
                          <button
                            onClick={() => onFolderChange(`shared_${box.id}_pending` as ExtendedEmailFolder)}
                            className={cn(
                              'w-full flex items-center justify-between px-2.5 py-1 rounded-md text-xs transition-colors',
                              currentFolder === `shared_${box.id}_pending`
                                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5" />
                              <span>Aguardando</span>
                            </div>
                            {pendingCount > 0 && (
                              <Badge variant="outline" className="h-4 min-w-[16px] justify-center text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                                {pendingCount}
                              </Badge>
                            )}
                          </button>

                          <button
                            onClick={() => onFolderChange(`shared_${box.id}_progress` as ExtendedEmailFolder)}
                            className={cn(
                              'w-full flex items-center justify-between px-2.5 py-1 rounded-md text-xs transition-colors',
                              currentFolder === `shared_${box.id}_progress`
                                ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400'
                                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Palette className="h-3.5 w-3.5" />
                              <span>Em Andamento</span>
                            </div>
                            {inProgressCount > 0 && (
                              <Badge variant="outline" className="h-4 min-w-[16px] justify-center text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">
                                {inProgressCount}
                              </Badge>
                            )}
                          </button>

                          <button
                            onClick={() => onFolderChange(`shared_${box.id}_completed` as ExtendedEmailFolder)}
                            className={cn(
                              'w-full flex items-center justify-between px-2.5 py-1 rounded-md text-xs transition-colors',
                              currentFolder === `shared_${box.id}_completed`
                                ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Concluídos</span>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <Separator className="my-3" />

          {/* Marcadores */}
          <div className="space-y-0.5">
            <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Marcadores
            </p>
            {labels?.map((label) => (
              <button
                key={label.id}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <span style={{ color: label.color }}>
                  {labelIcons[label.icon] || <Tag className="h-3.5 w-3.5" />}
                </span>
                <span className="truncate">{label.name}</span>
              </button>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
