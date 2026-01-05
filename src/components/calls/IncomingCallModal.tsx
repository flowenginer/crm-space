import { Phone, PhoneOff, X, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCallContext, IncomingCall } from '@/providers/CallProvider';
import { cn } from '@/lib/utils';

interface IncomingCallModalProps {
  call: IncomingCall;
}

export function IncomingCallModal({ call }: IncomingCallModalProps) {
  const { answerIncomingCall, rejectIncomingCall, dismissIncomingCall } = useCallContext();

  const initials = call.contactName
    ? call.contactName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
      <Card className="w-full max-w-sm mx-4 animate-in zoom-in-95 duration-200">
        <CardContent className="pt-6">
          {/* Close button */}
          <button
            onClick={dismissIncomingCall}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Caller info */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={call.contactAvatar} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              
              {/* Pulsing ring animation */}
              <div className="absolute inset-0 rounded-full border-2 border-green-500 animate-ping opacity-75" />
              <div className="absolute inset-0 rounded-full border-2 border-green-500 animate-pulse" />
            </div>

            <h3 className="text-xl font-semibold text-foreground mb-1">
              {call.contactName}
            </h3>
            <p className="text-muted-foreground">
              {formatPhone(call.phone)}
            </p>

            <div className="flex items-center gap-2 mt-3">
              {call.mediaType === 'video' ? (
                <Video className="h-4 w-4 text-blue-500" />
              ) : (
                <Phone className="h-4 w-4 text-green-500" />
              )}
              <span className="text-sm text-muted-foreground">
                Chamada {call.mediaType === 'video' ? 'de vídeo' : 'de voz'} via WhatsApp
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-6">
            {/* Reject button */}
            <div className="flex flex-col items-center gap-2">
              <Button
                variant="destructive"
                size="icon"
                className="h-14 w-14 rounded-full"
                onClick={rejectIncomingCall}
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
              <span className="text-sm text-muted-foreground">Rejeitar</span>
            </div>

            {/* Answer button */}
            <div className="flex flex-col items-center gap-2">
              <Button
                size="icon"
                className="h-14 w-14 rounded-full bg-green-500 hover:bg-green-600"
                onClick={answerIncomingCall}
              >
                <Phone className="h-6 w-6 text-white" />
              </Button>
              <span className="text-sm text-muted-foreground">Atender</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
