import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Send, Loader2, FileText, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PDFDocumentData, useGeneratePDF } from '@/hooks/useGeneratePDF';
import { sendWhatsAppMessage } from '@/lib/whatsapp/instance-creator';
import { useQueryClient } from '@tanstack/react-query';

interface SendDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentData: PDFDocumentData;
  contactPhone: string;
  channelId: string | null;
  conversationId?: string | null;
  documentId?: string;
}

export function SendDocumentModal({
  open,
  onOpenChange,
  documentData,
  contactPhone,
  channelId,
  conversationId,
  documentId,
}: SendDocumentModalProps) {
  const [message, setMessage] = useState(
    documentData.type === 'order'
      ? `Olá! Segue o pedido #${documentData.number} conforme solicitado.`
      : `Olá! Segue o orçamento #${documentData.number} para sua análise.`
  );
  const [isSending, setIsSending] = useState(false);
  const { generatePDF } = useGeneratePDF();
  const queryClient = useQueryClient();

  const handleSend = async () => {
    if (!channelId) {
      toast.error('Não foi possível identificar o canal do WhatsApp');
      return;
    }

    setIsSending(true);

    try {
      // 1. Generate PDF
      const pdfBlob = await generatePDF(documentData);
      const filename = `${documentData.type === 'order' ? 'pedido' : 'orcamento'}_${documentData.number}.pdf`;

      // 2. Upload to Supabase Storage
      const filePath = `documents/${Date.now()}_${filename}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, pdfBlob, {
          contentType: 'application/pdf',
          cacheControl: '3600',
        });

      if (uploadError) {
        // Try creating the bucket if it doesn't exist
        if (uploadError.message.includes('bucket') || uploadError.message.includes('not found')) {
          toast.error('Bucket de documentos não configurado. Entre em contato com o administrador.');
          return;
        }
        throw uploadError;
      }

      // 3. Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const documentUrl = urlData.publicUrl;

      // 4. Send text message first (if has message)
      if (message.trim()) {
        const textResult = await sendWhatsAppMessage(
          channelId,
          contactPhone,
          message.trim(),
          'text'
        );

        if (!textResult.success) {
          console.error('Error sending text message:', textResult.error);
        }
      }

      // 5. Send document via WhatsApp
      const docResult = await sendWhatsAppMessage(
        channelId,
        contactPhone,
        filename,
        'document',
        documentUrl,
        undefined,
        filename
      );

      if (!docResult.success) {
        throw new Error(docResult.error || 'Falha ao enviar documento');
      }

      // 6. Update quote status to "sent" if it's a quote
      if (documentData.type === 'quote' && documentId) {
        await supabase
          .from('quotes')
          .update({ status: 'sent' })
          .eq('id', documentId);
        
        // Invalidate queries to update UI
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
        queryClient.invalidateQueries({ queryKey: ['quote', documentId] });
        queryClient.invalidateQueries({ queryKey: ['quote-notifications'] });
      }

      toast.success('Documento enviado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error sending document:', error);
      toast.error('Erro ao enviar documento. Tente novamente.');
    } finally {
      setIsSending(false);
    }
  };

  const documentTitle = documentData.type === 'order'
    ? `Pedido #${documentData.number}`
    : `Orçamento #${documentData.number}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Enviar via WhatsApp
          </DialogTitle>
          <DialogDescription>
            Envie o documento diretamente para o cliente pelo WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Document Info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">{documentTitle}</p>
              <p className="text-sm text-muted-foreground">
                Para: {documentData.contact.name}
              </p>
              <p className="text-xs text-muted-foreground">
                Telefone: {contactPhone}
              </p>
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Mensagem (opcional)
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite uma mensagem para enviar junto com o documento..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSending}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending || !channelId}
              className="flex-1"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar
                </>
              )}
            </Button>
          </div>

          {!channelId && (
            <p className="text-xs text-destructive text-center">
              Não há canal de WhatsApp associado a esta conversa
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
