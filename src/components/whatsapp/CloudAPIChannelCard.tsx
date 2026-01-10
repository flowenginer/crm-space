import { cn } from '@/lib/utils';
import { 
  MessageCircle, 
  MoreVertical, 
  RefreshCw, 
  Settings, 
  Trash2,
  Shield,
  Check,
  AlertCircle,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { WhatsAppChannel } from '@/hooks/useChannels';

export interface CloudAPIChannelCardProps {
  channel: WhatsAppChannel;
  onOpenDetails: (channel: WhatsAppChannel) => void;
  onSync?: (channel: WhatsAppChannel) => void;
  onDelete: (channel: WhatsAppChannel) => void;
  onReconfigure?: (channel: WhatsAppChannel) => void;
}

export function CloudAPIChannelCard({
  channel,
  onOpenDetails,
  onSync,
  onDelete,
  onReconfigure,
}: CloudAPIChannelCardProps) {
  const isActive = channel.status === 'connected';

  // Extract tier from metadata if available
  const tier = (channel as any).messaging_limit_tier || 'Standard';

  return (
    <div
      className={cn(
        'bg-card rounded-2xl border-2 shadow-card p-6 transition-all duration-300 hover:shadow-card-hover',
        'border-green-200 dark:border-green-800'
      )}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl shadow-lg bg-gradient-to-br from-green-500 to-emerald-600">
            <MessageCircle size={24} className="text-white" />
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Shield size={16} className="text-green-600" />
                  <span className="text-xs font-medium text-green-600">API Oficial</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Conectado via Meta Cloud API</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
              <MoreVertical size={18} className="text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpenDetails(channel)}>
              <BarChart3 size={16} className="mr-2" />
              Ver detalhes
            </DropdownMenuItem>
            {onSync && (
              <DropdownMenuItem onClick={() => onSync(channel)}>
                <RefreshCw size={16} className="mr-2" />
                Sincronizar
              </DropdownMenuItem>
            )}
            {onReconfigure && (
              <DropdownMenuItem onClick={() => onReconfigure(channel)}>
                <Settings size={16} className="mr-2" />
                Reconfigurar Webhook
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <a 
                href="https://business.facebook.com/settings/whatsapp-business-accounts" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink size={16} className="mr-2" />
                Abrir Meta Business
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-destructive"
              onClick={() => onDelete(channel)}
            >
              <Trash2 size={16} className="mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Channel Name */}
      <div className="mb-3">
        <h3 className="text-lg font-bold text-foreground mb-1">{channel.name}</h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge 
            variant="outline" 
            className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
          >
            <Check size={12} className="mr-1" />
            Cloud API
          </Badge>
          <Badge 
            variant="outline"
            className={cn(
              isActive
                ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {isActive ? 'Ativo' : 'Inativo'}
          </Badge>
          {channel.department && (
            <Badge variant="secondary">
              {channel.department.name}
            </Badge>
          )}
        </div>
      </div>

      {/* Phone Number & Tier */}
      <div className="bg-green-50/50 dark:bg-green-950/30 rounded-lg p-3 mb-3 border border-green-100 dark:border-green-900">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-muted-foreground font-medium">Número:</span>
          <span className="text-foreground font-semibold">{channel.phone}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-medium">Tier:</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-green-600 font-medium cursor-help">
                  {tier}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Limite de mensagens por dia definido pelo Meta</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Status Info */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        {isActive ? (
          <>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-600">Pronto para receber mensagens</span>
          </>
        ) : (
          <>
            <AlertCircle size={14} className="text-amber-500" />
            <span className="text-amber-600">Verificar configuração</span>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-green-100 dark:border-green-900">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950"
          onClick={() => onOpenDetails(channel)}
        >
          <BarChart3 size={16} className="mr-1" />
          Detalhes
        </Button>
        {onSync && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSync(channel)}
          >
            <RefreshCw size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}
