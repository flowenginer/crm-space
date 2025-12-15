import { useState, useEffect } from 'react';
import { X, Paperclip, Loader2, Package, Send, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
  useSendInternalEmail,
  useEmailRecipientOptions,
  useUploadEmailAttachment,
  useInternalEmail
} from '@/hooks/useInternalEmail';
import { useVisibleSharedBoxes } from '@/hooks/useSharedEmailBoxes';
import { EmailAttachmentPreview } from './EmailAttachmentPreview';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EmailComposerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replyTo?: { emailId: string; type: 'reply' | 'replyAll' | 'forward' } | null;
}

interface Recipient {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Attachment {
  file_name: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function EmailComposerModal({ open, onOpenChange, replyTo }: EmailComposerModalProps) {
  const [recipientsTo, setRecipientsTo] = useState<Recipient[]>([]);
  const [recipientsCc, setRecipientsCc] = useState<Recipient[]>([]);
  const [selectedSharedBox, setSelectedSharedBox] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [category, setCategory] = useState('general');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [ccOpen, setCcOpen] = useState(false);

  const { data: recipientOptions } = useEmailRecipientOptions();
  const { data: sharedBoxes } = useVisibleSharedBoxes();
  const { data: replyEmail } = useInternalEmail(replyTo?.emailId || null);
  const sendEmail = useSendInternalEmail();
  const uploadAttachment = useUploadEmailAttachment();

  // Preencher dados quando for resposta/encaminhamento
  useEffect(() => {
    const fillReplyData = async () => {
      if (!replyTo || !replyEmail) return;

      // Obter ID do usuário atual para filtrar
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id;

      console.log('[EmailComposer] Preenchendo resposta:', { 
        type: replyTo.type, 
        emailId: replyTo.emailId,
        currentUserId,
        sender: replyEmail.sender,
        recipients: replyEmail.recipients
      });

      const replyPrefix = replyTo.type === 'forward' ? 'Enc: ' : 'Re: ';
      const subjectPrefix = replyEmail.subject.startsWith('Re: ') || replyEmail.subject.startsWith('Enc: ')
        ? ''
        : replyPrefix;
      setSubject(subjectPrefix + replyEmail.subject);

      // NÃO herdar caixa compartilhada em respostas
      setSelectedSharedBox(null);

      if (replyTo.type === 'reply') {
        // CORREÇÃO: Se eu sou o remetente original, responder aos destinatários
        if (replyEmail.sender?.id === currentUserId) {
          // Eu enviei esse e-mail, então respondo para os destinatários originais
          const originalRecipients: Recipient[] = [];
          replyEmail.recipients?.filter(r => r.recipient_type === 'to').forEach(r => {
            if (r.user && r.user.id !== currentUserId) {
              originalRecipients.push({
                id: r.user.id,
                full_name: r.user.full_name,
                avatar_url: r.user.avatar_url
              });
            }
          });
          setRecipientsTo(originalRecipients);
          console.log('[EmailComposer] Respondendo aos destinatários originais:', originalRecipients);
        } else if (replyEmail.sender) {
          // Responder ao remetente
          setRecipientsTo([{
            id: replyEmail.sender.id,
            full_name: replyEmail.sender.full_name,
            avatar_url: replyEmail.sender.avatar_url
          }]);
          console.log('[EmailComposer] Respondendo ao remetente');
        }
      } else if (replyTo.type === 'replyAll') {
        const allRecipients: Recipient[] = [];
        
        // Adicionar remetente (se não for eu mesmo)
        if (replyEmail.sender && replyEmail.sender.id !== currentUserId) {
          allRecipients.push({
            id: replyEmail.sender.id,
            full_name: replyEmail.sender.full_name,
            avatar_url: replyEmail.sender.avatar_url
          });
        }
        
        // Adicionar outros destinatários 'to' (exceto eu)
        // CORREÇÃO: usar r.user.id em vez de r.user_id na verificação de duplicatas
        replyEmail.recipients?.filter(r => r.recipient_type === 'to').forEach(r => {
          if (r.user && r.user.id !== currentUserId && !allRecipients.find(ar => ar.id === r.user.id)) {
            allRecipients.push({
              id: r.user.id,
              full_name: r.user.full_name,
              avatar_url: r.user.avatar_url
            });
          }
        });
        
        setRecipientsTo(allRecipients);
        console.log('[EmailComposer] Reply All - destinatários:', allRecipients);

        // Adiciona cc (exceto o usuário atual)
        const ccRecipients: Recipient[] = [];
        replyEmail.recipients?.filter(r => r.recipient_type === 'cc').forEach(r => {
          if (r.user && r.user.id !== currentUserId) {
            ccRecipients.push({
              id: r.user.id,
              full_name: r.user.full_name,
              avatar_url: r.user.avatar_url
            });
          }
        });
        if (ccRecipients.length > 0) {
          setRecipientsCc(ccRecipients);
          setShowCc(true);
        }
      }
      // Forward não preenche destinatários

      // Herda prioridade e categoria
      setPriority(replyEmail.priority);
      setCategory(replyEmail.category);
    };

    fillReplyData();
  }, [replyTo, replyEmail]);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setRecipientsTo([]);
      setRecipientsCc([]);
      setSelectedSharedBox(null);
      setSubject('');
      setBody('');
      setPriority('normal');
      setCategory('general');
      setAttachments([]);
      setShowCc(false);
    }
  }, [open]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        const result = await uploadAttachment.mutateAsync(file);
        setAttachments(prev => [...prev, result]);
      } catch (error) {
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }
    e.target.value = '';
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async (asDraft = false) => {
    // Valida destinatário: precisa ter recipients OU caixa compartilhada
    if (recipientsTo.length === 0 && !selectedSharedBox && !asDraft) {
      toast.error('Adicione pelo menos um destinatário ou selecione uma caixa compartilhada');
      return;
    }

    if (!subject.trim()) {
      toast.error('Adicione um assunto');
      return;
    }

    console.log('[EmailComposer] Enviando e-mail:', {
      subject,
      recipientsTo: recipientsTo.map(r => r.id),
      recipientsCc: recipientsCc.map(r => r.id),
      selectedSharedBox,
      attachments: attachments.length,
      asDraft
    });

    try {
      await sendEmail.mutateAsync({
        subject,
        body,
        priority,
        category,
        recipients_to: recipientsTo.map(r => r.id),
        recipients_cc: recipientsCc.map(r => r.id),
        shared_box_id: selectedSharedBox || undefined,
        parent_email_id: replyTo?.type !== 'forward' ? replyTo?.emailId : undefined,
        attachments,
        status: asDraft ? 'draft' : 'sent'
      });

      const sharedBoxName = sharedBoxes?.find(sb => sb.id === selectedSharedBox)?.name;
      toast.success(asDraft ? 'Rascunho salvo' : selectedSharedBox ? `E-mail enviado para ${sharedBoxName}` : 'E-mail enviado');
      onOpenChange(false);
    } catch (error: any) {
      console.error('[EmailComposer] Erro ao enviar e-mail:', error);
      toast.error(error?.message || 'Erro ao enviar e-mail');
    }
  };

  const addRecipientTo = (user: Recipient) => {
    if (!recipientsTo.find(r => r.id === user.id)) {
      setRecipientsTo(prev => [...prev, user]);
    }
    setToOpen(false);
  };

  const addRecipientCc = (user: Recipient) => {
    if (!recipientsCc.find(r => r.id === user.id)) {
      setRecipientsCc(prev => [...prev, user]);
    }
    setCcOpen(false);
  };

  const removeRecipientTo = (id: string) => {
    setRecipientsTo(prev => prev.filter(r => r.id !== id));
  };

  const removeRecipientCc = (id: string) => {
    setRecipientsCc(prev => prev.filter(r => r.id !== id));
  };

  const availableForTo = recipientOptions?.filter(
    u => !recipientsTo.find(r => r.id === u.id) && !recipientsCc.find(r => r.id === u.id)
  ) || [];

  const availableForCc = recipientOptions?.filter(
    u => !recipientsTo.find(r => r.id === u.id) && !recipientsCc.find(r => r.id === u.id)
  ) || [];

  const getModalTitle = () => {
    if (replyTo?.type === 'reply') return 'Responder';
    if (replyTo?.type === 'replyAll') return 'Responder a Todos';
    if (replyTo?.type === 'forward') return 'Encaminhar';
    return 'Novo E-mail';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b bg-muted/30">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-primary" />
            {getModalTitle()}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-120px)]">
          <div className="p-4 space-y-3">
            
            {/* Seção: Destinatário */}
            <div className="space-y-2">
              {/* Caixas Compartilhadas */}
              {sharedBoxes && sharedBoxes.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Caixa:</span>
                  {sharedBoxes.map(box => (
                    <Button
                      key={box.id}
                      type="button"
                      variant={selectedSharedBox === box.id ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        if (selectedSharedBox === box.id) {
                          setSelectedSharedBox(null);
                        } else {
                          setSelectedSharedBox(box.id);
                          setRecipientsTo([]);
                          setRecipientsCc([]);
                        }
                      }}
                    >
                      <Package className="h-3 w-3 mr-1" />
                      {box.name}
                    </Button>
                  ))}
                </div>
              )}

              {/* Para - só mostra se não selecionou caixa compartilhada */}
              {!selectedSharedBox && (
                <div className="flex flex-wrap items-center gap-2 min-h-[32px]">
                  <span className="text-xs text-muted-foreground w-8">Para:</span>
                  {recipientsTo.map(r => (
                    <Badge key={r.id} variant="secondary" className="gap-1 pr-0.5 py-0.5 h-6">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={r.avatar_url || undefined} />
                        <AvatarFallback className="text-[8px]">{getInitials(r.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs">{r.full_name}</span>
                      <button onClick={() => removeRecipientTo(r.id)} className="ml-0.5 hover:bg-muted rounded p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <Popover open={toOpen} onOpenChange={setToOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground px-2">
                        + Adicionar
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-64" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar usuário..." />
                        <CommandList>
                          <CommandEmpty>Nenhum usuário encontrado</CommandEmpty>
                          <CommandGroup>
                            {availableForTo.map(user => (
                              <CommandItem
                                key={user.id}
                                onSelect={() => addRecipientTo(user as Recipient)}
                                className="flex items-center gap-2"
                              >
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={user.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs">{getInitials(user.full_name)}</AvatarFallback>
                                </Avatar>
                                {user.full_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {!showCc && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto" onClick={() => setShowCc(true)}>
                      + Cc
                    </Button>
                  )}
                </div>
              )}

              {/* Cc */}
              {!selectedSharedBox && showCc && (
                <div className="flex flex-wrap items-center gap-2 min-h-[32px]">
                  <span className="text-xs text-muted-foreground w-8">Cc:</span>
                  {recipientsCc.map(r => (
                    <Badge key={r.id} variant="secondary" className="gap-1 pr-0.5 py-0.5 h-6">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={r.avatar_url || undefined} />
                        <AvatarFallback className="text-[8px]">{getInitials(r.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs">{r.full_name}</span>
                      <button onClick={() => removeRecipientCc(r.id)} className="ml-0.5 hover:bg-muted rounded p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <Popover open={ccOpen} onOpenChange={setCcOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground px-2">
                        + Adicionar
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-64" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar usuário..." />
                        <CommandList>
                          <CommandEmpty>Nenhum usuário encontrado</CommandEmpty>
                          <CommandGroup>
                            {availableForCc.map(user => (
                              <CommandItem
                                key={user.id}
                                onSelect={() => addRecipientCc(user as Recipient)}
                                className="flex items-center gap-2"
                              >
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={user.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs">{getInitials(user.full_name)}</AvatarFallback>
                                </Avatar>
                                {user.full_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            <Separator />

            {/* Assunto, Categoria e Prioridade em linha */}
            <div className="grid grid-cols-[1fr,140px,120px] gap-3 items-center">
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Assunto..."
                className="h-9"
              />
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Geral</SelectItem>
                  <SelectItem value="layout_request">Solic. Layout</SelectItem>
                  <SelectItem value="layout_delivery">Entrega Layout</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priority} onValueChange={(v) => setPriority(v as 'low' | 'normal' | 'high')}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mensagem */}
                <RichTextEditor
                  value={body}
                  onChange={setBody}
                  placeholder="Digite sua mensagem aqui..."
                  minHeight="280px"
                />

            {/* Anexos */}
            <div className="flex items-center gap-3">
              <label className="cursor-pointer">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  accept="*/*"
                />
                <Button variant="outline" size="sm" className="h-7 text-xs" asChild disabled={uploadAttachment.isPending}>
                  <span>
                    {uploadAttachment.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Paperclip className="h-3 w-3 mr-1" />
                    )}
                    Anexar
                  </span>
                </Button>
              </label>
              {attachments.length > 0 && (
                <div className="flex-1">
                  <EmailAttachmentPreview 
                    attachments={attachments}
                    showRemove
                    onRemove={handleRemoveAttachment}
                    compact
                  />
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => handleSend(true)} 
            disabled={sendEmail.isPending}
          >
            Salvar Rascunho
          </Button>
          <Button 
            onClick={() => handleSend(false)} 
            disabled={sendEmail.isPending}
            className="gap-2"
          >
            {sendEmail.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
