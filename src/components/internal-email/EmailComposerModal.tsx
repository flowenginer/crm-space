import { useState, useEffect } from 'react';
import { X, Paperclip, Loader2, Package, Send, Mail, Users, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
    if (replyTo && replyEmail) {
      const replyPrefix = replyTo.type === 'forward' ? 'Enc: ' : 'Re: ';
      const subjectPrefix = replyEmail.subject.startsWith('Re: ') || replyEmail.subject.startsWith('Enc: ')
        ? ''
        : replyPrefix;
      setSubject(subjectPrefix + replyEmail.subject);

      if (replyTo.type === 'reply' && replyEmail.sender) {
        setRecipientsTo([{
          id: replyEmail.sender.id,
          full_name: replyEmail.sender.full_name,
          avatar_url: replyEmail.sender.avatar_url
        }]);
      } else if (replyTo.type === 'replyAll') {
        // Adiciona o remetente
        const allRecipients: Recipient[] = [];
        if (replyEmail.sender) {
          allRecipients.push({
            id: replyEmail.sender.id,
            full_name: replyEmail.sender.full_name,
            avatar_url: replyEmail.sender.avatar_url
          });
        }
        // Adiciona outros destinatários 'to'
        replyEmail.recipients?.filter(r => r.recipient_type === 'to').forEach(r => {
          if (r.user && !allRecipients.find(ar => ar.id === r.user_id)) {
            allRecipients.push({
              id: r.user.id,
              full_name: r.user.full_name,
              avatar_url: r.user.avatar_url
            });
          }
        });
        setRecipientsTo(allRecipients);

        // Adiciona cc
        const ccRecipients: Recipient[] = [];
        replyEmail.recipients?.filter(r => r.recipient_type === 'cc').forEach(r => {
          if (r.user) {
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

      // Herda prioridade e categoria
      setPriority(replyEmail.priority);
      setCategory(replyEmail.category);
    }
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
    } catch (error) {
      toast.error('Erro ao enviar e-mail');
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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-primary" />
            {getModalTitle()}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            
            {/* Seção: Destinatário */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="h-4 w-4" />
                Destinatário
              </div>

              {/* Caixas Compartilhadas */}
              {sharedBoxes && sharedBoxes.length > 0 && (
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Enviar para Caixa Compartilhada
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {sharedBoxes.map(box => (
                      <Button
                        key={box.id}
                        type="button"
                        variant={selectedSharedBox === box.id ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          "transition-all",
                          selectedSharedBox === box.id && "ring-2 ring-primary/20"
                        )}
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
                        <Package className="h-3.5 w-3.5 mr-1.5" />
                        {box.name}
                      </Button>
                    ))}
                  </div>
                  {selectedSharedBox && (
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                      O e-mail será enviado para a caixa compartilhada. Todos os membros poderão ver e assumir.
                    </p>
                  )}
                </div>
              )}

              {/* Separador visual */}
              {sharedBoxes && sharedBoxes.length > 0 && !selectedSharedBox && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      ou para pessoas
                    </span>
                  </div>
                </div>
              )}

              {/* Para - só mostra se não selecionou caixa compartilhada */}
              {!selectedSharedBox && (
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Para</Label>
                    {!showCc && (
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowCc(true)}>
                        + Cc
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 min-h-[36px]">
                    {recipientsTo.map(r => (
                      <Badge key={r.id} variant="secondary" className="gap-1.5 pr-1 py-1">
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
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
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
                                  <Avatar className="h-6 w-6">
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

                  {/* Cc */}
                  {showCc && (
                    <>
                      <Separator className="my-2" />
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cc</Label>
                        <div className="flex flex-wrap items-center gap-2 min-h-[36px]">
                          {recipientsCc.map(r => (
                            <Badge key={r.id} variant="secondary" className="gap-1.5 pr-1 py-1">
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
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
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
                                        <Avatar className="h-6 w-6">
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
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Seção: Conteúdo */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4" />
                Conteúdo
              </div>

              <div className="rounded-lg border bg-card p-4 space-y-4">
                {/* Assunto */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Assunto</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Digite o assunto do e-mail..."
                    className="bg-background"
                  />
                </div>

                {/* Opções em linha */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Categoria</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">Geral</SelectItem>
                        <SelectItem value="layout_request">Solicitação de Layout</SelectItem>
                        <SelectItem value="layout_delivery">Entrega de Layout</SelectItem>
                        <SelectItem value="production">Produção</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Prioridade</Label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as 'low' | 'normal' | 'high')}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Mensagem */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Mensagem</Label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Digite sua mensagem aqui..."
                    className="min-h-[160px] bg-background resize-none"
                  />
                </div>

                {/* Anexos */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Anexos</Label>
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
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Adicionar
                        </span>
                      </Button>
                    </label>
                  </div>
                  {attachments.length > 0 && (
                    <EmailAttachmentPreview 
                      attachments={attachments}
                      showRemove
                      onRemove={handleRemoveAttachment}
                      compact
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
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
