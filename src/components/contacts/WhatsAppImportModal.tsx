import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, FileArchive, AlertCircle, CheckCircle2, User, Loader2, MessageSquare, Image, Music, Video, FileText, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useWhatsAppImport, type ParsedMessage } from '@/hooks/useWhatsAppImport';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WhatsAppImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: {
    id: string;
    full_name: string;
    phone: string;
  };
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

export function WhatsAppImportModal({ open, onOpenChange, contact }: WhatsAppImportModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('upload');
  const [selectedSender, setSelectedSender] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [importResult, setImportResult] = useState<{ messagesImported: number; mediaUploaded: number; errors: string[] } | null>(null);
  
  const {
    isProcessing,
    progress,
    parsedMessages,
    senders,
    processZipFile,
    importMessages,
    reset,
  } = useWhatsAppImport();

  const handleClose = useCallback(() => {
    reset();
    setStep('upload');
    setSelectedSender('');
    setImportResult(null);
    onOpenChange(false);
  }, [reset, onOpenChange]);

  const handleFileDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFileSelect(file);
    }
  }, []);

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      toast.error('Por favor, selecione um arquivo .zip exportado do WhatsApp');
      return;
    }
    
    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      toast.error('Arquivo muito grande. O limite é 100MB.');
      return;
    }
    
    try {
      await processZipFile(file);
      setStep('preview');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao processar arquivo');
    }
  };

  const handleImport = async () => {
    if (!selectedSender) {
      toast.error('Selecione quem é você na conversa');
      return;
    }
    
    setStep('importing');
    
    try {
      // Buscar ou criar conversa
      let conversationId: string;
      
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        // Criar nova conversa
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert({
            contact_id: contact.id,
            status: 'open',
            assigned_to: user?.id,
            is_unread: false,
            unread_count: 0,
          })
          .select('id')
          .single();
        
        if (createError) throw createError;
        conversationId = newConv.id;
      }
      
      const result = await importMessages(conversationId, contact.id, selectedSender);
      setImportResult(result);
      setStep('done');
      
      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      
      if (result.errors.length === 0) {
        toast.success(`${result.messagesImported} mensagens importadas com sucesso!`);
      } else {
        toast.warning(`${result.messagesImported} mensagens importadas, ${result.errors.length} erros`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao importar mensagens');
      setStep('preview');
    }
  };

  const getMessageIcon = (msg: ParsedMessage) => {
    if (!msg.isMedia) return <MessageSquare size={14} className="text-muted-foreground" />;
    switch (msg.mediaType) {
      case 'image': return <Image size={14} className="text-blue-500" />;
      case 'audio': return <Music size={14} className="text-green-500" />;
      case 'video': return <Video size={14} className="text-purple-500" />;
      default: return <FileText size={14} className="text-orange-500" />;
    }
  };

  const mediaCount = parsedMessages.filter(m => m.isMedia).length;
  const progressPercent = progress ? (progress.current / Math.max(progress.total, 1)) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5 text-primary" />
            Importar Conversa do WhatsApp
          </DialogTitle>
          <DialogDescription>
            Importar mensagens para: <span className="font-medium text-foreground">{contact.full_name}</span> ({contact.phone})
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Instructions */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                <h4 className="font-medium text-sm">Como exportar do WhatsApp:</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Abra a conversa no WhatsApp</li>
                  <li>Toque nos três pontos → "Mais" → "Exportar conversa"</li>
                  <li>Selecione "Incluir mídia" para exportar fotos, áudios e vídeos</li>
                  <li>Salve o arquivo .zip e faça upload aqui</li>
                </ol>
              </div>

              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  dragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleFileDrop}
              >
                {isProcessing ? (
                  <div className="space-y-4">
                    <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">{progress?.message || 'Processando...'}</p>
                    <Progress value={progressPercent} className="max-w-xs mx-auto" />
                  </div>
                ) : (
                  <>
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Arraste o arquivo .zip aqui ou clique para selecionar
                    </p>
                    <label>
                      <input
                        type="file"
                        accept=".zip"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                      />
                      <Button type="button" variant="outline" asChild>
                        <span className="cursor-pointer">Selecionar arquivo</span>
                      </Button>
                    </label>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{parsedMessages.length}</div>
                  <div className="text-sm text-muted-foreground">Mensagens</div>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-blue-500">{mediaCount}</div>
                  <div className="text-sm text-muted-foreground">Mídias</div>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-500">{senders.length}</div>
                  <div className="text-sm text-muted-foreground">Participantes</div>
                </div>
              </div>

              {/* Sender selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Quem é você nesta conversa?</label>
                <div className="grid grid-cols-2 gap-2">
                  {senders.map((sender) => (
                    <button
                      key={sender}
                      onClick={() => setSelectedSender(sender)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                        selectedSender === sender
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        selectedSender === sender ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        <User size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{sender}</div>
                        <div className="text-xs text-muted-foreground">
                          {parsedMessages.filter(m => m.sender === sender).length} mensagens
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {!selectedSender && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle size={12} />
                    Selecione para identificar quais mensagens são suas
                  </p>
                )}
              </div>

              {/* Message preview */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Prévia das mensagens:</label>
                <div className="bg-muted/30 rounded-xl border border-border max-h-[200px] overflow-y-auto">
                  {parsedMessages.slice(0, 20).map((msg, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-start gap-2 p-2 text-xs border-b border-border/50 last:border-0 ${
                        msg.sender === selectedSender ? 'bg-primary/5' : ''
                      }`}
                    >
                      {getMessageIcon(msg)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{msg.sender}</span>
                          <span className="text-muted-foreground shrink-0">
                            {format(msg.timestamp, "dd/MM/yy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-muted-foreground truncate">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {parsedMessages.length > 20 && (
                    <div className="p-2 text-center text-xs text-muted-foreground">
                      ... e mais {parsedMessages.length - 20} mensagens
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 'importing' && (
            <div className="py-8 space-y-6 text-center">
              <Loader2 className="h-16 w-16 mx-auto animate-spin text-primary" />
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Importando mensagens...</h3>
                <p className="text-sm text-muted-foreground">{progress?.message}</p>
              </div>
              <Progress value={progressPercent} className="max-w-md mx-auto" />
              <p className="text-xs text-muted-foreground">
                {progress?.current || 0} de {progress?.total || 0}
              </p>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && importResult && (
            <div className="py-8 space-y-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Importação concluída!</h3>
                <p className="text-sm text-muted-foreground">
                  As mensagens foram adicionadas à conversa de {contact.full_name}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{importResult.messagesImported}</div>
                  <div className="text-sm text-muted-foreground">Mensagens</div>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-blue-500">{importResult.mediaUploaded}</div>
                  <div className="text-sm text-muted-foreground">Mídias</div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="text-left max-w-md mx-auto">
                  <details className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3">
                    <summary className="text-sm font-medium text-amber-700 dark:text-amber-400 cursor-pointer">
                      {importResult.errors.length} avisos durante a importação
                    </summary>
                    <ul className="mt-2 text-xs text-amber-600 dark:text-amber-500 space-y-1 max-h-32 overflow-y-auto">
                      {importResult.errors.map((err, idx) => (
                        <li key={idx}>• {err}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}
          
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => { reset(); setStep('upload'); }}>
                Voltar
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={!selectedSender || isProcessing}
              >
                Importar {parsedMessages.length} mensagens
              </Button>
            </>
          )}
          
          {step === 'done' && (
            <Button onClick={handleClose}>
              Fechar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
