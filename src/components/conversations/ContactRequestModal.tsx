import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, UserCheck, Clock, Loader2 } from 'lucide-react';
import { useCreateContactRequest, useExistingRequest } from '@/hooks/useContactRequests';

interface ContactRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: {
    id: string;
    full_name: string;
    phone: string;
  };
  currentOwner: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  conversationId?: string | null;
}

export function ContactRequestModal({
  open,
  onOpenChange,
  contact,
  currentOwner,
  conversationId,
}: ContactRequestModalProps) {
  const [requestType, setRequestType] = useState<'owner' | 'attendant'>('attendant');
  const [reason, setReason] = useState('');
  const [resolvedConversationId, setResolvedConversationId] = useState<string | null>(conversationId || null);

  const createRequest = useCreateContactRequest();
  const { data: existingRequest, isLoading: checkingExisting } = useExistingRequest(
    open ? contact.id : undefined
  );

  // Auto-find active conversation if none provided
  useEffect(() => {
    if (!open || conversationId) {
      setResolvedConversationId(conversationId || null);
      return;
    }
    const findConversation = async () => {
      const { data } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contact.id)
        .in('status', ['open', 'pending'])
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setResolvedConversationId(data?.id || null);
    };
    findConversation();
  }, [open, conversationId, contact.id]);

  const handleSubmit = async () => {
    if (!reason.trim()) return;

    await createRequest.mutateAsync({
      contact_id: contact.id,
      conversation_id: resolvedConversationId,
      current_owner_id: currentOwner.id,
      request_type: requestType,
      reason: reason.trim(),
    });

    setReason('');
    setRequestType('attendant');
    onOpenChange(false);
  };

  const getOwnerInitials = () => {
    if (!currentOwner.full_name) return 'U';
    return currentOwner.full_name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Contato Pertence a Outro Atendente
          </DialogTitle>
          <DialogDescription>
            Este contato já está associado a outro vendedor. Você pode solicitar acesso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info do contato */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="font-medium">{contact.full_name}</p>
            <p className="text-sm text-muted-foreground">{contact.phone}</p>
          </div>

          {/* Info do dono atual */}
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={currentOwner.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {getOwnerInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Atendente responsável</p>
              <p className="font-medium">{currentOwner.full_name || 'Sem nome'}</p>
            </div>
          </div>

          {/* Verifica se já existe requisição pendente */}
          {checkingExisting ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : existingRequest ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/50">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Requisição Pendente
                </p>
              </div>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                Você já enviou uma requisição para este contato. Aguarde a aprovação do supervisor.
              </p>
            </div>
          ) : (
            <>
              {/* Tipo de requisição */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Tipo de Requisição</Label>
                <RadioGroup
                  value={requestType}
                  onValueChange={(v) => setRequestType(v as 'owner' | 'attendant')}
                  className="grid gap-3"
                >
                  <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="owner" id="owner" className="mt-0.5" />
                    <Label htmlFor="owner" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-primary" />
                        <span className="font-medium">Atendente Responsável</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Quero ser o dono deste contato. Ele será transferido permanentemente para mim.
                      </p>
                    </Label>
                  </div>

                  <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="attendant" id="attendant" className="mt-0.5" />
                    <Label htmlFor="attendant" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <span className="font-medium">Atendente Atual</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Quero apenas atender este contato temporariamente. O dono original permanece.
                      </p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Motivo */}
              <div className="space-y-2">
                <Label htmlFor="reason">Motivo da Requisição *</Label>
                <Textarea
                  id="reason"
                  placeholder="Explique por que você precisa de acesso a este contato..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </>
          )}
        </div>

        {!existingRequest && !checkingExisting && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!reason.trim() || createRequest.isPending}
            >
              {createRequest.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Requisição'
              )}
            </Button>
          </div>
        )}

        {existingRequest && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
