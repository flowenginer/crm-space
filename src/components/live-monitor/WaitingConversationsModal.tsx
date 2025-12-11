import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, Eye, ExternalLink, Loader2, MessageSquare, ArrowRightLeft, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { ConversationPreviewDialog } from '@/components/conversations/ConversationPreviewDialog';
import { TransferModal } from '@/components/conversations/TransferModal';

interface WaitingConversation {
  conversation_id: string;
  contact_id: string;
  contact_name: string;
  contact_phone: string;
  contact_avatar: string | null;
  last_message_preview: string | null;
  waiting_since: string;
  waiting_minutes: number;
  assigned_to: string | null;
  department_id: string | null;
}

interface WaitingConversationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
  alertMinutes: number;
}

export function WaitingConversationsModal({
  open,
  onOpenChange,
  agentId,
  agentName,
  alertMinutes,
}: WaitingConversationsModalProps) {
  const navigate = useNavigate();
  const [previewConversationId, setPreviewConversationId] = useState<string | null>(null);
  const [transferConversationId, setTransferConversationId] = useState<string | null>(null);
  const [transferCurrentAssignedTo, setTransferCurrentAssignedTo] = useState<string | null>(null);
  const [transferCurrentDepartmentId, setTransferCurrentDepartmentId] = useState<string | null>(null);

  const { data: conversations = [], isLoading, refetch } = useQuery({
    queryKey: ['waiting-conversations', agentId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_agent_waiting_conversations', {
        p_agent_id: agentId,
      });
      if (error) throw error;
      return (data || []) as WaitingConversation[];
    },
    enabled: open,
    refetchInterval: 30000,
  });

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
    onOpenChange(false);
    navigate(`/conversas?id=${conversationId}`);
  };

  const handlePreview = (conversationId: string) => {
    setPreviewConversationId(conversationId);
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Conversas Aguardando - {agentName}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
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
                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                    >
                      {/* Indicator */}
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getIndicatorColor(level)} ${level === 'critical' ? 'animate-pulse' : ''}`} />

                      {/* Avatar */}
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={conv.contact_avatar || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {conv.contact_name?.charAt(0)?.toUpperCase() || <User size={16} />}
                        </AvatarFallback>
                      </Avatar>

                      {/* Content */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate">
                            {conv.contact_name || 'Sem nome'}
                          </span>
                          <span className={`text-xs flex-shrink-0 ${getTextColor(level)}`}>
                            {formatTime(conv.waiting_minutes)}
                          </span>
                        </div>
                        {conv.last_message_preview && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {conv.last_message_preview}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {conv.contact_phone}
                        </p>
                      </div>

                      {/* Action Buttons - Always Visible */}
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handlePreview(conv.conversation_id)}
                          title="Visualizar"
                        >
                          <Eye size={16} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleTransfer(conv)}
                          title="Transferir"
                        >
                          <ArrowRightLeft size={16} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleOpenConversation(conv.conversation_id)}
                          title="Abrir"
                        >
                          <ExternalLink size={16} />
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
