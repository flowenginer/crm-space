import { useState, useCallback } from 'react';
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ParsedMessage {
  timestamp: Date;
  sender: string;
  content: string;
  isMedia: boolean;
  mediaFileName?: string;
  mediaType?: 'image' | 'audio' | 'video' | 'document';
}

export interface ImportProgress {
  step: 'extracting' | 'parsing' | 'uploading' | 'inserting' | 'done' | 'error';
  current: number;
  total: number;
  message: string;
}

export interface ImportResult {
  messagesImported: number;
  mediaUploaded: number;
  errors: string[];
}

// Detectar tipo de mídia pelo nome do arquivo
const getMediaType = (fileName: string): 'image' | 'audio' | 'video' | 'document' => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (['opus', 'mp3', 'ogg', 'wav', 'm4a', 'aac'].includes(ext)) return 'audio';
  if (['mp4', 'mov', 'avi', 'mkv', '3gp'].includes(ext)) return 'video';
  return 'document';
};

// Detectar MIME type
const getMimeType = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    opus: 'audio/ogg',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    '3gp': 'video/3gpp',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return mimeMap[ext] || 'application/octet-stream';
};

export function useWhatsAppImport() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [parsedMessages, setParsedMessages] = useState<ParsedMessage[]>([]);
  const [senders, setSenders] = useState<string[]>([]);
  const [zipFile, setZipFile] = useState<JSZip | null>(null);
  const [mediaFiles, setMediaFiles] = useState<Map<string, JSZip.JSZipObject>>(new Map());

  // Parse do arquivo .txt do WhatsApp
  const parseWhatsAppText = useCallback((text: string): ParsedMessage[] => {
    const messages: ParsedMessage[] = [];
    const lines = text.split('\n');
    
    // Regex para diferentes formatos do WhatsApp
    // Formato brasileiro: [DD/MM/YYYY, HH:MM:SS] Sender: Content
    // Formato alternativo: DD/MM/YYYY HH:MM - Sender: Content
    const regexBR = /^\[(\d{2}\/\d{2}\/\d{4}),?\s+(\d{2}:\d{2}(?::\d{2})?)\]\s+([^:]+):\s+(.*)$/;
    const regexAlt = /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s+-\s+([^:]+):\s+(.*)$/;
    
    // Regex para detectar mídia
    const mediaRegexBR = /<anexo:\s*([^>]+)>/i;
    const mediaRegexEN = /<attached:\s*([^>]+)>/i;
    const mediaRegexPTFile = /arquivo omitido|mídia omitida|media omitted/i;
    // Formato brasileiro: "ARQUIVO.ext (arquivo anexado)" - com possível caractere invisível no início
    const mediaRegexBRNew = /[\u200E\u200F\u202A-\u202E]?([A-Za-z0-9_\-]+\.(opus|mp3|ogg|wav|m4a|aac|jpg|jpeg|png|gif|webp|mp4|mov|avi|mkv|3gp|pdf|doc|docx))\s*\(arquivo anexado\)/i;
    
    let currentMessage: ParsedMessage | null = null;
    
    for (const line of lines) {
      const matchBR = line.match(regexBR);
      const matchAlt = line.match(regexAlt);
      const match = matchBR || matchAlt;
      
      if (match) {
        // Salvar mensagem anterior se existir
        if (currentMessage) {
          messages.push(currentMessage);
        }
        
        const [, dateStr, timeStr, sender, content] = match;
        
        // Parse da data (formato brasileiro DD/MM/YYYY)
        const [day, month, year] = dateStr.split('/').map(Number);
        const timeParts = timeStr.split(':').map(Number);
        const hours = timeParts[0];
        const minutes = timeParts[1];
        const seconds = timeParts[2] || 0;
        
        const timestamp = new Date(year, month - 1, day, hours, minutes, seconds);
        
        // Verificar se é mídia - tentar todos os formatos
        const mediaMatchBR = content.match(mediaRegexBR);
        const mediaMatchEN = content.match(mediaRegexEN);
        const mediaMatchBRNew = content.match(mediaRegexBRNew);
        const mediaMatch = mediaMatchBR || mediaMatchEN || mediaMatchBRNew;
        const isOmittedMedia = mediaRegexPTFile.test(content);
        
        currentMessage = {
          timestamp,
          sender: sender.trim(),
          content: content.trim(),
          isMedia: !!mediaMatch || isOmittedMedia,
          mediaFileName: mediaMatch ? mediaMatch[1].trim() : undefined,
          mediaType: mediaMatch ? getMediaType(mediaMatch[1].trim()) : undefined,
        };
      } else if (currentMessage && line.trim()) {
        // Linha de continuação da mensagem anterior
        currentMessage.content += '\n' + line;
      }
    }
    
    // Adicionar última mensagem
    if (currentMessage) {
      messages.push(currentMessage);
    }
    
    return messages;
  }, []);

  // Extrair e processar o arquivo ZIP
  const processZipFile = useCallback(async (file: File): Promise<{ messages: ParsedMessage[], senders: string[] }> => {
    setIsProcessing(true);
    setProgress({ step: 'extracting', current: 0, total: 100, message: 'Extraindo arquivo ZIP...' });
    
    try {
      const zip = await JSZip.loadAsync(file);
      setZipFile(zip);
      
      // Encontrar o arquivo de chat
      let chatFile: JSZip.JSZipObject | null = null;
      const mediaMap = new Map<string, JSZip.JSZipObject>();
      
      for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;
        
        const fileName = path.split('/').pop() || '';
        
        if (fileName.endsWith('.txt') && (fileName.includes('chat') || fileName.startsWith('_chat') || fileName.includes('WhatsApp'))) {
          chatFile = zipEntry;
        } else {
          // Armazenar arquivos de mídia
          mediaMap.set(fileName, zipEntry);
        }
      }
      
      if (!chatFile) {
        throw new Error('Arquivo de chat (.txt) não encontrado no ZIP. Certifique-se de exportar a conversa corretamente do WhatsApp.');
      }
      
      setMediaFiles(mediaMap);
      
      setProgress({ step: 'parsing', current: 50, total: 100, message: 'Analisando mensagens...' });
      
      const chatText = await chatFile.async('text');
      const messages = parseWhatsAppText(chatText);
      
      if (messages.length === 0) {
        throw new Error('Nenhuma mensagem encontrada no arquivo. Verifique o formato do arquivo exportado.');
      }
      
      // Extrair lista única de remetentes
      const uniqueSenders = [...new Set(messages.map(m => m.sender))];
      
      setParsedMessages(messages);
      setSenders(uniqueSenders);
      
      setProgress({ step: 'done', current: 100, total: 100, message: 'Arquivo processado!' });
      
      return { messages, senders: uniqueSenders };
    } catch (error: any) {
      setProgress({ step: 'error', current: 0, total: 0, message: error.message });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [parseWhatsAppText]);

  // Importar mensagens para o banco
  const importMessages = useCallback(async (
    conversationId: string,
    contactId: string,
    mySenderName: string,
  ): Promise<ImportResult> => {
    setIsProcessing(true);
    
    const result: ImportResult = {
      messagesImported: 0,
      mediaUploaded: 0,
      errors: [],
    };
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const totalMessages = parsedMessages.length;
      const messagesWithMedia = parsedMessages.filter(m => m.isMedia && m.mediaFileName);
      
      // Fase 1: Upload de mídias
      setProgress({ step: 'uploading', current: 0, total: messagesWithMedia.length, message: 'Enviando arquivos de mídia...' });
      
      const mediaUrls = new Map<string, string>();
      
      for (let i = 0; i < messagesWithMedia.length; i++) {
        const msg = messagesWithMedia[i];
        if (!msg.mediaFileName) continue;
        
        const mediaFile = mediaFiles.get(msg.mediaFileName);
        if (!mediaFile) {
          result.errors.push(`Arquivo não encontrado: ${msg.mediaFileName}`);
          continue;
        }
        
        try {
          const blob = await mediaFile.async('blob');
          const filePath = `imported/${conversationId}/${Date.now()}_${msg.mediaFileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('conversation-attachments')
            .upload(filePath, blob, {
              contentType: getMimeType(msg.mediaFileName),
            });
          
          if (uploadError) {
            result.errors.push(`Erro ao enviar ${msg.mediaFileName}: ${uploadError.message}`);
          } else {
            const { data: urlData } = supabase.storage
              .from('conversation-attachments')
              .getPublicUrl(filePath);
            
            mediaUrls.set(msg.mediaFileName, urlData.publicUrl);
            result.mediaUploaded++;
          }
        } catch (err: any) {
          result.errors.push(`Erro ao processar ${msg.mediaFileName}: ${err.message}`);
        }
        
        setProgress({ 
          step: 'uploading', 
          current: i + 1, 
          total: messagesWithMedia.length, 
          message: `Enviando mídia ${i + 1} de ${messagesWithMedia.length}...` 
        });
      }
      
      // Fase 2: Inserir mensagens
      setProgress({ step: 'inserting', current: 0, total: totalMessages, message: 'Importando mensagens...' });
      
      // Preparar mensagens para inserção em lotes
      const batchSize = 50;
      const messagesToInsert = parsedMessages.map(msg => {
        const isFromMe = msg.sender === mySenderName;
        const mediaUrl = msg.mediaFileName ? mediaUrls.get(msg.mediaFileName) : undefined;
        
        // Determinar tipo de mensagem
        let messageType = 'text';
        if (msg.isMedia && msg.mediaType) {
          messageType = msg.mediaType;
        }
        
        // Limpar conteúdo de mídia (remover todos os formatos conhecidos)
        let content = msg.content;
        if (msg.isMedia) {
          content = content
            .replace(/<anexo:\s*[^>]+>/i, '')
            .replace(/<attached:\s*[^>]+>/i, '')
            .replace(/[\u200E\u200F\u202A-\u202E]?[A-Za-z0-9_\-]+\.(opus|mp3|ogg|wav|m4a|aac|jpg|jpeg|png|gif|webp|mp4|mov|avi|mkv|3gp|pdf|doc|docx)\s*\(arquivo anexado\)/i, '')
            .trim();
          if (!content) content = msg.mediaFileName || `[${messageType}]`;
        }
        
        return {
          conversation_id: conversationId,
          contact_id: isFromMe ? null : contactId,
          sender_id: isFromMe ? user.id : null,
          is_from_me: isFromMe,
          content,
          message_type: messageType,
          media_url: mediaUrl || null,
          media_mime_type: msg.mediaFileName ? getMimeType(msg.mediaFileName) : null,
          status: 'delivered',
          created_at: msg.timestamp.toISOString(),
        };
      });
      
      // Inserir em lotes
      for (let i = 0; i < messagesToInsert.length; i += batchSize) {
        const batch = messagesToInsert.slice(i, i + batchSize);
        
        const { error: insertError } = await supabase
          .from('messages')
          .insert(batch);
        
        if (insertError) {
          result.errors.push(`Erro ao inserir lote ${Math.floor(i / batchSize) + 1}: ${insertError.message}`);
        } else {
          result.messagesImported += batch.length;
        }
        
        setProgress({ 
          step: 'inserting', 
          current: Math.min(i + batchSize, totalMessages), 
          total: totalMessages, 
          message: `Importando mensagem ${Math.min(i + batchSize, totalMessages)} de ${totalMessages}...` 
        });
      }
      
      // Atualizar conversa com última mensagem
      if (result.messagesImported > 0) {
        const lastMessage = parsedMessages[parsedMessages.length - 1];
        await supabase
          .from('conversations')
          .update({
            last_message_at: lastMessage.timestamp.toISOString(),
            last_message_preview: lastMessage.content.substring(0, 100),
            updated_at: new Date().toISOString(),
          })
          .eq('id', conversationId);
      }
      
      setProgress({ step: 'done', current: totalMessages, total: totalMessages, message: 'Importação concluída!' });
      
      return result;
    } catch (error: any) {
      setProgress({ step: 'error', current: 0, total: 0, message: error.message });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [parsedMessages, mediaFiles]);

  // Reset do estado
  const reset = useCallback(() => {
    setIsProcessing(false);
    setProgress(null);
    setParsedMessages([]);
    setSenders([]);
    setZipFile(null);
    setMediaFiles(new Map());
  }, []);

  return {
    isProcessing,
    progress,
    parsedMessages,
    senders,
    processZipFile,
    importMessages,
    reset,
  };
}
