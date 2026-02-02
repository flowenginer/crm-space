import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Eye, ExternalLink, ArrowRightLeft, User, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useMyWaitingCount, useMyWaitingConversations, type WaitingConversation } from '@/hooks/useMyWaitingConversations';
import { useResponseAlertSettings } from '@/hooks/useAgentMonitor';
import { ConversationPreviewDialog } from '@/components/conversations/ConversationPreviewDialog';
import { TransferModal } from '@/components/conversations/TransferModal';
import { useUserStore } from '@/store/userStore';

// Tenant Master - desativar animação de piscar para esta conta
const MASTER_TENANT_ID = '664dfcb4-5432-4c14-9838-7db14360cabf';

export function WaitingCard() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [previewConversationId, setPreviewConversationId] = useState<string | null>(null);
  const [transferConversationId, setTransferConversationId] = useState<string | null>(null);
  const [transferCurrentAssignedTo, setTransferCurrentAssignedTo] = useState<string | null>(null);
  const [transferCurrentDepartmentId, setTransferCurrentDepartmentId] = useState<string | null>(null);
  
  // Verificar se é o tenant Master
  const { tenantId } = useUserStore();
  const isMasterTenant = tenantId === MASTER_TENANT_ID;

  const { data: waitingCount = 0, isLoading: countLoading } = useMyWaitingCount();
  const { data: conversations = [], isLoading: conversationsLoading, refetch } = useMyWaitingConversations(modalOpen);
  const { data: alertMinutes = 5 } = useResponseAlertSettings();

  const getAlertLevel = (minutes: number): 'ok' | 'warning' | 'critical' => {
    if (minutes >= alertMinutes) return 'critical';
    if (minutes >= alertMinutes * 0.5) return 'warning';
    return 'ok';
  };

  const getIndicatorColor = (level: 'ok' | 'warning' | 'critical') => {
    switch (level) {
      case 'critical': return 'bg-destructive';
      case 'warning': return 'bg-amber-500';
      case 'ok': return 'bg-green-500';
    }
  };

  const getTextColor = (level: 'ok' | 'warning' | 'critical') => {
    switch (level) {
      case 'critical': return 'text-destructive';
      case 'warning': return 'text-amber-500';
      case 'ok': return 'text-muted-foreground';
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `há ${Math.round(minutes)} min`;
    if (minutes < 1440) return `há ${Math.round(minutes / 60)}h`;
    return `há ${Math.round(minutes / 1440)}d`;
  };

  const handleOpenConversation = (conversationId: string) => {
    setModalOpen(false);
    navigate(`/conversations?id=${conversationId}`);
  };

  const handleTransfer = (conv: WaitingConversation) => {
    setTransferConversationId(conv.conversation_id);
    setTransferCurrentAssignedTo(conv.assigned_to);
    setTransferCurrentDepartmentId(conv.department_id);
  };

  const handleTransferSuccess = () => {
    setTransferConversationId(null);
    refetch();
  };

  // Determina se há algum crítico para destacar o card
  // Para tenant Master, desabilita animação de piscar
  const hasCritical = conversations.some(c => getAlertLevel(c.waiting_minutes) === 'critical');
  const hasWarning = conversations.some(c => getAlertLevel(c.waiting_minutes) === 'warning');
  const shouldBlinkRed = hasCritical && !isMasterTenant; // Desativar blink para Master

  if (countLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg animate-pulse">
        <Clock size={16} className="text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all w-full text-left border ${
          shouldBlinkRed 
            ? 'animate-blink-red' 
            : hasCritical
              ? 'bg-destructive/10 border-destructive/30 hover:bg-destructive/20' // Estilo estático para Master
              : hasWarning 
                ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20'
                : 'bg-muted/50 hover:bg-muted border-transparent'
        }`}
      >
        <Clock 
          size={16} 
          className={
            hasCritical 
              ? 'text-destructive' 
              : hasWarning 
                ? 'text-amber-500' 
                : 'text-primary'
          } 
        />
        <span className="text-sm font-medium">
          Aguardando resposta:
        </span>
        <span 
          className={`text-sm font-bold ${
            hasCritical 
              ? 'text-destructive' 
              : hasWarning 
                ? 'text-amber-500' 
                : 'text-primary'
          }`}
        >
          ({waitingCount})
        </span>
        <span className="text-sm text-muted-foreground">
          {waitingCount === 1 ? 'cliente' : 'clientes'}
        </span>
      </button>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[95vw] max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Conversas Aguardando Sua Resposta
            </DialogTitle>
          </DialogHeader>

          {conversationsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Nenhuma conversa aguardando resposta</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-3 pr-4">
                {conversations.map((conv) => {
                  const level = getAlertLevel(conv.waiting_minutes);
                  return (
                    <div
                      key={conv.conversation_id}
                      className="flex items-center gap-2 p-2 sm:p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                    >
                      {/* Indicator */}
                      <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0 ${getIndicatorColor(level)} ${level === 'critical' ? 'animate-pulse' : ''}`} />

                      {/* Avatar */}
                      <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                        <AvatarImage src={conv.contact_avatar || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm">
                          {conv.contact_name?.charAt(0)?.toUpperCase() || <User size={14} />}
                        </AvatarFallback>
                      </Avatar>

                      {/* Content - com largura máxima para garantir espaço dos botões */}
                      <div className="flex-1 min-w-0 max-w-[calc(100%-180px)]">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs sm:text-sm truncate">
                            {conv.contact_name || 'Sem nome'}
                          </span>
                          <span className={`text-[10px] sm:text-xs flex-shrink-0 ${getTextColor(level)}`}>
                            {formatTime(conv.waiting_minutes)}
                          </span>
                        </div>
                        {conv.last_message_preview && (
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">
                            {conv.last_message_preview}
                          </p>
                        )}
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                          {conv.contact_phone}
                        </p>
                      </div>

                      {/* Action Buttons - SEMPRE visíveis com espaço garantido */}
                      <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0 ml-auto">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 sm:h-8 sm:w-8"
                          onClick={() => setPreviewConversationId(conv.conversation_id)}
                          title="Visualizar"
                        >
                          <Eye size={14} className="sm:w-4 sm:h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 sm:h-8 sm:w-8"
                          onClick={() => handleTransfer(conv)}
                          title="Transferir"
                        >
                          <ArrowRightLeft size={14} className="sm:w-4 sm:h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 sm:h-8 sm:w-8"
                          onClick={() => handleOpenConversation(conv.conversation_id)}
                          title="Abrir"
                        >
                          <ExternalLink size={14} className="sm:w-4 sm:h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <ConversationPreviewDialog
        conversationId={previewConversationId}
        isOpen={!!previewConversationId}
        onClose={() => setPreviewConversationId(null)}
      />

      {/* Transfer Modal */}
      <TransferModal
        open={!!transferConversationId}
        onClose={() => setTransferConversationId(null)}
        onTransferSuccess={handleTransferSuccess}
        conversationId={transferConversationId || ''}
        currentAssignedTo={transferCurrentAssignedTo}
        currentDepartmentId={transferCurrentDepartmentId}
      />
    </>
  );
}
