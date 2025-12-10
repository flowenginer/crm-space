import { Phone, PhoneOff, Video, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import type { IncomingCall } from '@/hooks/useIncomingCalls';

interface IncomingCallNotificationProps {
  call: IncomingCall;
  onDismiss: () => void;
}

export function IncomingCallNotification({ call, onDismiss }: IncomingCallNotificationProps) {
  const navigate = useNavigate();

  const openConversation = () => {
    if (call.conversationId) {
      navigate(`/conversations?id=${call.conversationId}`);
    }
    onDismiss();
  };

  const formatPhone = (phone: string) => {
    if (phone.length === 13) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    }
    if (phone.length === 12) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 8)}-${phone.slice(8)}`;
    }
    return `+${phone}`;
  };

  return (
    <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 duration-300">
      <Card className="w-80 p-4 bg-emerald-500 text-white shadow-2xl border-none">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-white/20 rounded-full animate-pulse">
            {call.isVideo ? (
              <Video className="h-6 w-6" />
            ) : (
              <Phone className="h-6 w-6" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium opacity-90">
              {call.isVideo ? 'Videochamada' : 'Chamada de voz'} recebida
            </p>
            <p className="text-lg font-bold truncate">{call.contactName}</p>
            <p className="text-sm opacity-80">{formatPhone(call.phone)}</p>
            <p className="text-xs opacity-70 mt-1">via {call.channelName}</p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          {call.conversationId && (
            <Button 
              variant="secondary" 
              size="sm" 
              className="flex-1 bg-white/20 hover:bg-white/30 text-white border-0"
              onClick={openConversation}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Ver Conversa
            </Button>
          )}
          <Button 
            variant="secondary" 
            size="sm" 
            className="bg-white/20 hover:bg-white/30 text-white border-0"
            onClick={onDismiss}
            title="Dispensar notificação"
          >
            <PhoneOff className="h-4 w-4" />
          </Button>
        </div>
        
        <p className="text-xs text-center mt-3 opacity-70">
          📱 A chamada está tocando no celular conectado
        </p>
      </Card>
    </div>
  );
}
