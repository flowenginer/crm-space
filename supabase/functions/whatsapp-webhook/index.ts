import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://esm.sh/base64-arraybuffer@1.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type WhatsAppProvider = "zapi" | "uazapi" | "evolution";
type MessageType = "text" | "image" | "audio" | "video" | "document" | "sticker" | "location" | "contact" | "contacts";

// =====================================================
// REFERRAL DATA - Meta Ads / Click-to-WhatsApp
// =====================================================
interface ReferralData {
  ctwaClid?: string;        // Click-to-WhatsApp Click ID
  sourceId?: string;        // ID do anúncio/post
  sourceType?: string;      // 'ad' | 'post'
  sourceUrl?: string;       // URL do anúncio
  headline?: string;        // Título do anúncio
  body?: string;            // Texto do anúncio
  mediaType?: string;       // 'image' | 'video'
  imageUrl?: string;        // URL da imagem
  videoUrl?: string;        // URL do vídeo
  thumbnailUrl?: string;    // URL da thumbnail
  showAdAttribution?: boolean;
  adName?: string;          // Nome do anúncio
  campaignName?: string;    // Nome da campanha
  // Campos UAZAPI para Meta Ads
  sourceApp?: string;           // "instagram" | "facebook"
  conversionSource?: string;    // "FB_Ads"
  ctwaPayload?: string;         // Payload completo base64
  greetingMessageBody?: string; // Mensagem de saudação do anúncio
}

interface NormalizedMessage {
  id: string;
  provider: WhatsAppProvider;
  instanceId: string;
  from: string;
  fromName?: string;
  isFromMe: boolean;
  type: MessageType;
  content: string;
  mediaUrl?: string;
  mediaBase64?: string;
  mediaMimeType?: string;
  caption?: string;
  timestamp: Date;
  quotedMessageId?: string;
  status: string;
  originalId: string;
  referralData?: ReferralData;
  isEdited?: boolean;  // Flag para mensagens editadas pelo cliente
}

// =====================================================
// PHONE VALIDATION FUNCTIONS
// =====================================================

/**
 * Cleans WhatsApp JID removing session suffixes like :0, :1 etc
 * that Evolution API sometimes appends to phone numbers.
 * 
 * Example: 559591111981:0@s.whatsapp.net -> 559591111981
 * 
 * CRITICAL: This must be called BEFORE replace(/\D/g, '') otherwise
 * the :0 becomes just 0 and gets appended to the phone number,
 * causing contact duplication (e.g., 5595911119810 instead of 559591111981)
 */
function cleanWhatsAppJid(rawJid: string): string {
  return rawJid
    // Remove session suffix (:0, :1, :2, etc) - MUST be first!
    .replace(/:\d+(@s\.whatsapp\.net|@c\.us)?$/, '')
    // Remove WhatsApp domains
    .replace("@s.whatsapp.net", "")
    .replace("@c.us", "")
    .replace("@lid", "");
}

/**
 * Validates if a phone number is a valid Brazilian phone
 * Brazilian phones: start with 55, have 12-13 digits total
 * This filters out LID (Linked IDs) from Evolution API
 */
function isValidBrazilianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  
  // Must start with 55 (Brazil country code)
  if (!digits.startsWith('55')) {
    return false;
  }
  
  // Must have 12-13 digits (55 + 10-11 local digits)
  if (digits.length < 12 || digits.length > 13) {
    return false;
  }
  
  return true;
}

/**
 * Attempts to extract a valid Brazilian phone from various payload locations
 * Returns the phone number or null if no valid phone found
 * 
 * IMPORTANT: Uses cleanWhatsAppJid to remove session suffixes (:0, :1)
 * BEFORE extracting digits, preventing phone duplication issues
 */
function extractValidPhoneFromPayload(msg: any, rawRemoteJid: string): string | null {
  // Priority 1: remoteJidAlt (real number when LID is used)
  if (msg.key?.remoteJidAlt) {
    // Clean JID first to remove :0 suffix, then extract digits
    const altPhone = cleanWhatsAppJid(msg.key.remoteJidAlt).replace(/\D/g, "");
    
    if (isValidBrazilianPhone(altPhone)) {
      console.log(`[Webhook] Found valid phone in remoteJidAlt: ${altPhone}`);
      return altPhone;
    }
  }
  
  // Priority 2: Main remoteJid
  // CRITICAL: Use cleanWhatsAppJid to remove :0 suffix before extracting digits
  const mainPhone = cleanWhatsAppJid(rawRemoteJid).replace(/\D/g, "");
  
  if (isValidBrazilianPhone(mainPhone)) {
    return mainPhone;
  }
  
  // Priority 3: Check referral data for phone (Meta Ads sometimes includes it)
  if (msg.contextInfo?.referral?.phone) {
    const referralPhone = msg.contextInfo.referral.phone.replace(/\D/g, "");
    if (isValidBrazilianPhone(referralPhone)) {
      console.log(`[Webhook] Found valid phone in referral data: ${referralPhone}`);
      return referralPhone;
    }
  }
  
  // No valid phone found
  return null;
}

// =====================================================
// PHONE NORMALIZATION FUNCTIONS (para evitar duplicados)
// =====================================================

/**
 * Gera variações do telefone para busca (com/sem 9º dígito, com/sem código do país)
 * REGRA CELULAR BRASILEIRO: Celulares começam com 6, 7, 8 ou 9 no primeiro dígito após DDD
 */
function generatePhoneVariationsBR(phone: string): string[] {
  const variations: string[] = [];
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (!cleanPhone) return [phone];
  
  variations.push(cleanPhone);
  
  // Com/sem código do país
  if (cleanPhone.startsWith('55')) {
    variations.push(cleanPhone.slice(2));
  } else {
    variations.push(`55${cleanPhone}`);
  }
  
  // Variações do 9º dígito (celulares brasileiros)
  const hasCountry = cleanPhone.startsWith('55');
  const ddd = hasCountry ? cleanPhone.slice(2, 4) : cleanPhone.slice(0, 2);
  const rest = hasCountry ? cleanPhone.slice(4) : cleanPhone.slice(2);
  
  // Se tem 9 dígitos após o DDD e começa com 9, gerar versão sem o 9
  if (rest.length === 9 && rest.startsWith('9')) {
    const without9 = rest.slice(1);
    variations.push(`55${ddd}${without9}`);
    variations.push(`${ddd}${without9}`);
  }
  
  // CORREÇÃO: Se tem 8 dígitos após o DDD e começa com [6-9], é celular - gerar versão com 9
  if (rest.length === 8 && /^[6-9]/.test(rest)) {
    variations.push(`55${ddd}9${rest}`);
    variations.push(`${ddd}9${rest}`);
  }
  
  return [...new Set(variations)];
}

/**
 * Normaliza telefone para formato padrão de armazenamento (55 + DDD + número)
 * REGRA: Celulares BR (começando com 6-9 após DDD) devem ter 9 dígitos
 * Se recebemos 8 dígitos começando com [6-9], adicionamos o 9 na frente
 */
function normalizePhoneForStorageBR(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  
  // Remover zeros à esquerda que não sejam parte do código do país
  if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }
  
  // Adicionar código do país se não tiver
  if (!digits.startsWith('55') && digits.length >= 10 && digits.length <= 11) {
    digits = `55${digits}`;
  }
  
  // Para celulares brasileiros (55 + DDD + 8 dígitos)
  // Adicionar 9 se o bloco de 8 dígitos começar com [6-9] (celular sem o nono dígito)
  if (digits.startsWith('55') && digits.length === 12) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 8 && /^[6-9]/.test(rest)) {
      digits = `55${ddd}9${rest}`;
      console.log(`[Webhook] Normalizing phone: added 9th digit: ${ddd}${rest} -> ${ddd}9${rest}`);
    }
  }
  
  return digits;
}

// =====================================================
// MEDIA UPLOAD FUNCTIONS
// =====================================================

function getExtensionFromMimetype(mimetype: string, originalFilename?: string): string {
  // Se temos o nome original do arquivo, extrair extensão dele
  if (originalFilename) {
    const match = originalFilename.match(/\.([a-zA-Z0-9]+)$/);
    if (match) {
      return match[1].toLowerCase();
    }
  }
  
  const mimeMap: Record<string, string> = {
    // Audio
    'audio/ogg': 'ogg',
    'audio/ogg; codecs=opus': 'ogg',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/aac': 'aac',
    'audio/flac': 'flac',
    // Images
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/svg+xml': 'svg',
    'image/x-icon': 'ico',
    // Video
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/3gpp': '3gp',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/x-matroska': 'mkv',
    // Documents
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'text/html': 'html',
    'application/json': 'json',
    'application/xml': 'xml',
    'application/rtf': 'rtf',
    // Archives
    'application/zip': 'zip',
    'application/x-zip-compressed': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/vnd.rar': 'rar',
    'application/x-7z-compressed': '7z',
    'application/x-tar': 'tar',
    'application/gzip': 'gz',
    'application/x-gzip': 'gz',
    // Design files
    'image/vnd.adobe.photoshop': 'psd',
    'application/photoshop': 'psd',
    'application/psd': 'psd',
    'application/x-photoshop': 'psd',
    'image/x-coreldraw': 'cdr',
    'application/cdr': 'cdr',
    'application/x-cdr': 'cdr',
    'application/coreldraw': 'cdr',
    'application/illustrator': 'ai',
    'application/postscript': 'eps',
    'application/x-indesign': 'indd',
    // CAD
    'application/x-dwg': 'dwg',
    'image/vnd.dwg': 'dwg',
    'application/dxf': 'dxf',
    'image/vnd.dxf': 'dxf',
    // Fonts
    'font/ttf': 'ttf',
    'font/otf': 'otf',
    'application/x-font-ttf': 'ttf',
    'application/x-font-otf': 'otf',
    'font/woff': 'woff',
    'font/woff2': 'woff2',
    // Executables and others
    'application/x-msdownload': 'exe',
    'application/octet-stream': 'bin', // Generic binary fallback
  };
  
  // Clean mimetype (remove params like "; codecs=opus")
  const cleanMime = mimetype.split(';')[0].trim().toLowerCase();
  return mimeMap[mimetype] || mimeMap[cleanMime] || 'bin';
}

async function uploadMediaToStorage(
  supabase: any,
  base64Data: string,
  mimetype: string,
  conversationId: string
): Promise<string | null> {
  try {
    console.log(`[Webhook] Uploading media to storage - Mimetype: ${mimetype}, ConversationId: ${conversationId}`);
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const extension = getExtensionFromMimetype(mimetype);
    const fileName = `${timestamp}_${randomId}.${extension}`;
    const filePath = `${conversationId}/${fileName}`;
    
    // Decode base64 to ArrayBuffer
    const buffer = decode(base64Data);
    
    console.log(`[Webhook] Decoded base64, size: ${buffer.byteLength} bytes`);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('conversation-attachments')
      .upload(filePath, buffer, {
        contentType: mimetype.split(';')[0].trim(), // Clean mimetype
        upsert: false
      });
    
    if (error) {
      console.error('[Webhook] Storage upload error:', error);
      return null;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('conversation-attachments')
      .getPublicUrl(filePath);
    
    console.log(`[Webhook] Media uploaded successfully: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error) {
    console.error('[Webhook] Error uploading media:', error);
    return null;
  }
}

// =====================================================
// FETCH MEDIA FROM UAZAPI
// =====================================================

/**
 * Download media from UAZAPI using their /message/download endpoint
 * UAZAPI doesn't provide media URLs directly - we need to download using messageid
 */
/**
 * Download media from UAZAPI using their /message/download endpoint
 * UAZAPI doesn't provide media URLs directly - we need to download using messageid
 * 
 * Includes automatic retry for failed downloads (important for larger videos)
 */
async function downloadUAZAPIMedia(
  baseUrl: string,
  instanceToken: string,
  messageId: string
): Promise<{ success: boolean; base64?: string; mimeType?: string; error?: string }> {
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 1500; // 1.5 seconds between retries
  
  // Normalize base URL
  const normalizedUrl = baseUrl.replace(/\/+$/, '');
  
  console.log(`[Webhook UAZAPI] Downloading media for messageId: ${messageId}`);
  
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const response = await fetch(`${normalizedUrl}/message/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'token': instanceToken,
        },
        body: JSON.stringify({
          id: messageId,
          return_base64: true,  // Get base64 for storage upload
          generate_mp3: true,   // Convert audio to mp3 for compatibility
          return_link: false,
          transcribe: false,
          download_quoted: false,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Webhook UAZAPI] Media download failed (attempt ${attempt}): ${response.status} - ${errorText}`);
        
        // Retry on server errors (5xx) or timeout-like errors
        if (attempt <= MAX_RETRIES && (response.status >= 500 || response.status === 408)) {
          console.log(`[Webhook UAZAPI] Retrying in ${RETRY_DELAY_MS}ms...`);
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }
      
      const data = await response.json();
      
      // UAZAPI returns base64 in different fields depending on version
      const base64Data = data.base64Data || data.base64 || data.data || data.file;
      const mimeType = data.mimeType || data.mimetype || data.contentType || 'application/octet-stream';
      
      if (base64Data) {
        console.log(`[Webhook UAZAPI] ✅ Media downloaded (attempt ${attempt}) - Base64 length: ${base64Data.length}, MimeType: ${mimeType}`);
        return {
          success: true,
          base64: base64Data,
          mimeType: mimeType,
        };
      }
      
      // No data returned - retry if possible
      console.log(`[Webhook UAZAPI] ⚠️ Media download returned no data (attempt ${attempt}):`, JSON.stringify(data).substring(0, 200));
      
      if (attempt <= MAX_RETRIES) {
        console.log(`[Webhook UAZAPI] Retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      
      return { success: false, error: 'No media data returned after retries' };
    } catch (error) {
      console.error(`[Webhook UAZAPI] Error downloading media (attempt ${attempt}):`, error);
      
      if (attempt <= MAX_RETRIES) {
        console.log(`[Webhook UAZAPI] Retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      
      return { success: false, error: String(error) };
    }
  }
  
  return { success: false, error: 'Max retries exceeded' };
}

/**
 * Get UAZAPI channel credentials for media download
 * IMPORTANTE: Usa busca flexível (ILIKE) e busca base_url do provider
 */
async function getUAZAPIChannelCredentials(
  supabase: any,
  instanceName: string
): Promise<{ baseUrl: string; instanceToken: string } | null> {
  try {
    console.log(`[Webhook UAZAPI] Looking for channel credentials - instanceName: "${instanceName}"`);
    
    // Normalizar o instanceName para busca (remover espaços, lowercase, etc.)
    const normalizedName = instanceName.replace(/\s+/g, '-').toLowerCase();
    console.log(`[Webhook UAZAPI] Normalized name for search: "${normalizedName}"`);
    
    // Busca flexível usando ILIKE para encontrar por instance_id ou name
    const { data: channels, error } = await supabase
      .from('whatsapp_channels')
      .select('id, instance_id, instance_token, provider_id, name')
      .eq('is_deleted', false)
      .or(`instance_id.ilike.%${normalizedName}%,name.ilike.%${instanceName}%`);
    
    if (error) {
      console.error(`[Webhook UAZAPI] Error searching for channel:`, error);
      return null;
    }
    
    if (!channels || channels.length === 0) {
      console.log(`[Webhook UAZAPI] ❌ Channel not found with pattern search: instanceName="${instanceName}", normalizedName="${normalizedName}"`);
      return null;
    }
    
    // Usar o primeiro canal encontrado
    const channel = channels[0];
    console.log(`[Webhook UAZAPI] ✅ Found channel: "${channel.name}" (instance_id: ${channel.instance_id}, provider_id: ${channel.provider_id})`);
    
    // Verificar se tem instance_token
    if (!channel.instance_token) {
      console.log(`[Webhook UAZAPI] ⚠️ Channel "${channel.name}" has no instance_token configured`);
      return null;
    }
    
    // Buscar base_url do provider (NÃO está em whatsapp_channels, está em whatsapp_providers)
    const { data: provider, error: providerError } = await supabase
      .from('whatsapp_providers')
      .select('base_url, name')
      .eq('id', channel.provider_id)
      .single();
    
    if (providerError || !provider) {
      console.log(`[Webhook UAZAPI] ❌ Provider not found for provider_id: ${channel.provider_id}`, providerError);
      return null;
    }
    
    if (!provider.base_url) {
      console.log(`[Webhook UAZAPI] ⚠️ Provider "${provider.name}" has no base_url configured`);
      return null;
    }
    
    // Remover barra final do base_url se existir
    const baseUrl = provider.base_url.replace(/\/$/, '');
    
    console.log(`[Webhook UAZAPI] ✅ Got credentials - provider: "${provider.name}", baseUrl: ${baseUrl}, token: ${channel.instance_token?.substring(0, 8)}...`);
    
    return {
      baseUrl,
      instanceToken: channel.instance_token,
    };
  } catch (error) {
    console.error('[Webhook UAZAPI] Error getting channel credentials:', error);
    return null;
  }
}

/**
 * Process UAZAPI media: download from UAZAPI and upload to Supabase Storage
 */
async function processUAZAPIMedia(
  supabase: any,
  instanceName: string,
  messageId: string,
  messageType: MessageType,
  conversationId: string
): Promise<{ mediaUrl?: string; mimeType?: string }> {
  // Only process media types
  if (!['audio', 'image', 'video', 'document'].includes(messageType)) {
    return {};
  }
  
  console.log(`[Webhook UAZAPI] Processing ${messageType} media for message ${messageId}`);
  
  // Get channel credentials
  const credentials = await getUAZAPIChannelCredentials(supabase, instanceName);
  
  if (!credentials) {
    console.log(`[Webhook UAZAPI] ⚠️ Cannot process media - no channel credentials found`);
    return {};
  }
  
  // Download media from UAZAPI
  const mediaResult = await downloadUAZAPIMedia(
    credentials.baseUrl,
    credentials.instanceToken,
    messageId
  );
  
  if (!mediaResult.success || !mediaResult.base64) {
    console.log(`[Webhook UAZAPI] ⚠️ Media download failed: ${mediaResult.error}`);
    return {};
  }
  
  // Upload to Supabase Storage
  const storageUrl = await uploadMediaToStorage(
    supabase,
    mediaResult.base64,
    mediaResult.mimeType || 'application/octet-stream',
    conversationId
  );
  
  if (storageUrl) {
    console.log(`[Webhook UAZAPI] ✅ Media uploaded to Storage: ${storageUrl}`);
    return {
      mediaUrl: storageUrl,
      mimeType: mediaResult.mimeType,
    };
  }
  
  return {};
}

// =====================================================
// FETCH MEDIA FROM EVOLUTION API
// =====================================================

async function fetchMediaBase64FromEvolution(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  messageKey: { id: string; remoteJid: string; fromMe: boolean }
): Promise<{ base64: string | null; mimetype: string | null }> {
  try {
    console.log(`[Webhook] Fetching media base64 from Evolution API for message: ${messageKey.id}`);
    
    // Normalize base URL
    let normalizedUrl = baseUrl.replace(/\/+$/, '');
    if (normalizedUrl.endsWith('/manager')) {
      normalizedUrl = normalizedUrl.replace(/\/manager$/, '');
    }
    
    const response = await fetch(`${normalizedUrl}/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        message: {
          key: messageKey
        },
        convertToMp4: false  // Keep original format (ogg) which is supported by Storage
      })
    });
    
    if (!response.ok) {
      console.error(`[Webhook] Failed to fetch media from Evolution: ${response.status} ${response.statusText}`);
      return { base64: null, mimetype: null };
    }
    
    const data = await response.json();
    console.log(`[Webhook] Media fetched successfully, base64 length: ${data.base64?.length || 0}`);
    
    return {
      base64: data.base64 || null,
      mimetype: data.mimetype || null
    };
  } catch (error) {
    console.error('[Webhook] Error fetching media from Evolution:', error);
    return { base64: null, mimetype: null };
  }
}

function extractEvolutionMediaBase64(msg: any): { base64: string | null; mimetype: string | null } {
  const message = msg.message;
  if (!message) return { base64: null, mimetype: null };
  
  // Check each media type for base64 data
  if (message.audioMessage?.base64) {
    console.log(`[Webhook] Found audio base64, length: ${message.audioMessage.base64.length}`);
    return { 
      base64: message.audioMessage.base64, 
      mimetype: message.audioMessage.mimetype || 'audio/ogg; codecs=opus' 
    };
  }
  if (message.imageMessage?.base64) {
    console.log(`[Webhook] Found image base64, length: ${message.imageMessage.base64.length}`);
    return { 
      base64: message.imageMessage.base64, 
      mimetype: message.imageMessage.mimetype || 'image/jpeg' 
    };
  }
  if (message.videoMessage?.base64) {
    console.log(`[Webhook] Found video base64, length: ${message.videoMessage.base64.length}`);
    return { 
      base64: message.videoMessage.base64, 
      mimetype: message.videoMessage.mimetype || 'video/mp4' 
    };
  }
  if (message.documentMessage?.base64) {
    console.log(`[Webhook] Found document base64, length: ${message.documentMessage.base64.length}`);
    return { 
      base64: message.documentMessage.base64, 
      mimetype: message.documentMessage.mimetype || 'application/octet-stream' 
    };
  }
  if (message.stickerMessage?.base64) {
    console.log(`[Webhook] Found sticker base64, length: ${message.stickerMessage.base64.length}`);
    return { 
      base64: message.stickerMessage.base64, 
      mimetype: message.stickerMessage.mimetype || 'image/webp' 
    };
  }
  
  return { base64: null, mimetype: null };
}

// =====================================================
// EXTRACT REFERRAL DATA - Click-to-WhatsApp / Meta Ads
// =====================================================
function extractReferralData(msg: any): ReferralData | null {
  const message = msg.message;
  if (!message) return null;
  
  // Log para debug - ver estrutura completa do contextInfo
  console.log(`[Webhook] Checking for referral data in message...`);
  
  // Tentar encontrar contextInfo em diferentes locais
  const contextInfo = 
    msg.contextInfo ||
    message.contextInfo ||
    message.extendedTextMessage?.contextInfo ||
    message.messageContextInfo ||
    message.imageMessage?.contextInfo ||
    message.videoMessage?.contextInfo ||
    message.documentMessage?.contextInfo;
  
  if (!contextInfo) return null;
  
  // Log detalhado do contextInfo para debug
  console.log(`[Webhook] contextInfo found:`, JSON.stringify(contextInfo).substring(0, 1000));
  
  // Verificar se há dados de anúncio
  const hasAdData = contextInfo.showAdAttribution || 
                    contextInfo.entryPointConversionSource || 
                    contextInfo.adReplyInfo ||
                    contextInfo.externalAdReply ||
                    contextInfo.ctwaClid;
  
  if (!hasAdData) return null;
  
  // Extrair dados de diferentes formatos do Evolution API
  const entryPoint = contextInfo.entryPointConversionSource || {};
  const adReply = contextInfo.adReplyInfo || contextInfo.externalAdReply || {};
  
  // Log para debug
  console.log(`[Webhook] entryPoint:`, JSON.stringify(entryPoint).substring(0, 500));
  console.log(`[Webhook] adReply:`, JSON.stringify(adReply).substring(0, 500));
  
  // Função auxiliar para validar e extrair URLs (detecta e ignora bytes/objetos binários)
  const extractValidUrl = (...sources: any[]): string | undefined => {
    for (const source of sources) {
      // Verificar se é string válida iniciando com http
      if (typeof source === 'string' && source.startsWith('http')) {
        return source;
      }
      
      // Se for objeto, verificar se é dados binários (bytes) e ignorar
      if (source && typeof source === 'object' && !Array.isArray(source)) {
        const keys = Object.keys(source);
        // Detectar padrão de bytes: objeto com chaves numéricas (0, 1, 2, 3...)
        if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
          console.log(`[Webhook] ⚠️ Ignorando dados binários (bytes) como URL - ${keys.length} bytes detectados`);
          continue;
        }
        
        // Tentar extrair URL de propriedades conhecidas do objeto
        if (typeof source.url === 'string' && source.url.startsWith('http')) {
          return source.url;
        }
      }
    }
    return undefined;
  };
  
  // Função para extrair texto (evitar bytes/objetos)
  const extractText = (...sources: any[]): string | undefined => {
    for (const source of sources) {
      if (typeof source === 'string' && source.length > 0 && source.length < 5000) {
        return source;
      }
    }
    return undefined;
  };
  
  const referralData: ReferralData = {
    ctwaClid: extractText(contextInfo.ctwaClid, entryPoint.ctwaClid),
    sourceId: extractText(entryPoint.sourceId, adReply.sourceId),
    sourceType: extractText(entryPoint.sourceType, adReply.sourceType) || (contextInfo.showAdAttribution ? 'ad' : undefined),
    sourceUrl: extractValidUrl(entryPoint.sourceUrl, adReply.sourceUrl, adReply.url),
    headline: extractText(adReply.headline, adReply.title),
    body: extractText(adReply.body, adReply.description, adReply.text),
    mediaType: extractText(adReply.mediaType),
    // Validar URLs de imagem (evitar salvar bytes como base64)
    imageUrl: extractValidUrl(adReply.thumbnail, adReply.thumbnailUrl, adReply.imageUrl, adReply.previewUrl),
    videoUrl: extractValidUrl(adReply.videoUrl),
    thumbnailUrl: extractValidUrl(adReply.thumbnail, adReply.thumbnailUrl, adReply.previewUrl),
    showAdAttribution: contextInfo.showAdAttribution === true,
    adName: extractText(adReply.adName, adReply.title, adReply.name),
    campaignName: extractText(adReply.campaignName, adReply.campaign),
  };
  
  // Limpar campos undefined
  Object.keys(referralData).forEach(key => {
    if (referralData[key as keyof ReferralData] === undefined) {
      delete referralData[key as keyof ReferralData];
    }
  });
  
  // Verificar se temos pelo menos um dado útil
  if (Object.keys(referralData).length === 0 || 
      (Object.keys(referralData).length === 1 && referralData.showAdAttribution === false)) {
    return null;
  }
  
  console.log(`[Webhook] 📣 REFERRAL DATA EXTRACTED (Meta Ads):`, JSON.stringify(referralData));
  
  return referralData;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider") as WhatsAppProvider || "evolution";

    const payload = await req.json();
    
    // === DEBUG LOGGING ===
    console.log(`[Webhook] Received from ${provider}:`, JSON.stringify(payload).substring(0, 800));
    
    // =====================================================
    // LOG DE EVENTOS DE ACK/STATUS PARA DIAGNÓSTICO
    // =====================================================
    const payloadStr = JSON.stringify(payload);
    const hasAckSignal = 
      payloadStr.includes('"ack"') || 
      payloadStr.includes('"ACK"') ||
      payloadStr.includes('messages.update') ||
      payloadStr.includes('message_ack') ||
      payloadStr.includes('messages_ack');
    
    if (hasAckSignal) {
      console.log(`[Webhook] 🔔 ACK/STATUS EVENT DETECTED from ${provider}!`);
      console.log(`[Webhook] 🔔 Event: ${payload.event || payload.EventType || 'unknown'}`);
      console.log(`[Webhook] 🔔 ACK value: ${payload.ack ?? payload.message?.ack ?? payload.body?.message?.ack ?? payload.data?.[0]?.ack ?? payload.data?.[0]?.update?.status ?? 'not found'}`);
    }
    
    // =====================================================
    // LOG DETALHADO PARA MENSAGENS fromMe (UAZAPI)
    // Para diagnosticar onde está o ACK nas mensagens enviadas
    // =====================================================
    if (provider === 'uazapi') {
      const isFromMe = 
        payload.message?.fromMe ||
        payload.body?.message?.fromMe ||
        payload.fromMe ||
        payload.data?.key?.fromMe ||
        payload.data?.fromMe ||
        payload.key?.fromMe;
      
      if (isFromMe) {
        console.log(`[Webhook UAZAPI] 🔍 fromMe=true - Looking for ACK in payload...`);
        console.log(`[Webhook UAZAPI] 🔍 payload.ack: ${payload.ack}`);
        console.log(`[Webhook UAZAPI] 🔍 payload.status: ${payload.status}`);
        console.log(`[Webhook UAZAPI] 🔍 payload.message?.ack: ${payload.message?.ack}`);
        console.log(`[Webhook UAZAPI] 🔍 payload.body?.ack: ${payload.body?.ack}`);
        console.log(`[Webhook UAZAPI] 🔍 payload.body?.message?.ack: ${payload.body?.message?.ack}`);
        console.log(`[Webhook UAZAPI] 🔍 payload.data?.ack: ${payload.data?.ack}`);
        console.log(`[Webhook UAZAPI] 🔍 Full fromMe payload:`, JSON.stringify(payload).substring(0, 1500));
      }
    }
    
    // Audio detection debug
    const hasAudio = 
      payload.audio ||
      payload.message?.audioMessage ||
      payload.data?.message?.audioMessage ||
      payload.data?.audio ||
      payload.type === 'audio' ||
      payload.type === 'ptt' ||
      payload.messageType === 'audio';
    
    if (hasAudio) {
      console.log('🎵 [Webhook] AUDIO DETECTED!');
      const audioData = payload.audio || payload.data?.message?.audioMessage || payload.message?.audioMessage;
      console.log('🎵 [Webhook] Has base64:', !!audioData?.base64);
      console.log('🎵 [Webhook] Audio URL:', audioData?.url);
      console.log('🎵 [Webhook] Mimetype:', audioData?.mimetype);
    }

    // Extract instance ID
    const instanceId = extractInstanceId(provider, payload);
    
    // Determine event type
    const eventType = getEventType(provider, payload);
    
    // =====================================================
    // OTIMIZAÇÃO CRÍTICA: Filtrar eventos que sobrecarregam o banco
    // Lista expandida baseada em análise de logs (32k+ eventos/dia)
    // =====================================================
    const normalizedEventType = eventType?.toLowerCase().replace(/_/g, '.') || '';
    
    // Eventos que NUNCA devem ser logados (alta frequência, baixo valor)
    const neverLogPatterns = [
      'presence', 'typing', 'composing', 'recording', 'available', 'unavailable',
      'qrcode', 'connection', 'connecting', 'close', 'open',
      'chats.set', 'chats.upsert', 'chats.update', 'chats.delete',
      'contacts.set', 'contacts.upsert', 'contacts.update',
      'groups.upsert', 'groups.update', 'group.participants',
      'labels.edit', 'labels.association',
      'blocklist'
      // NOTE: 'call' removido para permitir notificações de chamadas
    ];
    
    // Verificar se deve pular o log
    const shouldSkipLog = neverLogPatterns.some(pattern => 
      normalizedEventType.includes(pattern)
    );
    
    // messages.update só deve ser logado se for status importante (delivered, read, failed)
    // Não logar status intermediários que geram muito volume
    const isMessageUpdate = normalizedEventType.includes('messages.update');
    const isImportantStatus = isMessageUpdate && payload.data?.some?.((item: any) => 
      ['READ', 'DELIVERY_ACK', 'PLAYED', 'FAILED', 'ERROR'].includes(item?.update?.status)
    );
    
    // Só logar eventos de mensagem importantes
    const isImportantMessageEvent = 
      normalizedEventType.includes('messages.upsert') || 
      normalizedEventType.includes('send.message');
    
    const shouldLog = !shouldSkipLog && (isImportantMessageEvent || isImportantStatus);
    
    if (shouldLog) {
      // CORREÇÃO: Buscar tenant_id do canal antes de logar
      let logTenantId: string | null = null;
      if (instanceId) {
        const { data: channelForLog } = await supabase
          .from("whatsapp_channels")
          .select("tenant_id")
          .eq("instance_id", instanceId)
          .single();
        logTenantId = channelForLog?.tenant_id || null;
      }

      // Log webhook apenas para eventos importantes (reduz ~95% do volume)
      await supabase.from("webhook_logs").insert({
        provider,
        event_type: eventType,
        instance_id: instanceId,
        payload: {
          // Resumir payload para economizar espaço
          event: eventType,
          from: payload.data?.[0]?.key?.remoteJid || payload.data?.key?.remoteJid,
          isFromMe: payload.data?.[0]?.key?.fromMe || payload.data?.key?.fromMe,
          type: payload.data?.[0]?.message ? Object.keys(payload.data[0].message)[0] : 'unknown'
        },
        tenant_id: logTenantId, // CORREÇÃO: Adicionar tenant_id
      });
    }

    // Debug log para identificar eventos de conexão que podem estar sendo ignorados
    console.log(`[Webhook DEBUG Connection] Provider: ${provider}, EventType: ${eventType}, PayloadEvent: ${typeof payload.event === 'string' ? payload.event : JSON.stringify(payload.event)}, PayloadType: ${payload.type}, EventTypeProp: ${payload.EventType}, Connected: ${payload.connected}, State: ${payload.state || payload.data?.state}`);

    // Handle connection status updates
    if (isConnectionEvent(provider, payload)) {
      console.log(`[Webhook] 🔌 Processing connection event for instance: ${instanceId}`);
      await handleConnectionEvent(supabase, provider, instanceId, payload);
      return new Response(JSON.stringify({ success: true, message: "Connection event processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle incoming call events - notify agents in real-time
    if (isCallEvent(provider, payload)) {
      console.log(`[Webhook] 📞 Processing incoming call event for instance: ${instanceId}`);
      await handleCallEvent(supabase, provider, instanceId, payload);
      return new Response(JSON.stringify({ success: true, message: "Call event processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle presence updates (online/offline status)
    if (isPresenceEvent(provider, payload)) {
      console.log(`[Webhook] Processing presence event`);
      await handlePresenceEvent(supabase, provider, payload);
      return new Response(JSON.stringify({ success: true, message: "Presence event processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle message status updates (ACK events - delivered, read)
    if (isMessageStatusEvent(provider, payload)) {
      console.log(`[Webhook] Processing message status event`);
      await handleMessageStatusEvent(supabase, provider, payload);
      return new Response(JSON.stringify({ success: true, message: "Status event processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle reaction events
    if (isReactionEvent(provider, payload)) {
      console.log(`[Webhook] Processing reaction event`);
      await handleReactionEvent(supabase, provider, payload, instanceId);
      return new Response(JSON.stringify({ success: true, message: "Reaction event processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if this is a message event
    if (!isMessageEvent(provider, payload)) {
      console.log(`[Webhook] Not a message event, skipping`);
      return new Response(JSON.stringify({ success: true, message: "Event logged" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find channel by instance ID
    if (!instanceId) {
      console.log(`[Webhook] No instance ID found`);
      return new Response(JSON.stringify({ success: false, error: "No instance ID" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Usar RPC otimizada para buscar canal (evita JOIN complexo)
    const { data: channelData, error: channelError } = await supabase
      .rpc("get_channel_by_instance", { p_instance_id: instanceId })
      .single();
    
    // Mapear resultado para formato esperado (agora incluindo tenant_id)
    const channelRow = channelData as {
      id: string;
      name: string;
      instance_id: string;
      department_id: string | null;
      tenant_id: string;
      provider_code: string;
      provider_base_url: string;
      provider_admin_token: string;
    } | null;
    
    const channel = channelRow ? {
      id: channelRow.id,
      name: channelRow.name,
      instance_id: channelRow.instance_id,
      department_id: channelRow.department_id,
      tenant_id: channelRow.tenant_id,
      provider: {
        code: channelRow.provider_code,
        base_url: channelRow.provider_base_url,
        admin_token: channelRow.provider_admin_token
      }
    } : null;

    if (channelError || !channel) {
      console.log(`[Webhook] Channel not found for instance: ${instanceId}`);
      return new Response(JSON.stringify({ success: false, error: "Channel not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // =====================================================
    // AUTO-RECONFIGURE WEBHOOK (fire-and-forget, one-time per channel)
    // Garante que messagesUpdate: true esteja configurado
    // =====================================================
    try {
      const { data: configCheck } = await supabase
        .from("whatsapp_channels")
        .select("webhook_events_configured_at")
        .eq("id", channel.id)
        .single();

      if (configCheck && !configCheck.webhook_events_configured_at) {
        console.log(`[Webhook] 🔧 Channel ${channel.name} needs webhook reconfiguration, triggering in background...`);
        
        // Mark immediately to prevent duplicate triggers
        supabase
          .from("whatsapp_channels")
          .update({ webhook_events_configured_at: new Date().toISOString() })
          .eq("id", channel.id)
          .then(() => {
            console.log(`[Webhook] 🔧 Marked channel ${channel.id} as configured`);
          });

        // Fire-and-forget: reconfigure webhook
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        fetch(`${supabaseUrl}/functions/v1/whatsapp-instance`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            action: "reconfigureWebhook",
            channelId: channel.id,
          }),
        }).then(async (res) => {
          const result = await res.json();
          console.log(`[Webhook] 🔧 Reconfigure result for ${channel.name}:`, result.success ? '✅ OK' : `❌ ${result.error}`);
        }).catch((err) => {
          console.error(`[Webhook] 🔧 Reconfigure error for ${channel.name}:`, err);
        });
      }
    } catch (e) {
      // Non-blocking: don't fail message processing
      console.error(`[Webhook] 🔧 Auto-reconfigure check failed (non-blocking):`, e);
    }

    // Normalize message
    const normalizedMessage = normalizeMessage(provider, payload);
    if (!normalizedMessage) {
      console.log(`[Webhook] Could not normalize message`);
      return new Response(JSON.stringify({ success: true, message: "Could not normalize" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================================
    // PROCESSAR MENSAGENS - TANTO RECEBIDAS QUANTO ENVIADAS (fromMe)
    // =====================================================
    
    if (normalizedMessage.isFromMe) {
      // Mensagem enviada pelo celular/outro dispositivo - salvar no sistema
      console.log(`[Webhook] Processing fromMe message to: ${normalizedMessage.from}`);
      
      // Para mensagens fromMe, o "from" é o destinatário (remoteJid)
      let recipientPhone = normalizedMessage.from;
      
      // =====================================================
      // CORREÇÃO DUPLICADOS: Normalizar telefone e buscar por variações
      // O provider pode enviar o telefone sem 9º dígito - precisamos buscar
      // usando as mesmas variações que usamos no inbound
      // =====================================================
      let contact = null;
      let conversation = null;
      
      // Gerar variações do telefone (com/sem 9º dígito)
      const phoneVariations = generatePhoneVariationsBR(recipientPhone);
      console.log(`[Webhook] FromMe: Searching contact with phone variations:`, phoneVariations);
      
      // Tentar buscar contato por QUALQUER variação do telefone (FILTRAR POR TENANT!)
      const { data: directContact } = await supabase
        .from("contacts")
        .select("id, phone, full_name")
        .in("phone", phoneVariations)
        .eq("tenant_id", channel.tenant_id)
        .limit(1)
        .maybeSingle();
      
      if (directContact) {
        contact = directContact;
        console.log(`[Webhook] FromMe: Found existing contact ${contact.id} with phone ${directContact.phone}`);
        
        // Buscar conversa existente com esse contato (QUALQUER status - incluindo fechadas)
        // Para mensagens fromMe (BOT), usamos a conversa mais recente sem filtrar por status
        const { data: conv } = await supabase
          .from("conversations")
          .select("id, assigned_to, status")
          .eq("contact_id", contact.id)
          .eq("channel_id", channel.id)
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        conversation = conv;
        
        if (conv) {
          console.log(`[Webhook] FromMe: Found existing conversation ${conv.id} with status "${conv.status}"`);
        }
      } else {
        // Contato não encontrado pelo telefone
        // IMPORTANTE: NÃO usar fallback de "conversa mais recente" para fromMe
        // pois isso causa mensagens indo para a conversa errada!
        // 
        // Se o telefone é um LID (não começa com 55 ou tem formato estranho),
        // logamos e pulamos - o contato será criado quando recebermos resposta
        
        const isLikelyLID = !recipientPhone.startsWith('55') || recipientPhone.length > 13;
        
        if (isLikelyLID) {
          console.log(`[Webhook] ⚠️ Phone ${recipientPhone} looks like a LID, skipping fromMe message to avoid wrong conversation`);
          return new Response(JSON.stringify({ success: true, message: "LID phone for fromMe, skipping" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        // Se é um telefone válido que não existe, será criado abaixo
        console.log(`[Webhook] Contact not found for valid phone ${recipientPhone}, will create new contact`);
      }

      // =====================================================
      // CRIAR CONTATO E CONVERSA SE NÃO EXISTIREM
      // Resolve race condition com sistemas externos como Jet Sales
      // =====================================================
      if (!contact) {
        // =====================================================
        // CORREÇÃO: Normalizar telefone antes de criar contato
        // Isso garante que usamos o mesmo formato do redirect-capture
        // =====================================================
        const normalizedPhone = normalizePhoneForStorageBR(recipientPhone);
        console.log(`[Webhook] 🆕 Creating contact for fromMe message: ${recipientPhone} -> normalized: ${normalizedPhone}`);
        
        // IMPORTANTE: Para mensagens fromMe, o pushName é o nome da EMPRESA (ex: "Space Sports")
        // e não do cliente! Sempre usar nome genérico para que seja atualizado quando cliente responder
        const contactName = `WhatsApp ${normalizedPhone.slice(-4)}`;
        
        // Usar UPSERT para evitar duplicatas em race conditions
        const { data: newContact, error: contactError } = await supabase
          .from("contacts")
          .upsert({
            phone: normalizedPhone,
            full_name: contactName,
            first_contact_at: new Date().toISOString(),
            origin: "whatsapp",
            department_id: channel.department_id || null,
            tenant_id: channel.tenant_id,
          }, {
            onConflict: "phone,tenant_id",
            ignoreDuplicates: false
          })
          .select("id")
          .single();
        
        if (contactError) {
          console.error(`[Webhook] Error creating/upserting contact:`, contactError);
          
          // Fallback: buscar existente por variações
          const { data: existingContact } = await supabase
            .from("contacts")
            .select("id")
            .in("phone", phoneVariations)
            .eq("tenant_id", channel.tenant_id)
            .limit(1)
            .maybeSingle();
          
          if (existingContact) {
            contact = existingContact;
            console.log(`[Webhook] Found existing contact after upsert error: ${contact.id}`);
          } else {
            throw contactError;
          }
        } else {
          contact = newContact;
          console.log(`[Webhook] ✅ Contact created/upserted: ${contact.id}`);
        }
      }

      if (!contact) {
        console.log(`[Webhook] Still no contact after creation attempt, skipping`);
        return new Response(JSON.stringify({ success: true, message: "Contact not found for fromMe" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!conversation) {
        // IMPORTANTE: Para mensagens fromMe, primeiro buscar QUALQUER conversa existente (incluindo fechadas)
        // para evitar criar duplicatas. O BOT não deve criar novas conversas se já existe uma fechada.
        console.log(`[Webhook] FromMe: No conversation found yet, searching for any existing (including closed)...`);
        
        const { data: anyExistingConv } = await supabase
          .from("conversations")
          .select("id, assigned_to, status")
          .eq("contact_id", contact.id)
          .eq("channel_id", channel.id)
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (anyExistingConv) {
          conversation = anyExistingConv;
          console.log(`[Webhook] FromMe: Found existing conversation ${anyExistingConv.id} with status "${anyExistingConv.status}" - using WITHOUT reopening`);
        } else {
          // Realmente não existe nenhuma conversa - criar nova (caso de campanha proativa)
          console.log(`[Webhook] 🆕 Creating conversation for fromMe message (external system/proactive campaign)`);
          
          // Buscar department_id do contato (pode ter sido definido pela campanha redirect)
          const { data: contactDept } = await supabase
            .from("contacts")
            .select("department_id")
            .eq("id", contact.id)
            .single();
          
          // Prioridade: contact.department_id > channel.department_id
          const conversationDepartmentId = contactDept?.department_id || channel.department_id || null;
          
          const { data: newConv, error: convError } = await supabase
            .from("conversations")
            .insert({
              contact_id: contact.id,
              channel_id: channel.id,
              department_id: conversationDepartmentId,
              tenant_id: channel.tenant_id,
              status: "open",
              is_unread: false, // Mensagem enviada por nós, não é unread
              unread_count: 0,
              last_message_at: new Date().toISOString(),
              last_message_preview: normalizedMessage.content?.substring(0, 100) || "[Mídia]",
            })
            .select("id, assigned_to, status")
            .single();
          
          if (convError) {
            // Se erro de duplicata (race condition), buscar existente (qualquer status)
            if (convError.code === '23505') {
              console.log(`[Webhook] Conversation already exists (race condition), fetching...`);
              const { data: existingConv } = await supabase
                .from("conversations")
                .select("id, assigned_to, status")
                .eq("contact_id", contact.id)
                .eq("channel_id", channel.id)
                .order("last_message_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              conversation = existingConv;
            } else {
              console.error(`[Webhook] Error creating conversation:`, convError);
              throw convError;
            }
          } else {
            conversation = newConv;
            console.log(`[Webhook] ✅ Conversation created: ${conversation.id}`);
          }
        }
      }

      if (!conversation) {
        console.log(`[Webhook] Still no conversation after creation attempt, skipping`);
        return new Response(JSON.stringify({ success: true, message: "No conversation for fromMe" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // =====================================================
      // PARA MENSAGENS fromMe: NÃO INSERIR - APENAS ATUALIZAR
      // O frontend já insere a mensagem otimisticamente
      // O webhook deve apenas atualizar com o whatsapp_message_id se necessário
      // =====================================================
      
      // Primeiro, verificar se já existe uma mensagem com esse whatsapp_message_id
      const { data: existingByWhatsappId } = await supabase
        .from("messages")
        .select("id, created_at, trigger_processed, content")
        .eq("whatsapp_message_id", normalizedMessage.originalId)
        .maybeSingle();

      if (existingByWhatsappId) {
        console.log(`[Webhook] FromMe message already has whatsapp_message_id, checking trigger: ${normalizedMessage.originalId}`);
        
        // CORREÇÃO: Disparar trigger se a mensagem é recente e ainda não foi processada
        const isRecent = existingByWhatsappId.created_at && 
          (Date.now() - new Date(existingByWhatsappId.created_at).getTime()) < 60000;
        
        if (isRecent && !existingByWhatsappId.trigger_processed) {
          try {
            console.log(`[Webhook] 🔄 Triggering message_key for recently duplicate fromMe message...`);
            await supabase.functions.invoke('process-flow-triggers', {
              body: {
                trigger_type: 'message_key',
                tenant_id: channel.tenant_id,
                contact_id: contact.id,
                channel_id: channel.id,
                conversation_id: conversation.id,
                message_content: existingByWhatsappId.content || normalizedMessage.content,
              }
            });
            
            // Marcar como processado
            await supabase.from("messages").update({ trigger_processed: true }).eq("id", existingByWhatsappId.id);
            console.log(`[Webhook] ✅ Trigger processed for duplicate fromMe message`);
          } catch (triggerErr) {
            console.error(`[Webhook] Error processing trigger for duplicate:`, triggerErr);
          }
        }
        
        return new Response(JSON.stringify({ success: true, message: "Message already exists" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Buscar mensagem recente do frontend que ainda não tem whatsapp_message_id
      // Procurar por mensagem do mesmo tipo, na mesma conversa, criada nos últimos 30 segundos
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
      
      const { data: pendingMessages } = await supabase
        .from("messages")
        .select("id, content, message_type, media_url, whatsapp_message_id")
        .eq("conversation_id", conversation.id)
        .eq("is_from_me", true)
        .eq("message_type", normalizedMessage.type)
        .is("whatsapp_message_id", null)
        .gte("created_at", thirtySecondsAgo)
        .order("created_at", { ascending: false })
        .limit(5);

      if (pendingMessages && pendingMessages.length > 0) {
        // Encontrar a mensagem que mais se parece (mesmo conteúdo ou mídia similar)
        let matchedMessage = null;
        
        for (const msg of pendingMessages) {
          // Para mídia, qualquer mensagem pendente do mesmo tipo serve
          if (normalizedMessage.type !== 'text' && msg.message_type === normalizedMessage.type) {
            matchedMessage = msg;
            console.log(`[Webhook] Matched media message by type: ${normalizedMessage.type}`);
            break;
          }
          
          // Para texto, comparar conteúdo com múltiplas estratégias
          if (normalizedMessage.type === 'text' && msg.content && normalizedMessage.content) {
            const msgContent = msg.content.trim();
            const webhookContent = normalizedMessage.content.trim();
            
            // 1. Correspondência exata
            if (msgContent === webhookContent) {
              matchedMessage = msg;
              console.log(`[Webhook] Exact content match found`);
              break;
            }
            
            // 2. Webhook contém o conteúdo do frontend (assinatura "*Nome*:\n" foi adicionada)
            if (webhookContent.includes(msgContent) && msgContent.length > 0) {
              matchedMessage = msg;
              console.log(`[Webhook] Webhook content contains frontend content (signature added)`);
              break;
            }
            
            // 3. Frontend contém conteúdo do webhook
            if (msgContent.includes(webhookContent) && webhookContent.length > 0) {
              matchedMessage = msg;
              console.log(`[Webhook] Frontend content contains webhook content`);
              break;
            }
            
            // 4. Remover assinatura do padrão "*Nome*:\n" do webhook e comparar
            const contentWithoutSignature = webhookContent.replace(/^\*[^*]+\*:\n/, '');
            if (msgContent === contentWithoutSignature) {
              matchedMessage = msg;
              console.log(`[Webhook] Match after removing signature pattern`);
              break;
            }
            
            // 5. Comparar apenas a parte final do webhook (após última quebra de linha de assinatura)
            const lastLineBreakIdx = webhookContent.lastIndexOf('\n');
            if (lastLineBreakIdx > 0) {
              const afterSignature = webhookContent.substring(lastLineBreakIdx + 1).trim();
              if (msgContent === afterSignature || afterSignature.includes(msgContent)) {
                matchedMessage = msg;
                console.log(`[Webhook] Match after extracting content after signature`);
                break;
              }
            }
          }
        }

        if (matchedMessage) {
          console.log(`[Webhook] Found pending frontend message (id: ${matchedMessage.id}), updating with whatsapp_message_id: ${normalizedMessage.originalId}`);
          
          // Atualizar a mensagem existente com o whatsapp_message_id
          const updateData: any = {
            whatsapp_message_id: normalizedMessage.originalId,
            status: "sent",
          };

          // Se for mídia, processar de acordo com o provider
          const isFromMeMediaType = ['audio', 'image', 'video', 'document'].includes(normalizedMessage.type);
          
          // IMPORTANTE: Verificar se a mensagem já tem URL de mídia válida do Supabase Storage
          // Se tiver, NÃO substituir - manter a qualidade original da imagem enviada pelo CRM
          const existingMediaUrl = matchedMessage.media_url;
          const hasValidSupabaseUrl = existingMediaUrl && existingMediaUrl.includes('supabase.co/storage');
          
          if (hasValidSupabaseUrl) {
            console.log(`[Webhook] FromMe message already has Supabase URL, keeping original quality: ${existingMediaUrl.substring(0, 80)}...`);
            // Não atualiza media_url - mantém a URL original de alta qualidade
          } else if (isFromMeMediaType && !normalizedMessage.mediaBase64) {
            // Só baixa mídia da UAZAPI/Evolution se NÃO tiver URL do Supabase
            // UAZAPI: Download media using /message/download endpoint
            if (provider === 'uazapi') {
              console.log(`[Webhook UAZAPI] FromMe media without Supabase URL - downloading from UAZAPI...`);
              const uazapiMedia = await processUAZAPIMedia(
                supabase,
                normalizedMessage.instanceId,
                normalizedMessage.originalId.replace('uazapi_', ''),
                normalizedMessage.type,
                conversation.id
              );
              if (uazapiMedia.mediaUrl) {
                updateData.media_url = uazapiMedia.mediaUrl;
                console.log(`[Webhook UAZAPI] FromMe media uploaded: ${uazapiMedia.mediaUrl}`);
              }
            }
            // Evolution API: Fetch base64 from getBase64FromMediaMessage
            else if (provider === 'evolution') {
              console.log(`[Webhook] FromMe media without base64, fetching from Evolution API...`);
              const channelProvider = (channel as any).provider;
              if (channelProvider?.code === 'evolution' && channelProvider?.base_url && channelProvider?.admin_token) {
                const mediaData = await fetchMediaBase64FromEvolution(
                  channelProvider.base_url,
                  channelProvider.admin_token,
                  channel.instance_id || '',
                  {
                    id: normalizedMessage.originalId,
                    remoteJid: normalizedMessage.from + '@s.whatsapp.net',
                    fromMe: normalizedMessage.isFromMe
                  }
                );
                if (mediaData.base64) {
                  normalizedMessage.mediaBase64 = mediaData.base64;
                  normalizedMessage.mediaMimeType = mediaData.mimetype || normalizedMessage.mediaMimeType;
                }
              }
            }
          }

          // Upload media if we have base64 (Evolution or other providers) - apenas se não tiver URL do Supabase
          if (!hasValidSupabaseUrl && normalizedMessage.mediaBase64 && normalizedMessage.mediaMimeType) {
            console.log(`[Webhook] Uploading media for fromMe message update...`);
            const uploadedUrl = await uploadMediaToStorage(
              supabase,
              normalizedMessage.mediaBase64,
              normalizedMessage.mediaMimeType,
              conversation.id
            );
            if (uploadedUrl) {
              updateData.media_url = uploadedUrl;
              console.log(`[Webhook] FromMe media uploaded, updating URL`);
            }
          }

          await supabase
            .from("messages")
            .update(updateData)
            .eq("id", matchedMessage.id);

          console.log(`[Webhook] Updated frontend message with whatsapp_message_id`);

          // Marcar conversa como lida (mensagem enviada = atendente respondeu)
          await supabase
            .from("conversations")
            .update({
              is_unread: false,
              unread_count: 0,
              last_message_is_from_me: true,
              last_message_at: new Date().toISOString(),
              last_message_preview: matchedMessage.content?.substring(0, 100) || normalizedMessage.content?.substring(0, 100) || "[Mídia]",
              updated_at: new Date().toISOString(),
            })
            .eq("id", conversation.id);

          console.log(`[Webhook] Conversation marked as read (frontend message sent)`);

          // TRIGGER MESSAGE_KEY AUTOMATIONS (mensagens enviadas via frontend)
          try {
            console.log(`[Webhook] 🤖 Checking message_key automations for frontend message...`);
            
            await supabase.functions.invoke('process-flow-triggers', {
              body: {
                trigger_type: 'message_key',
                tenant_id: channel.tenant_id,
                contact_id: contact.id,
                channel_id: channel.id,
                conversation_id: conversation.id,
                message_content: matchedMessage.content || normalizedMessage.content,
              }
            });
            
            console.log(`[Webhook] ✅ message_key trigger invoked for frontend message`);
          } catch (triggerError) {
            console.error(`[Webhook] Error invoking message_key triggers:`, triggerError);
          }

          return new Response(JSON.stringify({ success: true, message: "Frontend message updated" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Se não encontrou mensagem pendente, pode ser que o frontend não inseriu ainda
      // ou é uma mensagem enviada de outro dispositivo - nesse caso, inserir
      console.log(`[Webhook] No pending frontend message found, checking if sent from another device...`);
      
      // Verificar novamente se já existe (pode ter sido inserido enquanto processávamos)
      const { data: existingNow } = await supabase
        .from("messages")
        .select("id")
        .eq("whatsapp_message_id", normalizedMessage.originalId)
        .maybeSingle();

      if (existingNow) {
        console.log(`[Webhook] Message was inserted while processing, checking trigger: ${normalizedMessage.originalId}`);
        
        // CORREÇÃO: Buscar dados completos para verificar trigger_processed
        const { data: msgForTrigger } = await supabase
          .from("messages")
          .select("id, created_at, trigger_processed, content")
          .eq("whatsapp_message_id", normalizedMessage.originalId)
          .single();
        
        const isRecent = msgForTrigger?.created_at && 
          (Date.now() - new Date(msgForTrigger.created_at).getTime()) < 60000;
        
        if (isRecent && msgForTrigger && !msgForTrigger.trigger_processed) {
          try {
            console.log(`[Webhook] 🔄 Triggering message_key for race-condition duplicate...`);
            await supabase.functions.invoke('process-flow-triggers', {
              body: {
                trigger_type: 'message_key',
                tenant_id: channel.tenant_id,
                contact_id: contact.id,
                channel_id: channel.id,
                conversation_id: conversation.id,
                message_content: msgForTrigger.content || normalizedMessage.content,
              }
            });
            await supabase.from("messages").update({ trigger_processed: true }).eq("id", msgForTrigger.id);
            console.log(`[Webhook] ✅ Trigger processed for race-condition message`);
          } catch (triggerErr) {
            console.error(`[Webhook] Error processing trigger:`, triggerErr);
          }
        }
        
        return new Response(JSON.stringify({ success: true, message: "Message already exists" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upload media if needed for new insert
      let finalMediaUrl = normalizedMessage.mediaUrl;
      const isFromMeInsertMediaType = ['audio', 'image', 'video', 'document'].includes(normalizedMessage.type);
      
      // IMPORTANTE: Verificar se já existe URL válida do Supabase Storage
      // Isso pode acontecer se a mensagem foi enviada pelo frontend e já tem a mídia no Storage
      const hasExistingSupabaseUrl = finalMediaUrl && finalMediaUrl.includes('supabase.co/storage');
      
      if (hasExistingSupabaseUrl) {
        console.log(`[Webhook] FromMe insert already has Supabase URL, keeping original quality: ${finalMediaUrl!.substring(0, 80)}...`);
        // Mantém a URL original - não baixa da UAZAPI/Evolution
      } else if (isFromMeInsertMediaType && !normalizedMessage.mediaBase64) {
        // Só baixa mídia se NÃO tiver URL do Supabase
        // UAZAPI: Download media using /message/download endpoint
        if (provider === 'uazapi') {
          console.log(`[Webhook UAZAPI] FromMe insert without Supabase URL - downloading media from UAZAPI...`);
          const uazapiMedia = await processUAZAPIMedia(
            supabase,
            normalizedMessage.instanceId,
            normalizedMessage.originalId.replace('uazapi_', ''),
            normalizedMessage.type,
            conversation.id
          );
          if (uazapiMedia.mediaUrl) {
            finalMediaUrl = uazapiMedia.mediaUrl;
            normalizedMessage.mediaMimeType = uazapiMedia.mimeType || normalizedMessage.mediaMimeType;
            console.log(`[Webhook UAZAPI] FromMe insert media uploaded: ${finalMediaUrl}`);
          }
        }
        // Evolution API: Fetch base64 from getBase64FromMediaMessage
        else if (provider === 'evolution') {
          const channelProvider = (channel as any).provider;
          if (channelProvider?.code === 'evolution' && channelProvider?.base_url && channelProvider?.admin_token) {
            const mediaData = await fetchMediaBase64FromEvolution(
              channelProvider.base_url,
              channelProvider.admin_token,
              channel.instance_id || '',
              {
                id: normalizedMessage.originalId,
                remoteJid: normalizedMessage.from + '@s.whatsapp.net',
                fromMe: normalizedMessage.isFromMe
              }
            );
            if (mediaData.base64) {
              normalizedMessage.mediaBase64 = mediaData.base64;
              normalizedMessage.mediaMimeType = mediaData.mimetype || normalizedMessage.mediaMimeType;
            }
          }
        }
      }

      // Upload base64 if available (Evolution or other providers) - apenas se não tiver URL do Supabase
      if (!hasExistingSupabaseUrl && normalizedMessage.mediaBase64 && normalizedMessage.mediaMimeType && !finalMediaUrl?.includes('supabase')) {
        const uploadedUrl = await uploadMediaToStorage(
          supabase,
          normalizedMessage.mediaBase64,
          normalizedMessage.mediaMimeType,
          conversation.id
        );
        if (uploadedUrl) {
          finalMediaUrl = uploadedUrl;
        }
      }

      // Find reply_to_message_id if quotedMessageId exists
      let replyToMessageIdFromMe = null;
      if (normalizedMessage.quotedMessageId) {
        const { data: quotedMsgFromMe } = await supabase
          .from("messages")
          .select("id")
          .eq("whatsapp_message_id", normalizedMessage.quotedMessageId)
          .single();
        
        if (quotedMsgFromMe) {
          replyToMessageIdFromMe = quotedMsgFromMe.id;
        }
      }

      // Inserir apenas se for de outro dispositivo (não encontrou mensagem pendente)
      // =====================================================
      // ASSINATURA OBRIGATÓRIA: Adicionar assinatura do agente se for mensagem de texto
      // =====================================================
      let finalContent = normalizedMessage.content;
      if (normalizedMessage.type === 'text' && conversation.assigned_to) {
        // Verificar se já tem assinatura (começa com *Algo*:)
        const hasSignature = /^\*[^*]+\*:\s*/.test(normalizedMessage.content || '');
        
        if (!hasSignature) {
          // Buscar perfil do agente atribuído
          const { data: agentProfile } = await supabase
            .from('profiles')
            .select('full_name, signature_name, signature_enabled')
            .eq('id', conversation.assigned_to)
            .single();
          
          // Só adiciona assinatura se signature_enabled !== false (default true)
          if (agentProfile && agentProfile.signature_enabled !== false) {
            const signatureName = agentProfile.signature_name || agentProfile.full_name;
            if (signatureName) {
              finalContent = `*${signatureName}*:\n${normalizedMessage.content}`;
              console.log(`[Webhook] Added signature from agent: ${signatureName}`);
            }
          }
        }
      }

      const { error: msgError } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        content: finalContent,
        message_type: normalizedMessage.type,
        media_url: finalMediaUrl,
        media_mime_type: normalizedMessage.mediaMimeType,
        is_from_me: true,
        status: "sent",
        whatsapp_message_id: normalizedMessage.originalId,
        created_at: normalizedMessage.timestamp.toISOString(),
        reply_to_message_id: replyToMessageIdFromMe,
        tenant_id: channel.tenant_id,
      });

      if (msgError) {
        // Se for erro de duplicata, tentar disparar trigger mesmo assim
        if (msgError.code === '23505') {
          console.log(`[Webhook] Duplicate message (constraint), checking trigger...`);
          
          // Buscar a mensagem que existe para verificar trigger
          const { data: duplicateMsg } = await supabase
            .from("messages")
            .select("id, created_at, trigger_processed, content")
            .eq("whatsapp_message_id", normalizedMessage.originalId)
            .single();
          
          const isRecent = duplicateMsg?.created_at && 
            (Date.now() - new Date(duplicateMsg.created_at).getTime()) < 60000;
          
          if (isRecent && duplicateMsg && !duplicateMsg.trigger_processed) {
            try {
              console.log(`[Webhook] 🔄 Triggering message_key for constraint-duplicate...`);
              await supabase.functions.invoke('process-flow-triggers', {
                body: {
                  trigger_type: 'message_key',
                  tenant_id: channel.tenant_id,
                  contact_id: contact.id,
                  channel_id: channel.id,
                  conversation_id: conversation.id,
                  message_content: duplicateMsg.content || normalizedMessage.content,
                }
              });
              await supabase.from("messages").update({ trigger_processed: true }).eq("id", duplicateMsg.id);
              console.log(`[Webhook] ✅ Trigger processed for constraint-duplicate`);
            } catch (triggerErr) {
              console.error(`[Webhook] Error processing trigger:`, triggerErr);
            }
          }
          
          return new Response(JSON.stringify({ success: true, message: "Duplicate avoided" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error(`[Webhook] Error saving fromMe message:`, msgError);
        throw msgError;
      }

      // =====================================================
      // TRIGGER MESSAGE_KEY AUTOMATIONS (mensagens ENVIADAS)
      // Dispara automações baseadas em mensagens enviadas pelo sistema/atendente
      // =====================================================
      try {
        console.log(`[Webhook] 🤖 Checking message_key automations for sent message...`);
        
        await supabase.functions.invoke('process-flow-triggers', {
          body: {
            trigger_type: 'message_key',
            tenant_id: channel.tenant_id,
            contact_id: contact.id,
            channel_id: channel.id,
            conversation_id: conversation.id,
            message_content: normalizedMessage.content,
          }
        });
      } catch (triggerError) {
        // Non-critical - log but don't fail the webhook
        console.error(`[Webhook] Error invoking message_key triggers:`, triggerError);
      }

      // Atualizar conversa - IMPORTANTE: NÃO alterar status!
      // Mensagens do BOT (fromMe) NÃO devem reabrir conversas fechadas
      // Apenas atualizar timestamp e preview, mantendo o status atual
      const conversationStatus = (conversation as any).status;
      console.log(`[Webhook] FromMe: Updating conversation ${conversation.id}, keeping status "${conversationStatus}"`);
      
      await supabase
        .from("conversations")
        .update({
          last_message_at: normalizedMessage.timestamp.toISOString(),
          last_message_preview: normalizedMessage.content?.substring(0, 100) || "[Mídia]",
          updated_at: new Date().toISOString(),
          // NÃO atualiza status! Permanece como estava (open, pending ou closed)
          // NOVO: Marcar como lida - se respondeu pelo telefone, leu a mensagem
          is_unread: false,
          unread_count: 0,
          last_message_is_from_me: true,
        })
        .eq("id", conversation.id);

      // =====================================================
      // PROCESSAR ACK INLINE NA MENSAGEM fromMe (UAZAPI)
      // Quando a UAZAPI envia mensagem fromMe, pode já incluir o ack (delivered/read)
      // =====================================================
      // Buscar ACK em múltiplos locais possíveis do payload
      const messageAck = 
        payload.message?.ack ?? 
        payload.body?.message?.ack ?? 
        payload.ack ??
        payload.body?.ack ??
        payload.data?.ack ??
        payload.data?.[0]?.ack ??
        payload.data?.[0]?.update?.ack;
      
      if (messageAck !== undefined && normalizedMessage.originalId) {
        console.log(`[Webhook] 📊 Found inline ACK: ${messageAck} for message ${normalizedMessage.originalId}`);
        const ackStatus = mapProviderStatus(String(messageAck));
        // Atualizar se tiver status válido (incluindo sent para ack=1)
        if (ackStatus && ackStatus !== 'pending') {
          await supabase
            .from("messages")
            .update({ status: ackStatus })
            .eq("whatsapp_message_id", normalizedMessage.originalId);
          console.log(`[Webhook] ✅ Updated fromMe message status from inline ACK: ${messageAck} -> ${ackStatus}`);
        }
      }

      console.log(`[Webhook] FromMe message from other device saved for conversation ${conversation.id}`);

      // =====================================================
      // DISPATCH CUSTOM WEBHOOK (message.sent) for fromMe
      // Envia para webhooks configurados pelo cliente
      // =====================================================
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        const { data: contactData } = await supabase
          .from('contacts')
          .select('id, full_name, phone, email, lead_status, lead_score')
          .eq('id', contact.id)
          .single();

        const { data: conversationData } = await supabase
          .from('conversations')
          .select('department_id, assigned_to, status, priority, unread_count, created_at')
          .eq('id', conversation.id)
          .single();

        let departmentData = null;
        if (conversationData?.department_id) {
          const { data: dept } = await supabase
            .from('departments')
            .select('id, name')
            .eq('id', conversationData.department_id)
            .single();
          departmentData = dept;
        }

        let agentData = null;
        if (conversationData?.assigned_to) {
          const { data: agent } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', conversationData.assigned_to)
            .single();
          agentData = agent;
        }

        let channelData = null;
        if (channel.id) {
          const { data: ch } = await supabase
            .from('whatsapp_channels')
            .select('id, name, phone')
            .eq('id', channel.id)
            .single();
          channelData = ch;
        }

        await fetch(`${supabaseUrl}/functions/v1/dispatch-webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            action: 'dispatch',
            event: {
              type: 'message.sent',
              data: {
                message: {
                  id: normalizedMessage.id,
                  whatsapp_message_id: normalizedMessage.originalId,
                  type: normalizedMessage.type,
                  content: normalizedMessage.content,
                  media_url: finalMediaUrl || null,
                  timestamp: normalizedMessage.timestamp.toISOString(),
                },
                contact: {
                  id: contact.id,
                  name: contactData?.full_name || contact.full_name,
                  phone: contactData?.phone || contact.phone,
                  email: contactData?.email || null,
                  lead_status: contactData?.lead_status || null,
                  lead_score: contactData?.lead_score || null,
                },
                conversation: {
                  id: conversation.id,
                  status: conversationData?.status || 'open',
                  priority: conversationData?.priority || null,
                  unread_count: conversationData?.unread_count || 0,
                  created_at: conversationData?.created_at || null,
                },
                department: {
                  id: conversationData?.department_id || null,
                  name: departmentData?.name || null,
                },
                channel: {
                  id: channel.id,
                  name: channelData?.name || null,
                  phone_number: channelData?.phone || null,
                },
                agent: agentData ? {
                  id: agentData.id,
                  name: agentData.full_name,
                  email: agentData.email,
                } : null,
              },
              context: {
                department: { id: conversationData?.department_id },
                channel: { id: channel.id },
                assigned_to: conversationData?.assigned_to,
                tenant_id: channel.tenant_id,
              },
            },
          }),
        });
        console.log('[Webhook] Webhook dispatched for message.sent (fromMe)');
      } catch (webhookError) {
        console.error('[Webhook] Error dispatching custom webhook (fromMe):', webhookError);
      }

      return new Response(JSON.stringify({ success: true, message: "FromMe message saved (other device)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================================
    // MENSAGEM RECEBIDA (não fromMe) - Fluxo normal
    // =====================================================
    
    // =====================================================
    // PHONE NORMALIZATION - Generate variations to find existing contacts
    // =====================================================
    // REGRA CELULAR BRASILEIRO: 55 + DDD (2 dígitos) + 9 dígitos (celular) ou 8 dígitos (fixo/celular antigo)
    // Celulares começam com 6, 7, 8 ou 9 no primeiro dígito após DDD
    // Se tem 8 dígitos e começa com [6-9], é celular que perdeu o 9º dígito
    function generatePhoneVariations(phone: string): string[] {
      const variations: string[] = [phone];
      
      // CRITICAL: First remove any WhatsApp session suffix (:0, :1, etc)
      // This prevents the 0 from being included in the phone number
      const jidCleaned = phone
        .replace(/:\d+(@s\.whatsapp\.net|@c\.us)?$/, '')
        .replace("@s.whatsapp.net", "")
        .replace("@c.us", "")
        .replace("@lid", "");
      
      const cleanPhone = jidCleaned.replace(/\D/g, '');
      
      if (!cleanPhone) return variations;
      
      // Add clean version
      if (!variations.includes(cleanPhone)) {
        variations.push(cleanPhone);
      }
      
      // With and without country code 55
      if (cleanPhone.startsWith('55')) {
        const withoutCountry = cleanPhone.slice(2);
        if (!variations.includes(withoutCountry)) {
          variations.push(withoutCountry);
        }
      } else {
        const withCountry = `55${cleanPhone}`;
        if (!variations.includes(withCountry)) {
          variations.push(withCountry);
        }
      }
      
      // Extract DDD and rest of number
      const hasCountry = cleanPhone.startsWith('55');
      const ddd = hasCountry ? cleanPhone.slice(2, 4) : cleanPhone.slice(0, 2);
      const rest = hasCountry ? cleanPhone.slice(4) : cleanPhone.slice(2);
      
      // 9th digit variations (Brazilian mobile numbers)
      // If has 9 digits after DDD and starts with 9, try without the 9
      if (rest.length === 9 && rest.startsWith('9')) {
        const without9 = rest.slice(1);
        variations.push(`55${ddd}${without9}`);
        variations.push(`${ddd}${without9}`);
      }
      
      // CORREÇÃO: Se tem 8 dígitos após DDD, pode ser celular que perdeu o 9º dígito
      // Celulares começam com 6-9, telefones fixos com 2-5
      // SEMPRE gerar variação com 9 prefixado para celulares (exceto fixos)
      if (rest.length === 8 && !/^[2-5]/.test(rest)) {
        variations.push(`55${ddd}9${rest}`);
        variations.push(`${ddd}9${rest}`);
        console.log(`[Webhook] Generated 9th digit variation for: ${ddd}${rest} -> ${ddd}9${rest}`);
      }
      
      // Handle extra trailing zeros (sometimes added in calls)
      if (cleanPhone.endsWith('0') && cleanPhone.length > 12) {
        const withoutTrailingZero = cleanPhone.slice(0, -1);
        if (!variations.includes(withoutTrailingZero)) {
          variations.push(withoutTrailingZero);
        }
        if (withoutTrailingZero.startsWith('55')) {
          variations.push(withoutTrailingZero.slice(2));
        }
      }
      
      // Remove duplicates
      return [...new Set(variations)];
    }
    
    // =====================================================
    // NORMALIZE PHONE FOR STORAGE - Canonical format
    // =====================================================
    // REGRA: Celulares BR (começando com 6-9 após DDD) devem ter 9 dígitos
    // Se recebemos 8 dígitos começando com [6-9], adicionamos o 9 na frente
    function normalizePhoneForStorageBR(phone: string): string {
      // Clean JID suffixes first
      const jidCleaned = phone
        .replace(/:\d+(@s\.whatsapp\.net|@c\.us)?$/, '')
        .replace("@s.whatsapp.net", "")
        .replace("@c.us", "")
        .replace("@lid", "");
      
      let digits = jidCleaned.replace(/\D/g, '');
      
      // Remove leading zeros
      if (digits.startsWith('0')) {
        digits = digits.replace(/^0+/, '');
      }
      
      // Add country code if missing
      if (!digits.startsWith('55') && digits.length >= 10 && digits.length <= 11) {
        digits = `55${digits}`;
      }
      
      // For Brazilian phones with 12 digits (55 + DDD + 8 digits)
      // CORREÇÃO: Celulares BR DEVEM ter 9 dígitos após DDD
      // Se tem 8 dígitos e NÃO é telefone fixo (começa com 2-5), adiciona o 9
      // Isso corrige números do Meta Ads que chegam sem o 9º dígito
      // Ex: 554896109082 -> 5548996109082 (96109082 vira 996109082)
      if (digits.startsWith('55') && digits.length === 12) {
        const ddd = digits.slice(2, 4);
        const rest = digits.slice(4);
        // Telefones fixos começam com 2, 3, 4, 5 - não adicionar 9
        // Celulares começam com 6, 7, 8, 9 - SEMPRE adicionar 9
        if (rest.length === 8 && !/^[2-5]/.test(rest)) {
          digits = `55${ddd}9${rest}`;
          console.log(`[Webhook] Normalized phone: added 9th digit -> ${digits} (original: ${phone})`);
        }
      }
      
      return digits;
    }
    
    // =====================================================
    // VALIDATE CONTACT NAME - Filter invalid/generic names
    // =====================================================
    function isValidContactName(name: string | undefined): boolean {
      if (!name || name.trim().length < 2) return false;
      
      const invalidNames = [
        'você', 'voce', 'eu', 'me', 'user', 'usuario', 'usuário',
        'undefined', 'null', 'unknown', 'desconhecido', 
        'whatsapp', 'contato', 'contact'
      ];
      
      const normalizedName = name.toLowerCase().trim();
      
      // Check if it's an invalid name
      if (invalidNames.includes(normalizedName)) {
        return false;
      }
      
      // Check if it's just a phone number
      if (/^\d+$/.test(normalizedName.replace(/[\s\-\(\)]/g, ''))) {
        return false;
      }
      
      return true;
    }
    
    // =====================================================
    // FIND OR CREATE CONTACT (usando UPSERT para evitar race conditions)
    // =====================================================
    const validName = isValidContactName(normalizedMessage.fromName);
    const contactName = validName 
      ? normalizedMessage.fromName! 
      : `WhatsApp ${normalizedMessage.from}`;
    
    console.log(`[Webhook] Contact name validation: fromName="${normalizedMessage.fromName}", isValid=${validName}, using="${contactName}"`);
    
    // Generate phone variations for search
    const phoneVariations = generatePhoneVariations(normalizedMessage.from);
    console.log(`[Webhook] Searching contact with phone variations: ${phoneVariations.join(', ')}`);
    
    // Primeiro, tentar buscar o contato existente por todas as variações (FILTRAR POR TENANT!)
    // Incluir department_id para preservar o departamento definido pela campanha redirect
    // IMPORTANTE: Buscar TODOS os matches para depois escolher o melhor (priorizar telefone com 13 dígitos)
    let { data: contactMatches } = await supabase
      .from("contacts")
      .select("id, full_name, phone, department_id, lead_status")
      .in("phone", phoneVariations)
      .eq("tenant_id", channel.tenant_id)
      .limit(10);
    
    // Selecionar o melhor contato: priorizar telefone com 13 dígitos (55 + DDD + 9 + 8)
    // Isso evita duplicatas onde um contato tem o 9º dígito e outro não
    let contact: { id: any; full_name: any; phone: any; department_id: any; lead_status: any; } | null = null;
    if (contactMatches && contactMatches.length > 0) {
      if (contactMatches.length === 1) {
        contact = contactMatches[0];
      } else {
        // Múltiplos contatos encontrados - escolher o melhor
        console.log(`[Webhook] ⚠️ Found ${contactMatches.length} contacts matching phone variations`);
        
        // Priorizar: 1) telefone com 13 dígitos (correto), 2) mais recente
        const sortedContacts = contactMatches.sort((a, b) => {
          const phoneA = a.phone?.replace(/\D/g, '') || '';
          const phoneB = b.phone?.replace(/\D/g, '') || '';
          
          // Priorizar 13 dígitos (formato correto brasileiro com 9º dígito)
          const is13DigitsA = phoneA.length === 13;
          const is13DigitsB = phoneB.length === 13;
          
          if (is13DigitsA && !is13DigitsB) return -1;
          if (!is13DigitsA && is13DigitsB) return 1;
          
          // Se ambos têm mesmo comprimento, priorizar o normalizado (incoming)
          const normalizedIncoming = normalizePhoneForStorageBR(normalizedMessage.from);
          if (phoneA === normalizedIncoming) return -1;
          if (phoneB === normalizedIncoming) return 1;
          
          return 0;
        });
        
        contact = sortedContacts[0];
        console.log(`[Webhook] Selected contact: ${contact?.full_name} (${contact?.phone}) from ${contactMatches.length} matches`);
      }
    }

    if (!contact) {
      // Preparar dados de origem baseado em referral (Meta Ads)
      let origin = "whatsapp";
      let originCampaign: string | null = null;
      let referralDataJson: any = null;
      
      if (normalizedMessage.referralData) {
        origin = "meta_ads";
        originCampaign = normalizedMessage.referralData.headline || 
                         normalizedMessage.referralData.adName || 
                         normalizedMessage.referralData.campaignName ||
                         (normalizedMessage.referralData.ctwaClid ? `CTWA ${normalizedMessage.referralData.ctwaClid.substring(0, 8)}` : null);
        referralDataJson = normalizedMessage.referralData;
        console.log(`[Webhook] 📣 New contact from Meta Ads! Campaign: ${originCampaign}`);
      }
      
      // Normalizar telefone para storage (formato canônico: 55 + DDD + número)
      const normalizedPhone = normalizePhoneForStorageBR(normalizedMessage.from);
      
      // Usar upsert para evitar duplicatas por race condition
      // NÃO incluir department_id aqui - preservar o que foi definido pela campanha redirect
      const { data: upsertedContact, error: contactError } = await supabase
        .from("contacts")
        .upsert({
          phone: normalizedPhone,
          full_name: contactName,
          origin: origin,
          origin_campaign: originCampaign,
          referral_data: referralDataJson,
          first_contact_at: new Date().toISOString(),
          tenant_id: channel.tenant_id,
          // department_id removido intencionalmente - preservar o da campanha redirect
        }, {
          onConflict: 'phone,tenant_id',
          ignoreDuplicates: false
        })
        .select("id, full_name, phone, department_id")
        .single();

      if (contactError) {
        // Se o erro for de duplicata, buscar o contato existente
        if (contactError.code === '23505') {
          console.log(`[Webhook] Contact already exists (race condition handled), fetching...`);
          const { data: existingContact } = await supabase
            .from("contacts")
            .select("id, full_name, phone, department_id")
            .in("phone", phoneVariations)
            .eq("tenant_id", channel.tenant_id)
            .limit(1)
            .maybeSingle();
          contact = existingContact;
          
          // Se o contato já existe mas tem dados de referral na mensagem atual, atualizar
          if (normalizedMessage.referralData && existingContact) {
            console.log(`[Webhook] 📣 Updating existing contact with Meta Ads data`);
            await supabase
              .from("contacts")
              .update({
                origin: "meta_ads",
                origin_campaign: originCampaign,
                referral_data: referralDataJson,
                updated_at: new Date().toISOString()
              })
              .eq("id", existingContact.id);
          }
        } else {
          console.error(`[Webhook] Error creating contact:`, contactError);
          throw contactError;
        }
      } else {
        contact = upsertedContact;
        console.log(`[Webhook] Created/upserted contact: ${contact?.full_name} (${contact?.phone})${origin === 'meta_ads' ? ' [Meta Ads]' : ''}`);
      }
    }
    
    // Atualizar nome do contato se tiver um pushName real e nome atual for genérico
    if (contact) {
      const currentName = contact.full_name || '';
      const hasGenericName = currentName.startsWith('WhatsApp ') || currentName.startsWith('Lead ') || !currentName;
      const hasBetterName = isValidContactName(normalizedMessage.fromName);
      
      if (hasGenericName && hasBetterName) {
        console.log(`[Webhook] Updating contact name from "${currentName}" to "${normalizedMessage.fromName}"`);
        await supabase
          .from("contacts")
          .update({ 
            full_name: normalizedMessage.fromName,
            updated_at: new Date().toISOString()
          })
          .eq("id", contact.id);
        contact.full_name = normalizedMessage.fromName!;
      }
    }

    // Garantir que temos um contato válido
    if (!contact) {
      console.error(`[Webhook] Failed to find or create contact for phone: ${normalizedMessage.from}`);
      return new Response(JSON.stringify({ success: false, error: "Failed to create contact" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // =====================================================
    // OWNER AGENT SETTINGS - Fetch for reassignment rules
    // =====================================================
    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("owner_agent_enabled, owner_agent_inactivity_days, owner_agent_on_reopen, owner_agent_reopen_reasons")
      .limit(1)
      .maybeSingle();

    const ownerAgentEnabled = companySettings?.owner_agent_enabled ?? true;
    const inactivityDays = companySettings?.owner_agent_inactivity_days ?? 7;
    const reopenToOwner = companySettings?.owner_agent_on_reopen ?? true;
    const reopenReasons = companySettings?.owner_agent_reopen_reasons ?? ['sold', 'no_interest', 'future_contact'];

    // Get contact's owner agent (assigned_to on contacts table)
    const { data: contactWithOwner } = await supabase
      .from("contacts")
      .select("assigned_to")
      .eq("id", contact.id)
      .single();
    
    const ownerAgentId = contactWithOwner?.assigned_to;

    // Find or create conversation - COM MIGRAÇÃO AUTOMÁTICA DE CANAL
    // 1. Primeiro, buscar conversa aberta NO MESMO CANAL
    let { data: conversation } = await supabase
      .from("conversations")
      .select("id, status, assigned_to, close_reason, last_message_at, channel_id, department_id")
      .eq("contact_id", contact.id)
      .eq("channel_id", channel.id)
      .in("status", ["open", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // 2. Se não encontrou no mesmo canal, buscar conversa aberta EM QUALQUER CANAL
    if (!conversation) {
      const { data: anyChannelConversation } = await supabase
        .from("conversations")
        .select("id, status, assigned_to, close_reason, last_message_at, channel_id, department_id")
        .eq("contact_id", contact.id)
        .eq("tenant_id", channel.tenant_id)
        .in("status", ["open", "pending"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (anyChannelConversation) {
        // 3. Migrar a conversa para o novo canal (mantém atendente e departamento)
        const oldChannelId = anyChannelConversation.channel_id;
        
        console.log(`[Webhook] 🔄 Migrating conversation ${anyChannelConversation.id} from channel ${oldChannelId} to ${channel.id}`);
        
        await supabase
          .from("conversations")
          .update({
            channel_id: channel.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", anyChannelConversation.id);

        // 4. Registrar evento de mudança de canal no histórico
        await supabase.from("conversation_events").insert({
          conversation_id: anyChannelConversation.id,
          event_type: "channel_changed",
          tenant_id: channel.tenant_id,
          data: {
            from_channel_id: oldChannelId,
            to_channel_id: channel.id,
            reason: "client_message_from_different_channel",
            preserved: {
              assigned_to: anyChannelConversation.assigned_to,
              department_id: anyChannelConversation.department_id,
            }
          }
        });

        // Atualizar referência local com o novo channel_id
        conversation = {
          ...anyChannelConversation,
          channel_id: channel.id,
        };
        
        console.log(`[Webhook] ✅ Conversation migrated successfully - Agent and department preserved`);
      }
    }

    if (!conversation) {
      // Check if there's a closed conversation to potentially reopen
      // Use retry mechanism to handle race condition when API closes conversation
      // and bot sends message immediately after (before transaction commits)
      let closedConversation = null;
      
      const findClosedConversation = async () => {
        // Search closed conversations across ALL channels (not just current)
        // This prevents creating duplicate conversations when contact messages from a different channel
        const { data } = await supabase
          .from("conversations")
          .select("id, status, assigned_to, close_reason, closed_at, closed_by, last_message_at, department_id, channel_id")
          .eq("contact_id", contact.id)
          .eq("tenant_id", channel.tenant_id)
          .eq("status", "closed")
          .order("closed_at", { ascending: false })
          .limit(1)
          .single();
        return data;
      };
      
      // First attempt
      closedConversation = await findClosedConversation();
      
      // If not found, wait 200ms and retry (handles race condition with API closure)
      if (!closedConversation) {
        console.log(`[Webhook] No closed conversation found, retrying in 200ms...`);
        await new Promise(resolve => setTimeout(resolve, 200));
        closedConversation = await findClosedConversation();
        
        if (closedConversation) {
          console.log(`[Webhook] ✅ Found closed conversation on retry: ${closedConversation.id}`);
        }
      }

      if (closedConversation) {
        // Reopen the closed conversation
        console.log(`[Webhook] Reopening closed conversation: ${closedConversation.id}`);
        
        // Store previous close data for history
        const previousCloseReason = closedConversation.close_reason;
        const previousClosedAt = closedConversation.closed_at;
        const previousClosedBy = closedConversation.closed_by;
        
        // Get current reopen count
        const { data: convData } = await supabase
          .from("conversations")
          .select("reopen_count")
          .eq("id", closedConversation.id)
          .single();
        
        const currentReopenCount = convData?.reopen_count || 0;
        
        // Determine who should be assigned based on owner agent rules
        let newAssignedTo = closedConversation.assigned_to;
        
        if (ownerAgentEnabled && ownerAgentId && reopenToOwner) {
          const closeReason = closedConversation.close_reason || '';
          if (reopenReasons.includes(closeReason) || reopenReasons.length === 0) {
            console.log(`[Webhook] 👤 Reassigning reopened conversation to owner agent: ${ownerAgentId}`);
            newAssignedTo = ownerAgentId;
          }
        }

        // Se não tem atendente atribuído, reabre como "pending", senão como "open"
        const reopenStatus = newAssignedTo ? "open" : "pending";
        
        // If reopening from a different channel, migrate it
        const needsChannelMigration = closedConversation.channel_id !== channel.id;
        if (needsChannelMigration) {
          console.log(`[Webhook] 🔄 Reopening closed conversation from different channel: ${closedConversation.channel_id} → ${channel.id}`);
        }
        
        const { error: reopenError } = await supabase
          .from("conversations")
          .update({
            status: reopenStatus,
            is_unread: true,
            unread_count: 1,
            last_message_at: new Date().toISOString(),
            last_message_preview: normalizedMessage.content.substring(0, 100),
            assigned_to: newAssignedTo,
            reopened_at: new Date().toISOString(),
            reopen_count: currentReopenCount + 1,
            previous_close_reason: previousCloseReason,
            previous_closed_at: previousClosedAt,
            previous_closed_by: previousClosedBy,
            closed_at: null,
            closed_by: null,
            close_reason: null,
            updated_at: new Date().toISOString(),
            ...(needsChannelMigration ? { channel_id: channel.id } : {}),
          })
          .eq("id", closedConversation.id);

        if (reopenError) {
          console.error(`[Webhook] Error reopening conversation:`, reopenError);
          throw reopenError;
        }

        // Register reopen event
        await supabase.from("conversation_events").insert({
          conversation_id: closedConversation.id,
          event_type: "reopen",
          actor_id: null, // Client triggered
          data: {
            previous_close_reason: previousCloseReason,
            previous_closed_at: previousClosedAt,
            trigger: "client_message",
          }
        });

        // Log event if reassigned
        if (newAssignedTo !== closedConversation.assigned_to) {
          await supabase.from("conversation_events").insert({
            conversation_id: closedConversation.id,
            event_type: "auto_reassign",
            data: {
              reason: "reopen_to_owner",
              from_user_id: closedConversation.assigned_to,
              to_user_id: newAssignedTo,
              note: "Reatribuição automática ao atendente responsável (reabertura)"
            }
          });
        }

        conversation = { 
          id: closedConversation.id, 
          status: "open", 
          assigned_to: newAssignedTo,
          close_reason: null,
          last_message_at: new Date().toISOString(),
          channel_id: channel.id,
          department_id: closedConversation.department_id || null,
        };
      } else {
        // No existing conversation - create new one
        let conversationReferralSource: string | null = null;
        let conversationReferralData: Record<string, unknown> | null = normalizedMessage.referralData ? { ...normalizedMessage.referralData } : null;
        let originDetectionMethod: string | null = null;
        
        // Priority 1: referralData from Evolution API (100% reliable when present)
        if (normalizedMessage.referralData) {
          conversationReferralSource = "meta_ads";
          originDetectionMethod = "referral_api";
          console.log(`[Webhook] 📣 Origin detected via referral_api (Evolution API)`);
        } else {
          // Priority 2: Check message pattern against ad_message_patterns table
          const messageContent = normalizedMessage.content || "";
          if (messageContent.length > 0) {
            console.log(`[Webhook] 🔍 Checking message pattern for origin detection: "${messageContent.substring(0, 100)}..."`);
            
            const { data: patternMatch, error: patternError } = await supabase
              .rpc('detect_origin_by_message_pattern', { p_message: messageContent });
            
            if (!patternError && patternMatch && patternMatch.length > 0) {
              const match = patternMatch[0];
              conversationReferralSource = match.source === 'meta_ads' ? 'meta_ads' : match.source;
              originDetectionMethod = "message_pattern";
              
              // Store pattern info in referral_data for auditing
              conversationReferralData = {
                detected_by: "message_pattern",
                pattern_id: match.pattern_id,
                source: match.source,
                campaign_name: match.campaign_name,
              };
              
              console.log(`[Webhook] 📣 Origin detected via message_pattern: ${match.source} (pattern_id: ${match.pattern_id})`);
            } else if (patternError) {
              console.error(`[Webhook] Error detecting origin pattern:`, patternError);
            }
          }
          
          // Priority 3: Check for recent conversations with referral_data for the same contact
          // This handles the case where a lead clicks an ad on one channel but messages another
          if (!conversationReferralSource) {
            console.log(`[Webhook] 🔍 Checking for recent conversations with referral_data for contact ${contact.id}...`);
            
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            
            const { data: recentConvWithReferral, error: recentError } = await supabase
              .from("conversations")
              .select("id, referral_source, referral_data, origin_detection_method, created_at")
              .eq("contact_id", contact.id)
              .not("referral_data", "is", null)
              .gte("created_at", oneHourAgo)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (recentError) {
              console.error(`[Webhook] Error checking recent conversations for referral_data:`, recentError);
            } else if (recentConvWithReferral && recentConvWithReferral.referral_data) {
              console.log(`[Webhook] 📣 Found recent conversation with referral_data: ${recentConvWithReferral.id}`);
              
              conversationReferralSource = recentConvWithReferral.referral_source || "meta_ads";
              conversationReferralData = {
                ...(recentConvWithReferral.referral_data as Record<string, unknown>),
                propagated_from: recentConvWithReferral.id,
                propagated_at: new Date().toISOString(),
              };
              originDetectionMethod = "propagated_from_related";
              
              console.log(`[Webhook] 📣 Propagated referral_data from conversation ${recentConvWithReferral.id} to new conversation`);
            }
          }
        }
        
        // For new conversations, assign to owner agent if available
        const initialAssignedTo = ownerAgentEnabled && ownerAgentId ? ownerAgentId : null;
        
        // Se tem atendente atribuído, cria como "open", senão como "pending"
        const initialStatus = initialAssignedTo ? "open" : "pending";
        
        // Usar department_id do contato (pode ter sido definido pela campanha redirect)
        // Prioridade: contact.department_id > channel.department_id
        const conversationDepartmentId = contact.department_id || channel.department_id || null;
        console.log(`[Webhook] 📍 Creating conversation with department_id: ${conversationDepartmentId} (contact: ${contact.department_id}, channel: ${channel.department_id})`);
        
        // Inherit lead_status from contact to keep consistency across channels
        const inheritedLeadStatus = contact.lead_status || 'new';
        console.log(`[Webhook] 📍 Creating conversation with inherited lead_status: ${inheritedLeadStatus} (from contact)`);
        
        const { data: newConversation, error: convError } = await supabase
          .from("conversations")
          .insert({
            contact_id: contact.id,
            channel_id: channel.id,
            department_id: conversationDepartmentId,
            tenant_id: channel.tenant_id,
            status: initialStatus,
            lead_status: inheritedLeadStatus,
            is_unread: true,
            unread_count: 1,
            last_message_at: new Date().toISOString(),
            last_message_preview: normalizedMessage.content.substring(0, 100),
            referral_source: conversationReferralSource,
            referral_data: conversationReferralData,
            origin_detection_method: originDetectionMethod,
            assigned_to: initialAssignedTo,
          })
          .select("id, status, assigned_to, close_reason, last_message_at, department_id, channel_id")
          .single();

        if (convError) {
          console.error(`[Webhook] Error creating conversation:`, convError);
          throw convError;
        }
        
        // SAFETY CHECK: After creating, verify if a very recently closed conversation exists
        // This handles extreme race conditions where retry still didn't catch the closed conversation
        const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
        const { data: recentlyClosed } = await supabase
          .from("conversations")
          .select("id, assigned_to, close_reason, closed_at, closed_by")
          .eq("contact_id", contact.id)
          .eq("channel_id", channel.id)
          .eq("status", "closed")
          .gte("closed_at", thirtySecondsAgo)
          .neq("id", newConversation.id)
          .order("closed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (recentlyClosed) {
          // Found a recently closed conversation - delete the new one and reopen the existing
          console.log(`[Webhook] ⚠️ RACE CONDITION DETECTED: Found recently closed conversation ${recentlyClosed.id} after creating new one ${newConversation.id}`);
          console.log(`[Webhook] 🔄 Deleting new conversation and reopening existing...`);
          
          // Delete the mistakenly created conversation
          await supabase.from("conversations").delete().eq("id", newConversation.id);
          
          // Get current reopen count
          const { data: convDataRecent } = await supabase
            .from("conversations")
            .select("reopen_count")
            .eq("id", recentlyClosed.id)
            .single();
          
          const currentReopenCountRecent = convDataRecent?.reopen_count || 0;
          
          // Determine who should be assigned
          let newAssignedToRecent = recentlyClosed.assigned_to;
          if (ownerAgentEnabled && ownerAgentId && reopenToOwner) {
            const closeReasonRecent = recentlyClosed.close_reason || '';
            if (reopenReasons.includes(closeReasonRecent) || reopenReasons.length === 0) {
              newAssignedToRecent = ownerAgentId;
            }
          }
          
          const reopenStatusRecent = newAssignedToRecent ? "open" : "pending";
          
          // Reopen the recently closed conversation
          await supabase
            .from("conversations")
            .update({
              status: reopenStatusRecent,
              is_unread: true,
              unread_count: 1,
              last_message_at: new Date().toISOString(),
              last_message_preview: normalizedMessage.content.substring(0, 100),
              assigned_to: newAssignedToRecent,
              reopened_at: new Date().toISOString(),
              reopen_count: currentReopenCountRecent + 1,
              previous_close_reason: recentlyClosed.close_reason,
              previous_closed_at: recentlyClosed.closed_at,
              previous_closed_by: recentlyClosed.closed_by,
              closed_at: null,
              closed_by: null,
              close_reason: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", recentlyClosed.id);
          
          // Register reopen event
          await supabase.from("conversation_events").insert({
            conversation_id: recentlyClosed.id,
            event_type: "reopen",
            actor_id: null,
            data: {
              previous_close_reason: recentlyClosed.close_reason,
              previous_closed_at: recentlyClosed.closed_at,
              trigger: "client_message_race_condition_fix",
            }
          });
          
          console.log(`[Webhook] ✅ Successfully reopened conversation ${recentlyClosed.id} instead of creating duplicate`);
          
          conversation = { 
            id: recentlyClosed.id, 
            status: reopenStatusRecent, 
            assigned_to: newAssignedToRecent,
            close_reason: null,
            last_message_at: new Date().toISOString(),
            channel_id: channel.id,
            department_id: null,
          };
        } else {
          conversation = newConversation;
          
          if (conversationReferralSource) {
            console.log(`[Webhook] 📣 New conversation from ${conversationReferralSource}! (detected via ${originDetectionMethod})`);
          }
          if (initialAssignedTo) {
            console.log(`[Webhook] 👤 New conversation assigned to owner agent: ${initialAssignedTo}`);
          }
          
          // ⚡ BROADCAST: Notificar todos os usuários do tenant sobre nova conversa
          // Isso garante que usuários vejam a conversa mesmo se RLS bloquear postgres_changes
          try {
            const broadcastChannel = supabase.channel('new-conversations');
            await broadcastChannel.send({
              type: 'broadcast',
              event: 'new-conversation',
              payload: {
                tenantId: channel.tenant_id,
                departmentId: conversationDepartmentId,
                conversationId: newConversation.id,
                timestamp: new Date().toISOString()
              }
            });
            await supabase.removeChannel(broadcastChannel);
            console.log(`[Webhook] ⚡ Broadcast sent for new conversation ${newConversation.id}`);
          } catch (broadcastError) {
            console.error(`[Webhook] ⚠️ Failed to send broadcast:`, broadcastError);
          }

          // 🆕 TRIGGER FIRST_MESSAGE AUTOMATION para nova conversa
          try {
            console.log(`[Webhook] 🆕 New conversation detected, triggering first_message automation for channel ${channel.id}...`);
            await supabase.functions.invoke('process-flow-triggers', {
              body: {
                trigger_type: 'first_message',
                tenant_id: channel.tenant_id,
                contact_id: contact.id,
                channel_id: channel.id,
                conversation_id: newConversation.id,
                message_content: normalizedMessage.content,
              }
            });
            console.log('[Webhook] ✅ First message automation check completed');
          } catch (flowError) {
            console.error('[Webhook] ⚠️ Error triggering first_message automation:', flowError);
          }
        }
      }
    } else {
      // Conversation exists and is open - check inactivity rules
      let shouldReassignToOwner = false;
      
      if (ownerAgentEnabled && ownerAgentId && conversation.assigned_to !== ownerAgentId) {
        // Check if inactivity threshold is exceeded
        if (conversation.last_message_at) {
          const lastMessageDate = new Date(conversation.last_message_at);
          const daysSinceLastMessage = Math.floor((Date.now() - lastMessageDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSinceLastMessage >= inactivityDays) {
            console.log(`[Webhook] 👤 Inactivity threshold exceeded (${daysSinceLastMessage} days >= ${inactivityDays}), reassigning to owner`);
            shouldReassignToOwner = true;
          }
        }
      }

      // Update existing conversation
      const updateData: any = {
        last_message_at: new Date().toISOString(),
        last_message_preview: normalizedMessage.content.substring(0, 100),
        updated_at: new Date().toISOString(),
      };

      if (shouldReassignToOwner) {
        updateData.assigned_to = ownerAgentId;
        
        // Log reassignment event
        await supabase.from("conversation_events").insert({
          conversation_id: conversation.id,
          event_type: "auto_reassign",
          data: {
            reason: "inactivity",
            from_user_id: conversation.assigned_to,
            to_user_id: ownerAgentId,
            days_inactive: inactivityDays,
            note: `Reatribuição automática ao atendente responsável (${inactivityDays} dias de inatividade)`
          }
        });
      }

      await supabase.rpc("increment_unread", { conv_id: conversation.id });
      await supabase
        .from("conversations")
        .update(updateData)
        .eq("id", conversation.id);
    }

    // Ensure conversation is not null before proceeding
    if (!conversation) {
      console.error(`[Webhook] Failed to find or create conversation`);
      return new Response(JSON.stringify({ success: false, error: "Failed to create conversation" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // =====================================================
    // UPLOAD MEDIA TO STORAGE (received message)
    // =====================================================
    let finalMediaUrl = normalizedMessage.mediaUrl;
    
    // Check if it's a media type that needs processing
    const isMediaType = ['audio', 'image', 'video', 'document'].includes(normalizedMessage.type);
    
    // =====================================================
    // UAZAPI: Download media using /message/download endpoint
    // UAZAPI doesn't provide media URLs or base64 directly in webhook
    // We need to download using the messageid
    // =====================================================
    if (isMediaType && !normalizedMessage.mediaBase64 && provider === 'uazapi') {
      console.log(`[Webhook UAZAPI] Processing ${normalizedMessage.type} - downloading from UAZAPI...`);
      
      const uazapiMedia = await processUAZAPIMedia(
        supabase,
        normalizedMessage.instanceId,
        normalizedMessage.originalId.replace('uazapi_', ''), // Remove prefix to get raw messageid
        normalizedMessage.type,
        conversation.id
      );
      
      if (uazapiMedia.mediaUrl) {
        finalMediaUrl = uazapiMedia.mediaUrl;
        normalizedMessage.mediaMimeType = uazapiMedia.mimeType || normalizedMessage.mediaMimeType;
        console.log(`[Webhook UAZAPI] ✅ Media processed and uploaded: ${finalMediaUrl}`);
      } else {
        console.log(`[Webhook UAZAPI] ⚠️ Could not process media, continuing without media URL`);
      }
    }
    // =====================================================
    // Evolution API: Fetch base64 from getBase64FromMediaMessage
    // =====================================================
    else if (isMediaType && !normalizedMessage.mediaBase64 && provider === 'evolution') {
      console.log(`[Webhook] Received media without base64, fetching from Evolution API...`);
      const channelProvider = (channel as any).provider;
      if (channelProvider?.code === 'evolution' && channelProvider?.base_url && channelProvider?.admin_token) {
        const mediaData = await fetchMediaBase64FromEvolution(
          channelProvider.base_url,
          channelProvider.admin_token,
          channel.instance_id || '',
          {
            id: normalizedMessage.originalId,
            remoteJid: normalizedMessage.from + '@s.whatsapp.net',
            fromMe: normalizedMessage.isFromMe
          }
        );
        if (mediaData.base64) {
          normalizedMessage.mediaBase64 = mediaData.base64;
          normalizedMessage.mediaMimeType = mediaData.mimetype || normalizedMessage.mediaMimeType;
        }
      }
    }
    
    // Now upload if we have base64 (Evolution API or other providers)
    if (normalizedMessage.mediaBase64 && normalizedMessage.mediaMimeType && !finalMediaUrl?.includes('supabase')) {
      console.log(`[Webhook] Uploading media for received message...`);
      const uploadedUrl = await uploadMediaToStorage(
        supabase,
        normalizedMessage.mediaBase64,
        normalizedMessage.mediaMimeType,
        conversation.id
      );
      if (uploadedUrl) {
        finalMediaUrl = uploadedUrl;
        console.log(`[Webhook] Received media uploaded, using Supabase URL`);
      }
    }

    // Find reply_to_message_id if quotedMessageId exists
    let replyToMessageId = null;
    if (normalizedMessage.quotedMessageId) {
      console.log(`[Webhook] Looking for quoted message: ${normalizedMessage.quotedMessageId}`);
      const { data: quotedMsg } = await supabase
        .from("messages")
        .select("id")
        .eq("whatsapp_message_id", normalizedMessage.quotedMessageId)
        .single();
      
      if (quotedMsg) {
        replyToMessageId = quotedMsg.id;
        console.log(`[Webhook] Found quoted message, reply_to_message_id: ${replyToMessageId}`);
      } else {
        console.log(`[Webhook] Quoted message not found in database`);
      }
    }

    // Check if message already exists (deduplicate webhooks OR update edited message)
    const { data: existingReceivedMsg } = await supabase
      .from("messages")
      .select("id, created_at, trigger_processed, content")
      .eq("whatsapp_message_id", normalizedMessage.originalId)
      .maybeSingle();

    // =====================================================
    // CORREÇÃO: Mensagem editada pelo cliente - fazer UPDATE
    // =====================================================
    if (existingReceivedMsg && normalizedMessage.isEdited) {
      console.log(`[Webhook] ✏️ Updating edited message from client (id: ${existingReceivedMsg.id})`);
      
      const { error: updateError } = await supabase
        .from("messages")
        .update({
          content: normalizedMessage.content,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingReceivedMsg.id);
      
      if (updateError) {
        console.error(`[Webhook] Error updating edited message:`, updateError);
      } else {
        console.log(`[Webhook] ✅ Message updated successfully`);
      }
      
      return new Response(JSON.stringify({ success: true, message: "Edited message updated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingReceivedMsg) {
      console.log(`[Webhook] Received message already exists (id: ${existingReceivedMsg.id}), checking trigger...`);
      
      // CORREÇÃO: Disparar trigger se a mensagem é recente e ainda não foi processada
      // Isso resolve o problema de race-condition onde a mensagem foi inserida mas o trigger não foi disparado
      const isRecent = existingReceivedMsg.created_at && 
        (Date.now() - new Date(existingReceivedMsg.created_at).getTime()) < 60000;
      
      if (isRecent && !existingReceivedMsg.trigger_processed) {
        try {
          console.log(`[Webhook] 🔄 Triggering keyword automation for duplicate received message...`);
          await supabase.functions.invoke('process-flow-triggers', {
            body: {
              trigger_type: 'keyword',
              tenant_id: channel.tenant_id,
              contact_id: contact.id,
              channel_id: channel.id,
              conversation_id: conversation.id,
              message_content: existingReceivedMsg.content || normalizedMessage.content,
            }
          });
          
          // Marcar como processado para evitar disparos duplicados
          await supabase.from("messages").update({ trigger_processed: true }).eq("id", existingReceivedMsg.id);
          console.log(`[Webhook] ✅ Trigger processed for duplicate received message`);
        } catch (triggerErr) {
          console.error(`[Webhook] Error processing trigger for duplicate:`, triggerErr);
        }
      }
      
      return new Response(JSON.stringify({ success: true, message: "Message already exists" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save message
    const { error: msgError } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      contact_id: contact.id,
      content: normalizedMessage.content,
      message_type: normalizedMessage.type,
      media_url: finalMediaUrl,
      media_mime_type: normalizedMessage.mediaMimeType,
      is_from_me: false,
      status: "delivered",
      whatsapp_message_id: normalizedMessage.originalId,
      created_at: normalizedMessage.timestamp.toISOString(),
      reply_to_message_id: replyToMessageId,
      tenant_id: channel.tenant_id,
    });

    if (msgError) {
      console.error(`[Webhook] Error saving message:`, msgError);
      throw msgError;
    }

    // =====================================================
    // OTIMIZAÇÃO: QUERIES PARALELAS para reduzir latência
    // Todas essas verificações são independentes e podem rodar em paralelo
    // =====================================================
    const [
      surveyResult,
      quotesResult,
      rescuesResult,
      marketingResult
    ] = await Promise.all([
      // 1. Check pending satisfaction survey
      supabase
        .from('satisfaction_surveys')
        .select('id, survey_type, conversation_id, agent_id')
        .eq('contact_id', contact.id)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      
      // 2. Check active quotes for auto-pause
      supabase
        .from('quotes')
        .select('id, quote_number')
        .eq('contact_id', contact.id)
        .eq('notifications_auto_paused', false)
        .in('status', ['sent', 'approved', 'pending']),
      
      // 3. Check active rescues for cancellation
      supabase
        .from('active_rescues')
        .select('id, conversation_id, template_id')
        .eq('contact_id', contact.id)
        .eq('status', 'active'),
      
      // 4. Check active marketing campaigns
      supabase
        .from('active_marketing_campaigns')
        .select(`
          id,
          campaign_id,
          conversation_id,
          current_step,
          tenant_id,
          dispatch_id,
          created_at,
          marketing_campaign:marketing_campaigns(id, steps, title),
          bulk_dispatch:bulk_dispatches(id, created_by)
        `)
        .eq('contact_id', contact.id)
        .eq('status', 'active')
    ]);

    // =====================================================
    // SATISFACTION SURVEY RESPONSE DETECTION
    // =====================================================
    try {
      const pendingSurvey = surveyResult.data;
      const surveyError = surveyResult.error;

      if (!surveyError && pendingSurvey) {
        const messageContent = normalizedMessage.content.trim();
        let score: number | null = null;
        let classification: string | null = null;

        if (pendingSurvey.survey_type === 'nps') {
          // NPS: Extract number 0-10 from response
          const npsMatch = messageContent.match(/^(\d+)$/);
          if (npsMatch) {
            const npsScore = parseInt(npsMatch[1], 10);
            if (npsScore >= 0 && npsScore <= 10) {
              score = npsScore;
              // NPS Classification
              if (npsScore >= 9) {
                classification = 'promoter';
              } else if (npsScore >= 7) {
                classification = 'passive';
              } else {
                classification = 'detractor';
              }
              console.log(`[Webhook] 📊 NPS response detected: ${score} (${classification})`);
            }
          }
        } else if (pendingSurvey.survey_type === 'csat') {
          // CSAT: Extract 1, 3, or 5 from response
          const csatMatch = messageContent.match(/^([135])$/);
          if (csatMatch) {
            score = parseInt(csatMatch[1], 10);
            // CSAT Classification
            if (score === 5) {
              classification = 'satisfied';
            } else if (score === 3) {
              classification = 'neutral';
            } else {
              classification = 'dissatisfied';
            }
            console.log(`[Webhook] 📊 CSAT response detected: ${score} (${classification})`);
          }
          
          // Also check for emoji responses
          if (!score) {
            if (messageContent.includes('😊') || messageContent.toLowerCase().includes('ótimo') || messageContent.toLowerCase().includes('otimo')) {
              score = 5;
              classification = 'satisfied';
            } else if (messageContent.includes('😐') || messageContent.toLowerCase().includes('regular')) {
              score = 3;
              classification = 'neutral';
            } else if (messageContent.includes('😞') || messageContent.toLowerCase().includes('ruim')) {
              score = 1;
              classification = 'dissatisfied';
            }
            if (score) {
              console.log(`[Webhook] 📊 CSAT emoji/text response detected: ${score} (${classification})`);
            }
          }
        }

        // Update survey with response
        if (score !== null) {
          const { error: updateError } = await supabase
            .from('satisfaction_surveys')
            .update({
              score: score,
              nps_classification: classification,
              status: 'responded',
              responded_at: new Date().toISOString(),
              response_text: messageContent,
            })
            .eq('id', pendingSurvey.id);

          if (updateError) {
            console.error(`[Webhook] Error updating satisfaction survey:`, updateError);
          } else {
            console.log(`[Webhook] ✅ Satisfaction survey ${pendingSurvey.id} updated with score ${score}`);
          }
        }
      }
    } catch (satisfactionError) {
      // Non-critical error - log but don't fail the webhook
      console.error(`[Webhook] Error processing satisfaction response:`, satisfactionError);
    }

    // =====================================================
    // AUTO-PAUSE QUOTE NOTIFICATIONS ON CLIENT RESPONSE
    // =====================================================
    try {
      const activeQuotes = quotesResult.data;
      const quotesError = quotesResult.error;

      if (quotesError) {
        console.error(`[Webhook] Error checking quotes for auto-pause:`, quotesError);
      } else if (activeQuotes && activeQuotes.length > 0) {
        console.log(`[Webhook] 📋 Client responded - auto-pausing ${activeQuotes.length} quote(s)`);
        
        for (const quote of activeQuotes) {
          // Pause quote notifications
          const { error: pauseError } = await supabase
            .from('quotes')
            .update({
              notifications_auto_paused: true,
              notifications_auto_pause_reason: 'client_responded',
            })
            .eq('id', quote.id);
          
          if (pauseError) {
            console.error(`[Webhook] Error pausing quote ${quote.quote_number}:`, pauseError);
          } else {
            console.log(`[Webhook] ✅ Auto-paused notifications for quote ${quote.quote_number}`);
          }
          
          // Cancel pending notifications for this quote
          const { error: cancelError } = await supabase
            .from('quote_expiration_notifications')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              cancel_reason: 'client_responded',
            })
            .eq('quote_id', quote.id)
            .eq('status', 'pending');
          
          if (cancelError) {
            console.error(`[Webhook] Error cancelling notifications for quote ${quote.quote_number}:`, cancelError);
          }
        }
      }
    } catch (autoPauseError) {
      // Non-critical error - log but don't fail the webhook
      console.error(`[Webhook] Error in quote auto-pause logic:`, autoPauseError);
    }

    // =====================================================
    // AUTO-CANCEL RESCUE ON CLIENT RESPONSE - BY CONTACT
    // =====================================================
    try {
      const activeRescues = rescuesResult.data;
      const rescueError = rescuesResult.error;

      if (rescueError) {
        console.error(`[Webhook] Error checking active rescues:`, rescueError);
      } else if (activeRescues && activeRescues.length > 0) {
        console.log(`[Webhook] 🛑 Client responded - cancelling ${activeRescues.length} rescue(s) for contact ${contact.id}`);
        
        for (const rescue of activeRescues) {
          // Update rescue status to responded
          const { error: cancelRescueError } = await supabase
            .from('active_rescues')
            .update({ 
              status: 'responded',
              responded_at: new Date().toISOString(),
            })
            .eq('id', rescue.id);
          
          if (cancelRescueError) {
            console.error(`[Webhook] Error cancelling rescue ${rescue.id}:`, cancelRescueError);
            continue;
          }
          
          // Cancel all pending scheduled messages for this rescue
          const { error: cancelMessagesError } = await supabase
            .from('rescue_scheduled_messages')
            .update({ 
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
            })
            .eq('rescue_id', rescue.id)
            .eq('status', 'pending');
          
          if (cancelMessagesError) {
            console.error(`[Webhook] Error cancelling rescue messages for ${rescue.id}:`, cancelMessagesError);
          } else {
            console.log(`[Webhook] ✅ Rescue ${rescue.id} cancelled (conversation: ${rescue.conversation_id})`);
          }
        }
      }
    } catch (rescueCancelError) {
      // Non-critical error - log but don't fail the webhook
      console.error(`[Webhook] Error in rescue cancel logic:`, rescueCancelError);
    }

    // =====================================================
    // AUTO-PROCESS MARKETING ON_REPLY_ACTIONS
    // When a client responds, execute on_reply_actions for active marketing campaigns
    // =====================================================
    try {
      const activeMarketingCampaigns = marketingResult.data;
      const marketingError = marketingResult.error;

      if (marketingError) {
        console.error(`[Webhook] Error checking active marketing campaigns:`, marketingError);
      } else if (activeMarketingCampaigns && activeMarketingCampaigns.length > 0) {
        console.log(`[Webhook] 🎯 Client responded - found ${activeMarketingCampaigns.length} marketing campaign(s) for contact ${contact.id}`);
        
        // Process only the most recent active campaign to avoid conflicts
        const sortedCampaigns = [...activeMarketingCampaigns].sort((a, b) => 
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
        const activeCampaign = sortedCampaigns[0];
        
        // Mark other campaigns as responded (they're superseded by the most recent)
        if (sortedCampaigns.length > 1) {
          const otherCampaignIds = sortedCampaigns.slice(1).map(c => c.id);
          await supabase
            .from('active_marketing_campaigns')
            .update({ 
              status: 'responded',
              responded_at: new Date().toISOString(),
            })
            .in('id', otherCampaignIds);
          console.log(`[Webhook] Marked ${otherCampaignIds.length} older campaigns as responded`);
        }
        
        // Process only the most recent campaign
        const marketingCampaign = activeCampaign.marketing_campaign as any;
        const steps = marketingCampaign?.steps || [];
        const currentStepIndex = activeCampaign.current_step || 0;
        const currentStep = steps[currentStepIndex] as any;

        if (!currentStep) {
          console.log(`[Webhook] No current step found for campaign ${activeCampaign.campaign_id}`);
        } else {
          // Check expected_keywords filter (if configured)
          // Normalize: lowercase, remove accents and special characters
          const normalizeForMatch = (t: string) =>
            t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').trim();

          const expectedKeywords = (currentStep.expected_keywords as string[]) || [];
          const incomingNormalized = normalizeForMatch(normalizedMessage.content || '');
          const keywordsMatch = expectedKeywords.length === 0 ||
            expectedKeywords.some(kw => incomingNormalized.includes(normalizeForMatch(kw)));

          if (!keywordsMatch) {
            console.log(`[Webhook] ⏭️ Marketing campaign ${marketingCampaign?.title}: response "${normalizedMessage.content}" did not match keywords [${expectedKeywords.join(', ')}], skipping`);
          } else {

          const onReplyActions = currentStep.on_reply_actions || [];
          console.log(`[Webhook] Campaign ${marketingCampaign?.title}: Step ${currentStepIndex}, ${onReplyActions.length} on_reply_actions`);

          if (onReplyActions.length === 0) {
            // No actions defined, just mark as responded and cancel pending messages
            await supabase
              .from('active_marketing_campaigns')
              .update({ 
                status: 'responded',
                responded_at: new Date().toISOString(),
              })
              .eq('id', activeCampaign.id);
            
            await supabase
              .from('marketing_scheduled_messages')
              .update({ 
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
              })
              .eq('active_campaign_id', activeCampaign.id)
              .eq('status', 'pending');
            
            console.log(`[Webhook] ✅ Marketing campaign ${activeCampaign.id} marked as responded (no actions)`);
          } else {
            // Execute on_reply_actions
            let shouldCancelCampaign = false;
            let shouldSendNextMessage = false;

            for (const action of onReplyActions) {
              const actionType = action.type;
              const config = action.config || {};

              console.log(`[Webhook] Executing marketing action: ${actionType}`, config);

              try {
                switch (actionType) {
                  case 'send_next_message':
                    shouldSendNextMessage = true;
                    break;

                  case 'cancel_campaign':
                    shouldCancelCampaign = true;
                    break;

                  case 'close':
                    await supabase
                      .from('conversations')
                      .update({
                        status: 'closed',
                        close_reason: config?.close_reason_id || 'marketing_completed',
                        closed_at: new Date().toISOString(),
                      })
                      .eq('id', activeCampaign.conversation_id);
                    console.log(`[Webhook] Conversation closed`);
                    break;

                  case 'transfer_department':
                    if (config?.department_id) {
                      await supabase
                        .from('conversations')
                        .update({ department_id: config.department_id })
                        .eq('id', activeCampaign.conversation_id);
                      console.log(`[Webhook] Transferred to department: ${config.department_id}`);
                    }
                    break;

                  case 'transfer_agent':
                    if (config?.agent_id) {
                      await supabase
                        .from('conversations')
                        .update({ assigned_to: config.agent_id })
                        .eq('id', activeCampaign.conversation_id);
                      console.log(`[Webhook] Transferred to agent: ${config.agent_id}`);
                    }
                    break;

                  case 'transfer_owner':
                    const { data: contactOwner } = await supabase
                      .from('contacts')
                      .select('assigned_to')
                      .eq('id', contact.id)
                      .single();
                    
                    if (contactOwner?.assigned_to) {
                      await supabase
                        .from('conversations')
                        .update({ assigned_to: contactOwner.assigned_to })
                        .eq('id', activeCampaign.conversation_id);
                      console.log(`[Webhook] Transferred to owner: ${contactOwner.assigned_to}`);
                    }
                    break;

                  case 'add_tag':
                    if (config?.tag_id) {
                      await supabase
                        .from('contact_tags')
                        .upsert(
                          { contact_id: contact.id, tag_id: config.tag_id, tenant_id: activeCampaign.tenant_id },
                          { onConflict: 'contact_id,tag_id' }
                        );
                      console.log(`[Webhook] Tag added: ${config.tag_id}`);
                    }
                    break;

                  case 'remove_tag':
                    if (config?.tag_id) {
                      await supabase
                        .from('contact_tags')
                        .delete()
                        .eq('contact_id', contact.id)
                        .eq('tag_id', config.tag_id);
                      console.log(`[Webhook] Tag removed: ${config.tag_id}`);
                    }
                    break;

                  case 'change_lead_status': {
                    const statusIdOrName = config?.lead_status_id || config?.lead_status;
                    if (statusIdOrName) {
                      let resolvedStatusName = statusIdOrName as string;
                      // If it looks like a UUID, resolve to status name
                      if (resolvedStatusName.includes('-') && resolvedStatusName.length > 30) {
                        const { data: statusLookup } = await supabase
                          .from('lead_statuses')
                          .select('name')
                          .eq('id', resolvedStatusName)
                          .single();
                        if (statusLookup?.name) {
                          resolvedStatusName = statusLookup.name;
                        }
                      }
                      await supabase
                        .from('contacts')
                        .update({ lead_status: resolvedStatusName })
                        .eq('id', contact.id);
                      console.log(`[Webhook] Lead status changed to: ${resolvedStatusName}`);
                    }
                    break;
                  }

                  case 'add_segment':
                    if (config?.segment_id) {
                      await supabase
                        .from('contacts')
                        .update({ segment_id: config.segment_id })
                        .eq('id', contact.id);
                      console.log(`[Webhook] Segment added: ${config.segment_id}`);
                    }
                    break;

                  case 'add_internal_note':
                    if (config?.internal_note_content && activeCampaign.conversation_id) {
                      // Replace variables in note content
                      const noteContent = config.internal_note_content
                        .replace(/\{\{nome\}\}/gi, contact.full_name || '')
                        .replace(/\{\{telefone\}\}/gi, contact.phone || '')
                        .replace(/\{\{data\}\}/gi, new Date().toLocaleDateString('pt-BR'));
                      
                      // Get author_id from bulk_dispatch creator or fallback
                      const bulkDispatch = (activeCampaign as any).bulk_dispatch;
                      const authorId = bulkDispatch?.created_by;
                      
                      if (!authorId) {
                        console.error(`[Webhook] Cannot create internal note - no author_id available`);
                      } else {
                        await supabase
                          .from('internal_notes')
                          .insert({
                            conversation_id: activeCampaign.conversation_id,
                            content: `[Marketing] ${noteContent}`,
                            tenant_id: channel.tenant_id,
                            author_id: authorId,
                          });
                        console.log(`[Webhook] Internal note added for conversation: ${activeCampaign.conversation_id} by author: ${authorId}`);
                      }
                    }
                    break;

                  default:
                    console.log(`[Webhook] Unknown marketing action type: ${actionType}`);
                }
              } catch (actionError) {
                console.error(`[Webhook] Error executing action ${actionType}:`, actionError);
              }
            }

            // Handle send_next_message action - SEND IMMEDIATELY VIA WHATSAPP API
            if (shouldSendNextMessage && !shouldCancelCampaign) {
              const nextStepIndex = currentStepIndex + 1;
              const nextStep = steps[nextStepIndex] as any;

              if (nextStep) {
                // Get contact data for variable replacement
                const { data: contactData } = await supabase
                  .from('contacts')
                  .select('full_name, phone, email')
                  .eq('id', contact.id)
                  .single();

                // Simple variable replacement
                const replaceVars = (text: string) => {
                  const now = new Date();
                  const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
                  const hour = brasiliaTime.getHours();
                  const greeting = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';
                  
                  return text
                    .replace(/\{\{nome\}\}/gi, contactData?.full_name || '')
                    .replace(/\{\{telefone\}\}/gi, contactData?.phone || '')
                    .replace(/\{\{email\}\}/gi, contactData?.email || '')
                    .replace(/\{\{data\}\}/gi, brasiliaTime.toLocaleDateString('pt-BR'))
                    .replace(/\{\{saudacao\}\}/gi, greeting)
                    .replace(/\{\{atendente\}\}/gi, '');
                };

                const processedContent = replaceVars(nextStep.message || '');
                const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
                const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

                console.log(`[Webhook] 🚀 Sending next message IMMEDIATELY (step ${nextStepIndex}) for campaign ${activeCampaign.id}`);

                // Helper function to send message and insert to DB
                const sendImmediateMessage = async (type: string, content: string, mediaUrl: string | null) => {
                  try {
                    // 1. Insert message as pending
                    const { data: insertedMsg, error: insertError } = await supabase
                      .from('messages')
                      .insert({
                        conversation_id: activeCampaign.conversation_id,
                        contact_id: contact.id,
                        content: content,
                        is_from_me: true,
                        message_type: type,
                        media_url: mediaUrl,
                        status: 'pending',
                        whatsapp_message_id: null,
                      })
                      .select('id')
                      .single();

                    if (insertError) {
                      console.error(`[Webhook] Error inserting ${type} message:`, insertError);
                      return;
                    }

                    console.log(`[Webhook] Inserted pending ${type} message: ${insertedMsg.id}`);

                    // 2. Send via WhatsApp API
                    const sendResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-instance`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseServiceKey}`,
                      },
                      body: JSON.stringify({
                        action: 'send',
                        channelId: channel.id,
                        phone: contactData?.phone || contact.phone,
                        content: content,
                        type: type,
                        mediaUrl: mediaUrl,
                      }),
                    });

                    const sendResult = await sendResponse.json();

                    if (!sendResponse.ok || sendResult.error) {
                      console.error(`[Webhook] Error sending ${type}:`, sendResult);
                      await supabase.from('messages').delete().eq('id', insertedMsg.id);
                      return;
                    }

                    console.log(`[Webhook] ✅ ${type} message sent via WhatsApp:`, sendResult);

                    // 3. Update message as sent
                    await supabase
                      .from('messages')
                      .update({
                        whatsapp_message_id: sendResult?.messageId,
                        status: 'sent',
                      })
                      .eq('id', insertedMsg.id);

                  } catch (sendError) {
                    console.error(`[Webhook] Error in sendImmediateMessage:`, sendError);
                  }
                };

                // Send TEXT message (if exists)
                if (processedContent?.trim()) {
                  await sendImmediateMessage('text', processedContent, null);
                }

                // Send AUDIO (if exists)
                if (nextStep.audio_url) {
                  await sendImmediateMessage('audio', '', nextStep.audio_url);
                }

                // Send ATTACHMENT (if exists)
                if (nextStep.attachment_url) {
                  await sendImmediateMessage('document', '', nextStep.attachment_url);
                }

                // Insert into marketing_scheduled_messages as 'sent' for tracking
                await supabase
                  .from('marketing_scheduled_messages')
                  .insert({
                    active_campaign_id: activeCampaign.id,
                    step_number: nextStepIndex,
                    scheduled_for: new Date().toISOString(),
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    content: processedContent,
                    audio_url: nextStep.audio_url || null,
                    attachment_url: nextStep.attachment_url || null,
                    tenant_id: activeCampaign.tenant_id,
                  });

                // Update campaign current step
                await supabase
                  .from('active_marketing_campaigns')
                  .update({ 
                    current_step: nextStepIndex,
                    responded_at: new Date().toISOString(),
                  })
                  .eq('id', activeCampaign.id);

                console.log(`[Webhook] ✅ Next message sent immediately (step ${nextStepIndex}) for campaign ${activeCampaign.id}`);
              } else {
                // No more steps, mark as completed
                await supabase
                  .from('active_marketing_campaigns')
                  .update({ 
                    status: 'completed',
                    responded_at: new Date().toISOString(),
                  })
                  .eq('id', activeCampaign.id);
                
                console.log(`[Webhook] ✅ Marketing campaign ${activeCampaign.id} completed (no more steps)`);
              }
            } else if (shouldCancelCampaign) {
              // Only cancel if explicitly requested
              await supabase
                .from('marketing_scheduled_messages')
                .update({ 
                  status: 'cancelled',
                  cancelled_at: new Date().toISOString(),
                })
                .eq('active_campaign_id', activeCampaign.id)
                .eq('status', 'pending');

              await supabase
                .from('active_marketing_campaigns')
                .update({ 
                  status: 'cancelled',
                  responded_at: new Date().toISOString(),
                })
                .eq('id', activeCampaign.id);

              console.log(`[Webhook] ✅ Marketing campaign ${activeCampaign.id} cancelled by action`);
            }
            // Note: If neither send_next_message nor cancel_campaign, campaign stays active for other actions
          }

          // =====================================================
          // UPDATE BULK DISPATCH STATS (responded count)
          // =====================================================
          if (activeCampaign.dispatch_id) {
            try {
              // Update bulk_dispatch_contacts with responded_at
              const { error: updateContactError } = await supabase
                .from('bulk_dispatch_contacts')
                .update({ responded_at: new Date().toISOString() })
                .eq('dispatch_id', activeCampaign.dispatch_id)
                .eq('contact_id', contact.id)
                .is('responded_at', null);

              if (updateContactError) {
                console.error(`[Webhook] Error updating bulk_dispatch_contacts:`, updateContactError);
              } else {
                // Increment responded_count in bulk_dispatches using RPC
                const { error: rpcError } = await supabase.rpc('increment_dispatch_responded', {
                  p_dispatch_id: activeCampaign.dispatch_id
                });

                if (rpcError) {
                  console.error(`[Webhook] Error incrementing dispatch responded count:`, rpcError);
                } else {
                  console.log(`[Webhook] ✅ Updated bulk dispatch responded stats for dispatch ${activeCampaign.dispatch_id}`);
                }
              }
            } catch (dispatchError) {
              console.error(`[Webhook] Error updating dispatch stats:`, dispatchError);
            }
          }
          } // end keywordsMatch else
        }
      }
    } catch (marketingCancelError) {
      // Non-critical error - log but don't fail the webhook
      console.error(`[Webhook] Error in marketing on_reply_actions logic:`, marketingCancelError);
    }

    // Update channel stats
    await supabase
      .from("whatsapp_channels")
      .update({
        messages_received: (channel as any).messages_received + 1 || 1,
        messages_received_today: (channel as any).messages_received_today + 1 || 1,
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", channel.id);

    // =====================================================
    // RESUME WAITING FLOWS (verificar se há fluxo aguardando resposta)
    // =====================================================
    let flowResumed = false;
    try {
      console.log(`[Webhook] 🔄 Checking for waiting flow executions for contact ${contact.id}...`);
      
      const { data: waitingExecution, error: waitingError } = await supabase
        .from('flow_executions')
        .select('id, current_node_id, flow_id, variables, conversation_id, tenant_id')
        .eq('contact_id', contact.id)
        .eq('status', 'waiting_reply')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (waitingError) {
        console.error(`[Webhook] Error checking waiting flows:`, waitingError);
      } else if (waitingExecution) {
        console.log(`[Webhook] 🔄 Found waiting execution ${waitingExecution.id}, resuming with response: "${normalizedMessage.content}"`);
        flowResumed = true;
        
        const variables = waitingExecution.variables as Record<string, any> || {};
        const expectedResponses = (variables.expected_responses as Array<{ id: string; label: string; keywords: string[] }>) || [];
        const waitingNodeSubtype = variables.waiting_node_subtype as string;
        
        // Normalizar a resposta do cliente para comparação
        const clientResponse = normalizedMessage.content.toLowerCase().trim();
        
        // Atualizar variáveis com a última resposta
        const updatedVariables: Record<string, any> = {
          ...variables,
          ultima_resposta: normalizedMessage.content
        };
        
        // Limpar variáveis temporárias
        delete updatedVariables.expected_responses;
        delete updatedVariables.waiting_node_subtype;
        
        // Determinar qual saída usar
        let sourceHandle = 'replied'; // Padrão para wait_reply simples
        
        // Se é o bloco híbrido send_text_wait_reply, verificar qual resposta esperada foi dada
        if (waitingNodeSubtype === 'send_text_wait_reply' && expectedResponses.length > 0) {
          console.log(`[Webhook] 🎯 Bloco híbrido detectado com ${expectedResponses.length} respostas esperadas`);
          
          // Procurar por uma resposta que corresponda
          let matchedResponse: { id: string; label: string } | null = null;
          
          for (const response of expectedResponses) {
            const keywords = (response.keywords || []).map(k => k.toLowerCase().trim());
            if (keywords.some(keyword => clientResponse === keyword || clientResponse.includes(keyword))) {
              matchedResponse = response;
              console.log(`[Webhook] ✅ Resposta "${clientResponse}" correspondeu a "${response.label}" (keywords: ${keywords.join(', ')})`);
              break;
            }
          }
          
          if (matchedResponse) {
            sourceHandle = `response_${matchedResponse.id}`;
            updatedVariables.matched_response_id = matchedResponse.id;
            updatedVariables.matched_response_label = matchedResponse.label;
          } else {
            sourceHandle = 'other';
            console.log(`[Webhook] ℹ️ Resposta "${clientResponse}" não correspondeu a nenhuma esperada, usando saída "other"`);
          }
        }
        
        // Atualizar execução para 'running'
        const { error: updateError } = await supabase
          .from('flow_executions')
          .update({
            status: 'running',
            waiting_for: null,
            waiting_until: null,
            variables: updatedVariables
          })
          .eq('id', waitingExecution.id);
        
        if (updateError) {
          console.error(`[Webhook] Error updating flow execution:`, updateError);
        } else {
          console.log(`[Webhook] ✅ Updated flow execution, looking for connection with handle "${sourceHandle}"`);
          
          // Buscar próximo nó pela saída correta
          const { data: nextConnection, error: connError } = await supabase
            .from('flow_connections')
            .select('target_node_id')
            .eq('source_node_id', waitingExecution.current_node_id)
            .eq('source_handle', sourceHandle)
            .limit(1)
            .maybeSingle();
          
          if (connError) {
            console.error(`[Webhook] Error fetching next connection:`, connError);
          } else if (nextConnection) {
            console.log(`[Webhook] 🚀 Invoking execute-flow-node for next node ${nextConnection.target_node_id}`);
            
            await supabase.functions.invoke('execute-flow-node', {
              body: {
                execution_id: waitingExecution.id,
                node_id: nextConnection.target_node_id
              }
            });
            
            console.log(`[Webhook] ✅ Flow execution resumed, continuing to node ${nextConnection.target_node_id}`);
          } else {
            // Tentar buscar conexão com handles alternativos (fallback)
            console.log(`[Webhook] ⚠️ No connection found for handle "${sourceHandle}", trying fallback handles...`);
            
            const { data: fallbackConnection } = await supabase
              .from('flow_connections')
              .select('target_node_id, source_handle')
              .eq('source_node_id', waitingExecution.current_node_id)
              .in('source_handle', ['replied', 'default', 'success'])
              .limit(1)
              .maybeSingle();
            
            if (fallbackConnection) {
              console.log(`[Webhook] 🔄 Using fallback connection with handle "${fallbackConnection.source_handle}"`);
              
              await supabase.functions.invoke('execute-flow-node', {
                body: {
                  execution_id: waitingExecution.id,
                  node_id: fallbackConnection.target_node_id
                }
              });
            } else {
              console.log(`[Webhook] ⚠️ No next node found for waiting execution, flow may have ended`);
            }
          }
        }
      } else {
        console.log(`[Webhook] ℹ️ No waiting flow execution found for contact ${contact.id}`);
      }
    } catch (resumeError) {
      console.error(`[Webhook] Error resuming waiting flow:`, resumeError);
    }

    // =====================================================
    // TRIGGER KEYWORD AUTOMATIONS (mensagens RECEBIDAS)
    // Só dispara se não retomou um fluxo em espera
    // =====================================================
    if (!flowResumed) {
      try {
        console.log(`[Webhook] 🤖 Checking keyword automations for received message from ${normalizedMessage.from}...`);
        
        await supabase.functions.invoke('process-flow-triggers', {
          body: {
            trigger_type: 'keyword',
            tenant_id: channel.tenant_id,
            contact_id: contact.id,
            channel_id: channel.id,
            conversation_id: conversation.id,
            message_content: normalizedMessage.content,
          }
        });
        
        // Marcar mensagem como trigger processado para evitar re-processamento em webhooks duplicados
        const { data: msgToMark } = await supabase
          .from("messages")
          .select("id")
          .eq("whatsapp_message_id", normalizedMessage.originalId)
          .single();
        
        if (msgToMark) {
          await supabase.from("messages").update({ trigger_processed: true }).eq("id", msgToMark.id);
          console.log(`[Webhook] ✅ Marked message as trigger_processed`);
        }
        
        console.log(`[Webhook] ✅ Keyword trigger check completed for received message`);
      } catch (triggerError) {
        console.error(`[Webhook] Error invoking keyword triggers:`, triggerError);
      }
    } else {
      console.log(`[Webhook] ℹ️ Skipping keyword triggers because flow was resumed`);
    }

    console.log(`[Webhook] Message saved successfully for conversation ${conversation.id}`);

    // =====================================================
    // DISPATCH CUSTOM WEBHOOK (message.received)
    // Envia para webhooks configurados pelo cliente
    // =====================================================
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      // Fetch enriched contact data
      const { data: contactData } = await supabase
        .from('contacts')
        .select('id, full_name, phone, email, lead_status, lead_score')
        .eq('id', contact.id)
        .single();

      // Fetch conversation data with department
      const { data: conversationData } = await supabase
        .from('conversations')
        .select('department_id, assigned_to, status, priority, unread_count, created_at')
        .eq('id', conversation.id)
        .single();

      let departmentData = null;
      if (conversationData?.department_id) {
        const { data: dept } = await supabase
          .from('departments')
          .select('id, name')
          .eq('id', conversationData.department_id)
          .single();
        departmentData = dept;
      }

      let agentData = null;
      if (conversationData?.assigned_to) {
        const { data: agent } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', conversationData.assigned_to)
          .single();
        agentData = agent;
      }

      let channelData = null;
      if (channel.id) {
        const { data: ch } = await supabase
          .from('whatsapp_channels')
          .select('id, name, phone')
          .eq('id', channel.id)
          .single();
        channelData = ch;
      }

      await fetch(`${supabaseUrl}/functions/v1/dispatch-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          action: 'dispatch',
          event: {
            type: 'message.received',
            data: {
              message: {
                id: normalizedMessage.id,
                whatsapp_message_id: normalizedMessage.originalId,
                type: normalizedMessage.type,
                content: normalizedMessage.content,
                media_url: finalMediaUrl || null,
                timestamp: normalizedMessage.timestamp.toISOString(),
              },
              contact: {
                id: contact.id,
                name: contactData?.full_name || contact.full_name,
                phone: contactData?.phone || contact.phone,
                email: contactData?.email || null,
                lead_status: contactData?.lead_status || null,
                lead_score: contactData?.lead_score || null,
              },
              conversation: {
                id: conversation.id,
                status: conversationData?.status || 'open',
                priority: conversationData?.priority || null,
                unread_count: conversationData?.unread_count || 0,
                created_at: conversationData?.created_at || null,
              },
              department: {
                id: conversationData?.department_id || null,
                name: departmentData?.name || null,
              },
              channel: {
                id: channel.id,
                name: channelData?.name || null,
                phone_number: channelData?.phone || null,
              },
              agent: agentData ? {
                id: agentData.id,
                name: agentData.full_name,
                email: agentData.email,
              } : null,
            },
            context: {
              department: { id: conversationData?.department_id },
              channel: { id: channel.id },
              assigned_to: conversationData?.assigned_to,
              tenant_id: channel.tenant_id,
            },
          },
        }),
      });
      console.log('[Webhook] Webhook dispatched for message.received');
    } catch (webhookError) {
      // Non-critical - log but don't fail the webhook
      console.error('[Webhook] Error dispatching custom webhook:', webhookError);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[Webhook] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

function getEventType(provider: WhatsAppProvider, payload: any): string {
  switch (provider) {
    case "zapi":
      return payload.type || payload.event || "message";
    case "uazapi":
      // IMPORTANTE: payload.event pode ser um OBJETO (ex: presence events)
      // Priorizar payload.type ou payload.EventType que são sempre strings
      return payload.type || payload.EventType || 
             (typeof payload.event === 'string' ? payload.event : null) || 
             "message";
    case "evolution":
      // IMPORTANTE: payload.event pode ser objeto em alguns casos
      const evolutionEventStr = typeof payload.event === 'string' ? payload.event : "message";
      return evolutionEventStr.toLowerCase().replace(/_/g, '.');
    default:
      return "unknown";
  }
}

function isConnectionEvent(provider: WhatsAppProvider, payload: any): boolean {
  switch (provider) {
    case "zapi":
      return payload.type === "connection_update" || 
             payload.event === "connection" ||
             payload.connected !== undefined;
    case "uazapi":
      // UAZAPI V2: Detectar eventos de conexão por múltiplos campos e formatos
      const uazapiEventStr = typeof payload.event === 'string' ? payload.event : "";
      const uazapiEventLower = uazapiEventStr.toLowerCase();
      const uazapiEventType = (payload.EventType || payload.eventType || "").toLowerCase();
      const uazapiType = (payload.type || "").toLowerCase();
      
      const isUazapiConnection = 
        // Eventos explícitos de conexão
        uazapiEventLower === "connection.update" ||
        uazapiEventLower === "connection_update" ||
        uazapiEventLower === "status" ||
        uazapiEventLower === "status.update" ||
        uazapiEventLower === "instance.status" ||
        // EventType field (UAZAPI V2 pode usar EventType com E maiúsculo)
        uazapiEventType === "connection" ||
        uazapiEventType === "connection.update" ||
        uazapiEventType === "status" ||
        uazapiEventType === "instance.status" ||
        // Type field
        uazapiType === "connection" ||
        uazapiType === "status" ||
        // Verificar campos que indicam mudança de estado
        payload.connected !== undefined ||
        payload.status === "disconnected" ||
        payload.status === "connected" ||
        // Verificar payload.data para estado
        (payload.data?.state && ['open', 'close', 'connecting', 'disconnected', 'closed'].includes(payload.data.state));
      
      if (isUazapiConnection) {
        console.log(`[Webhook] ✅ UAZAPI connection event detected! EventType: ${uazapiEventType}, event: ${uazapiEventLower}, state: ${payload.data?.state || payload.state}`);
      }
      
      return isUazapiConnection;
    case "evolution":
      const evolutionConnEventStr = typeof payload.event === 'string' ? payload.event : "";
      const evolutionConnEvent = evolutionConnEventStr.toLowerCase().replace(/_/g, '.');
      
      const isEvolutionConnection = 
        evolutionConnEvent === "connection.update" ||
        evolutionConnEvent === "connection_update" ||
        evolutionConnEvent === "status.instance" ||
        payload.state === "open" ||
        payload.state === "close" ||
        payload.state === "connecting";
      
      if (isEvolutionConnection) {
        console.log(`[Webhook] ✅ Evolution connection event detected! Event: ${evolutionConnEvent}, state: ${payload.state}`);
      }
      
      return isEvolutionConnection;
    default:
      return false;
  }
}

async function handleConnectionEvent(
  supabase: any, 
  provider: WhatsAppProvider, 
  instanceId: string, 
  payload: any
): Promise<void> {
  if (!instanceId) {
    console.log("[Webhook] No instance ID for connection event");
    return;
  }

  let newStatus: "connected" | "disconnected" = "disconnected";
  let ownerPhone: string | null = null;

  // Normalizar estados para connected/disconnected
  const openStates = ["open", "connected", "online", "ready"];
  const closeStates = ["close", "closed", "disconnected", "offline", "logout", "conflict"];

  switch (provider) {
    case "zapi":
      newStatus = payload.connected === true ? "connected" : "disconnected";
      ownerPhone = payload.phone || payload.owner;
      break;
    case "uazapi":
      // UAZAPI pode enviar estado em vários formatos
      const uazapiState = 
        payload.data?.state || 
        payload.state || 
        payload.status ||
        payload.connectionState ||
        (payload.connected === true ? "open" : payload.connected === false ? "close" : null);
      
      console.log(`[Webhook] UAZAPI connection - Raw state values: data.state=${payload.data?.state}, state=${payload.state}, status=${payload.status}, connected=${payload.connected}`);
      
      if (uazapiState && openStates.includes(uazapiState.toLowerCase())) {
        newStatus = "connected";
      } else if (uazapiState && closeStates.includes(uazapiState.toLowerCase())) {
        newStatus = "disconnected";
      } else {
        console.log(`[Webhook] ⚠️ Unknown UAZAPI state: ${uazapiState}, assuming disconnected`);
        newStatus = "disconnected";
      }
      
      ownerPhone = payload.data?.wuid?.replace("@s.whatsapp.net", "") || 
                   payload.owner?.replace("@s.whatsapp.net", "") ||
                   payload.phone;
      break;
    case "evolution":
      const evolutionState = payload.data?.state || payload.state;
      
      if (evolutionState && openStates.includes(evolutionState.toLowerCase())) {
        newStatus = "connected";
      } else if (evolutionState && closeStates.includes(evolutionState.toLowerCase())) {
        newStatus = "disconnected";
      } else {
        newStatus = "disconnected";
      }
      
      ownerPhone = payload.sender?.replace("@s.whatsapp.net", "") || 
                   payload.data?.wuid?.replace("@s.whatsapp.net", "") ||
                   payload.data?.owner?.replace("@s.whatsapp.net", "");
      break;
  }

  console.log(`[Webhook] Connection update - Instance: ${instanceId}, Status: ${newStatus}, Phone: ${ownerPhone}`);

  const { data: channel, error: channelError } = await supabase
    .from("whatsapp_channels")
    .select("id, name, phone, status, tenant_id")
    .eq("instance_id", instanceId)
    .eq("is_deleted", false)
    .single();

  if (channelError || !channel) {
    console.log(`[Webhook] Channel not found for connection update: ${instanceId}`);
    return;
  }

  // Verificar se houve mudança de status
  const statusChanged = channel.status !== newStatus;
  
  const updateData: any = {
    status: newStatus,
    last_sync_at: new Date().toISOString(),
  };

  if (ownerPhone && (!channel.phone || channel.phone === "Aguardando conexão" || channel.phone === "Não identificado")) {
    updateData.phone = ownerPhone;
  }

  const { error: updateError } = await supabase
    .from("whatsapp_channels")
    .update(updateData)
    .eq("id", channel.id);

  if (updateError) {
    console.error(`[Webhook] Error updating channel status:`, updateError);
  } else {
    console.log(`[Webhook] Channel ${channel.name} status updated to ${newStatus}`);
    
    // Registrar evento de mudança de status (especialmente desconexões)
    if (statusChanged && channel.tenant_id) {
      try {
        await supabase.from("whatsapp_channel_events").insert({
          channel_id: channel.id,
          tenant_id: channel.tenant_id,
          event_type: newStatus === "connected" ? "connected" : "disconnected",
          previous_status: channel.status,
          new_status: newStatus,
          details: {
            ownerPhone,
            instanceId,
            provider,
            timestamp: new Date().toISOString(),
          }
        });
        
        console.log(`[Webhook] 📢 Channel event logged: ${channel.name} ${channel.status} -> ${newStatus}`);
      } catch (eventError) {
        console.error(`[Webhook] Error logging channel event:`, eventError);
      }
    }
  }
}

// =====================================================
// CALL EVENTS - Notificar agentes sobre chamadas recebidas
// =====================================================

function isCallEvent(provider: WhatsAppProvider, payload: any): boolean {
  // IMPORTANTE: payload.event pode ser um OBJETO (ex: presence events do UAZAPI)
  // Só usar se for string
  const eventType = typeof payload.event === 'string' 
    ? payload.event.toLowerCase() 
    : "";
  
  switch (provider) {
    case "evolution":
      return eventType === "call" || eventType === "calls";
    case "zapi":
      return payload.type === "ReceivedCallback" || 
             payload.call !== undefined ||
             eventType === "call";
    case "uazapi":
      return eventType === "call" || payload.type === "call";
    default:
      return false;
  }
}

async function handleCallEvent(
  supabase: any,
  provider: WhatsAppProvider,
  instanceId: string,
  payload: any
): Promise<void> {
  console.log(`[Webhook] 📞 Processing call event from ${provider}:`, JSON.stringify(payload).substring(0, 500));
  
  // Extrair dados da chamada baseado no provider
  const callData = payload.data || payload;
  const status = callData.status || callData.callStatus || 'offer';
  
  // Só notificar para chamadas entrando (offer/ringing)
  // Ignorar: hangUp, missed, declined, timeout, pickUp
  const isIncomingCall = ['offer', 'ringing', 'incoming'].includes(status?.toLowerCase());
  if (!isIncomingCall) {
    console.log(`[Webhook] 📞 Call status "${status}" is not incoming, skipping notification`);
    return;
  }
  
  // Extrair telefone de quem está ligando
  const fromJid = callData.from || callData.remoteJid || callData.chatId || '';
  const fromPhone = cleanWhatsAppJid(fromJid).replace(/\D/g, '');
  
  if (!fromPhone || !isValidBrazilianPhone(fromPhone)) {
    console.log(`[Webhook] 📞 Invalid phone for call: ${fromPhone}`);
    return;
  }
  
  // Buscar canal
  const { data: channel, error: channelError } = await supabase
    .from("whatsapp_channels")
    .select("id, name, department_id")
    .eq("instance_id", instanceId)
    .eq("is_deleted", false)
    .single();
  
  if (channelError || !channel) {
    console.log(`[Webhook] 📞 Channel not found for call event: ${instanceId}`);
    return;
  }
  
  // Gerar variações do telefone para busca
  const phoneVariations = [fromPhone];
  if (fromPhone.length === 13 && fromPhone.startsWith('55')) {
    phoneVariations.push(fromPhone.slice(0, 4) + fromPhone.slice(5));
  } else if (fromPhone.length === 12 && fromPhone.startsWith('55')) {
    const ddd = fromPhone.slice(2, 4);
    phoneVariations.push('55' + ddd + '9' + fromPhone.slice(4));
  }
  
  // Buscar contato
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, full_name, phone")
    .in("phone", phoneVariations)
    .limit(1)
    .single();
  
  // Buscar conversa ativa (se existir)
  let conversation = null;
  if (contact) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("id, assigned_to, department_id")
      .eq("contact_id", contact.id)
      .eq("channel_id", channel.id)
      .in("status", ["open", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    conversation = conv;
  }
  
  // Preparar payload para broadcast
  const broadcastPayload = {
    callId: callData.id || `call_${Date.now()}`,
    phone: fromPhone,
    contactName: contact?.full_name || `+${fromPhone}`,
    contactId: contact?.id || null,
    conversationId: conversation?.id || null,
    assignedTo: conversation?.assigned_to || null,
    channelId: channel.id,
    channelName: channel.name,
    departmentId: conversation?.department_id || channel.department_id || null,
    isVideo: callData.isVideo === true || callData.video === true,
    timestamp: new Date().toISOString()
  };
  
  console.log(`[Webhook] 📞 Broadcasting incoming call notification:`, JSON.stringify(broadcastPayload));
  
  // Enviar broadcast via Supabase Realtime
  const broadcastChannel = supabase.channel('incoming-calls');
  
  await broadcastChannel.send({
    type: 'broadcast',
    event: 'incoming_call',
    payload: broadcastPayload
  });
  
  // Cleanup: unsubscribe from the channel
  await supabase.removeChannel(broadcastChannel);
  
  console.log(`[Webhook] 📞 Incoming call notification sent for: ${fromPhone}`);
}

// =====================================================
// PRESENCE EVENTS - Detectar online/offline dos contatos
// =====================================================

function isPresenceEvent(provider: WhatsAppProvider, payload: any): boolean {
  switch (provider) {
    case "zapi":
      return payload.type === "presence" || payload.event === "presence.update";
    case "uazapi":
      return payload.event === "presence.update";
    case "evolution":
      const evolutionPresenceStr = typeof payload.event === 'string' ? payload.event : "";
      const evolutionPresenceEvent = evolutionPresenceStr.toLowerCase().replace(/_/g, '.');
      return evolutionPresenceEvent === "presence.update";
    default:
      return false;
  }
}

async function handlePresenceEvent(
  supabase: any,
  provider: WhatsAppProvider,
  payload: any
): Promise<void> {
  console.log(`[Webhook] Processing presence event:`, JSON.stringify(payload).substring(0, 500));
  
  // Extrair dados de presença baseado no provider
  let remoteJid: string | null = null;
  let presence: string | null = null;
  
  switch (provider) {
    case "evolution":
      remoteJid = payload.data?.remoteJid || payload.data?.id;
      presence = payload.data?.presence;
      break;
    case "zapi":
      remoteJid = payload.phone || payload.sender;
      presence = payload.status || payload.presence;
      break;
    case "uazapi":
      remoteJid = payload.data?.id || payload.data?.remoteJid;
      presence = payload.data?.presence;
      break;
  }
  
  if (!remoteJid || !presence) {
    console.log(`[Webhook] No remoteJid or presence in event`);
    return;
  }
  
  // Extrair número do telefone do remoteJid
  const phone = remoteJid
    .replace("@s.whatsapp.net", "")
    .replace("@lid", "")
    .replace("@c.us", "");
  
  // Determinar se está online e se está digitando
  // Valores possíveis: "available", "unavailable", "composing", "recording", "paused"
  const isOnline = presence === "available" || presence === "composing" || presence === "recording";
  const isTyping = presence === "composing" || presence === "recording";
  
  console.log(`[Webhook] Presence update - Phone: ${phone}, Presence: ${presence}, IsOnline: ${isOnline}, IsTyping: ${isTyping}`);
  
  // Atualizar contato
  const { data: contact, error: findError } = await supabase
    .from("contacts")
    .select("id, full_name")
    .eq("phone", phone)
    .single();
  
  if (findError || !contact) {
    console.log(`[Webhook] Contact not found for presence update: ${phone}`);
    return;
  }
  
  const { error: updateError } = await supabase
    .from("contacts")
    .update({
      is_online: isOnline,
      is_typing: isTyping,
      last_seen_at: isOnline ? null : new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", contact.id);
  
  if (updateError) {
    console.error(`[Webhook] Error updating contact presence:`, updateError);
  } else {
    console.log(`[Webhook] Contact ${contact.full_name} presence: online=${isOnline}, typing=${isTyping}`);
  }
}

function isMessageStatusEvent(provider: WhatsAppProvider, payload: any): boolean {
  switch (provider) {
    case "zapi":
      return payload.type === "MessageStatusCallback" || payload.event === "message_status" || 
             payload.status !== undefined && payload.messageId;
    case "uazapi":
      // Formato antigo: payload.event (minúsculo)
      // Formato UAZAPI V2: payload.EventType (com E maiúsculo)
      // IMPORTANTE: payload.event pode ser objeto em alguns casos (presence events)
      const uazapiEventStr = typeof payload.event === 'string' ? payload.event : "";
      const uazapiEvent = uazapiEventStr.toLowerCase();
      const uazapiEventType = (payload.EventType || payload.body?.EventType || "").toLowerCase();
      
      // Verificar também se há ack no payload (evento de status inline)
      const hasAckInMessage = payload.body?.message?.ack !== undefined || 
                              payload.message?.ack !== undefined;
      
      const isStatusEvent = uazapiEvent === "messages.update" || 
             uazapiEvent === "message.ack" ||
             uazapiEventType === "message_ack" ||
             uazapiEventType === "ack" ||
             uazapiEventType === "messages_ack" ||
             uazapiEventType === "message-ack" ||
             uazapiEventType === "messages_update" ||
             hasAckInMessage;
      
      if (isStatusEvent) {
        console.log(`[Webhook UAZAPI] 📊 Status event detected - event: ${uazapiEvent}, EventType: ${uazapiEventType}, hasAck: ${hasAckInMessage}`);
      }
      
      return isStatusEvent;
    case "evolution":
      const evolutionStatusStr = typeof payload.event === 'string' ? payload.event : "";
      const evolutionStatusEvent = evolutionStatusStr.toLowerCase().replace(/_/g, '.');
      return evolutionStatusEvent === "messages.update";
    default:
      return false;
  }
}

async function handleMessageStatusEvent(
  supabase: any,
  provider: WhatsAppProvider,
  payload: any
): Promise<void> {
  console.log(`[Webhook] handleMessageStatusEvent - Provider: ${provider}, Payload:`, JSON.stringify(payload).substring(0, 500));
  
  const statusUpdates = extractStatusUpdates(provider, payload);
  console.log(`[Webhook] Extracted ${statusUpdates.length} status updates:`, statusUpdates);
  
  for (const update of statusUpdates) {
    if (!update.messageId) {
      console.log(`[Webhook] Skipping update - no messageId`);
      continue;
    }
    
    console.log(`[Webhook] Processing status update: messageId=${update.messageId}, rawStatus=${update.status}`);
    
    const newStatus = mapProviderStatus(update.status);
    console.log(`[Webhook] Mapped status: ${update.status} -> ${newStatus}`);
    
    if (!newStatus) {
      console.log(`[Webhook] Could not map status, skipping`);
      continue;
    }
    
    const { data, error } = await supabase
      .from("messages")
      .update({ status: newStatus })
      .eq("whatsapp_message_id", update.messageId)
      .select("id");
    
    if (error) {
      console.error(`[Webhook] Error updating message status:`, error);
    } else if (data?.length > 0) {
      console.log(`[Webhook] Message ${update.messageId} status updated to ${newStatus} (${data.length} rows)`);
    } else {
      console.log(`[Webhook] No message found with whatsapp_message_id: ${update.messageId}`);
    }
  }
}

interface StatusUpdate {
  messageId: string;
  status: string;
}

function extractStatusUpdates(provider: WhatsAppProvider, payload: any): StatusUpdate[] {
  switch (provider) {
    case "zapi":
      return [{
        messageId: payload.messageId || payload.ids?.[0] || "",
        status: payload.status || payload.ack || ""
      }];
    
    case "uazapi":
      // =====================================================
      // UAZAPI / CloudZAPI: Múltiplos formatos de ACK
      // ack: 0=PENDING, 1=SENT, 2=DELIVERED, 3=READ, 4=PLAYED
      // =====================================================
      const uazapiBody = payload.body || payload;
      const uazapiMessage = uazapiBody.message || payload.message;
      const uazapiEvent = payload.event || payload.body?.event || "";
      
      console.log(`[Webhook UAZAPI] extractStatusUpdates - event: ${uazapiEvent}`);
      
      // =====================================================
      // FORMATO CloudZAPI: evento "messagesUpdate" com booleanos
      // =====================================================
      if (uazapiEvent === "messagesUpdate" || uazapiEvent === "messages.update" || uazapiEvent === "message.update") {
        const updateData = payload.data || payload.body?.data;
        console.log(`[Webhook UAZAPI] 📊 messagesUpdate event detected:`, JSON.stringify(updateData));
        
        if (updateData) {
          // Pode vir como array ou objeto único
          const updates = Array.isArray(updateData) ? updateData : [updateData];
          return updates.map((item: any) => {
            const messageId = item.header?.messageId || item.messageId || item.key?.id || item.id || "";
            // Status pode ser textual (READ, DELIVERY_ACK) ou numérico
            const rawStatus = item.status || item.update?.status || item.ack;
            const status = mapCloudZAPIStatusToNumeric(rawStatus);
            console.log(`[Webhook UAZAPI] 📊 messagesUpdate - messageId: ${messageId}, rawStatus: ${rawStatus}, mappedStatus: ${status}`);
            return { messageId, status };
          }).filter((u: any) => u.messageId && u.status);
        }
      }
      
      // =====================================================
      // FORMATO UAZAPI V2: EventType "messages_update" com event como OBJETO
      // payload.event = { MessageIDs: [...], Type: "Delivered"|"Read"|"Played" }
      // payload.EventType = "messages_update"
      // =====================================================
      const uazapiEventType2 = (payload.EventType || payload.body?.EventType || "").toLowerCase();
      const eventObj = payload.event || payload.body?.event;
      if (uazapiEventType2 === "messages_update" && eventObj && typeof eventObj === 'object' && !Array.isArray(eventObj)) {
        const messageIds: string[] = eventObj.MessageIDs || eventObj.messageIds || eventObj.messageIDs || [];
        const rawType = eventObj.Type || eventObj.type || payload.state || "";
        const mappedStatus = mapCloudZAPIStatusToNumeric(rawType);
        console.log(`[Webhook UAZAPI] 📊 V2 messages_update - MessageIDs: ${JSON.stringify(messageIds)}, Type: ${rawType}, mappedStatus: ${mappedStatus}`);
        
        if (messageIds.length > 0 && mappedStatus) {
          return messageIds.map((id: string) => ({
            messageId: id,
            status: mappedStatus
          }));
        }
        
        // Fallback: single message ID in event object
        const singleId = eventObj.MessageID || eventObj.messageId || eventObj.id || "";
        if (singleId && mappedStatus) {
          return [{ messageId: singleId, status: mappedStatus }];
        }
      }
      
      // =====================================================
      // FORMATO UAZAPI V2: ack diretamente na mensagem
      // =====================================================
      if (uazapiMessage && uazapiMessage.ack !== undefined) {
        const messageId = uazapiMessage.messageid || uazapiMessage.key?.id || uazapiMessage.id || "";
        const ackValue = String(uazapiMessage.ack);
        console.log(`[Webhook UAZAPI] 📊 Extracted ACK from message - messageId: ${messageId}, ack: ${ackValue}`);
        return [{
          messageId: messageId,
          status: ackValue
        }];
      }
      
      // =====================================================
      // Formato antigo (fallback)
      // =====================================================
      const uazapiData = payload.data || payload;
      if (Array.isArray(uazapiData)) {
        return uazapiData.map((item: any) => ({
          messageId: item.key?.id || item.id || "",
          status: item.status || item.update?.status || String(item.ack || "")
        }));
      }
      return [{
        messageId: uazapiData.key?.id || uazapiData.id || uazapiData.messageid || "",
        status: uazapiData.status || uazapiData.update?.status || String(uazapiData.ack || "")
      }];
    
    case "evolution":
      const evolutionData = payload.data;
      console.log(`[Webhook] Evolution status data:`, JSON.stringify(evolutionData));
      
      if (evolutionData?.keyId) {
        return [{
          messageId: evolutionData.keyId,
          status: evolutionData.status || ""
        }];
      }
      
      if (Array.isArray(evolutionData)) {
        return evolutionData.map((item: any) => ({
          messageId: item.keyId || item.key?.id || item.id || "",
          status: item.status || ""
        }));
      }
      if (evolutionData?.key?.id) {
        return [{
          messageId: evolutionData.key.id,
          status: evolutionData.status || ""
        }];
      }
      return [];
    
    default:
      return [];
  }
}

// =====================================================
// Mapear status textual CloudZAPI para numérico
// =====================================================
function mapCloudZAPIStatusToNumeric(status: any): string {
  if (status === undefined || status === null) return "";
  
  const strStatus = String(status).toUpperCase();
  
  switch (strStatus) {
    case 'PENDING': return '0';
    case 'SERVER_ACK':
    case 'SENT': return '1';
    case 'DELIVERY_ACK':
    case 'DELIVERED': return '2';
    case 'READ': return '3';
    case 'PLAYED': return '4';
    case 'ERROR':
    case 'FAILED': return '-1';
    default:
      // Se já for numérico, retorna como está
      if (!isNaN(parseInt(strStatus))) {
        return strStatus;
      }
      return strStatus;
  }
}

function mapProviderStatus(providerStatus: string): string | null {
  const status = String(providerStatus).toUpperCase();
  
  // =====================================================
  // MAPEAMENTO DE STATUS DO WHATSAPP
  // =====================================================
  // String statuses
  if (status === "DELIVERY_ACK" || status === "DELIVERED") {
    return "delivered";
  }
  if (status === "SERVER_ACK") {
    // SERVER_ACK = mensagem chegou no servidor WhatsApp, mas não foi entregue ao dispositivo
    return "sent";
  }
  if (status === "READ" || status === "PLAYED" || status === "VIEWED") {
    return "read";
  }
  if (status === "SENT" || status === "PENDING") {
    return "sent";
  }
  if (status === "ERROR" || status === "FAILED") {
    return "failed";
  }
  
  // =====================================================
  // MAPEAMENTO NUMÉRICO (padrão WhatsApp/Baileys)
  // =====================================================
  // -1 = ERROR (falha no envio)
  // 0 = PENDING (pendente)
  // 1 = SERVER_ACK (enviado ao servidor WhatsApp)
  // 2 = DELIVERY_ACK (entregue ao dispositivo do destinatário) ✓✓
  // 3 = READ (lido pelo destinatário) ✓✓ azul
  // 4 = PLAYED (áudio/vídeo reproduzido)
  // 5 = PLAYED (legacy)
  const numStatus = parseInt(providerStatus);
  if (!isNaN(numStatus)) {
    switch (numStatus) {
      case -1: return "failed";    // ERROR
      case 0: return "pending";    // PENDING
      case 1: return "sent";       // SERVER_ACK - ✓ (um tracinho)
      case 2: return "delivered";  // DELIVERY_ACK - ✓✓ (dois tracinhos)
      case 3: return "read";       // READ - ✓✓ azul
      case 4: return "read";       // PLAYED (áudios)
      case 5: return "read";       // PLAYED (legacy)
    }
  }
  
  console.log(`[Webhook] ⚠️ Unknown status value: ${providerStatus}`);
  return null;
}

// =====================================================
// REACTION EVENTS - Handle message reactions
// =====================================================

function isReactionEvent(provider: WhatsAppProvider, payload: any): boolean {
  switch (provider) {
    case "zapi":
      return payload.type === "reaction" || payload.event === "reaction";
    case "uazapi":
      return payload.event === "messages.reaction";
    case "evolution":
      const evolutionReactionStr = typeof payload.event === 'string' ? payload.event : "";
      const evolutionEvent = evolutionReactionStr.toLowerCase().replace(/_/g, '.');
      
      // Case 1: Explicit messages.reaction event
      if (evolutionEvent === "messages.reaction") return true;
      
      // Case 2: Reaction embedded in messages.upsert or send.message as reactionMessage
      if (evolutionEvent === "messages.upsert" || evolutionEvent === "send.message") {
        let msg = payload.data;
        if (Array.isArray(msg)) msg = msg[0];
        
        if (msg?.message?.reactionMessage || msg?.messageType === "reactionMessage") {
          console.log(`[Webhook] 🎯 Reaction detected in ${evolutionEvent} as reactionMessage`);
          return true;
        }
      }
      return false;
    default:
      return false;
  }
}

async function handleReactionEvent(
  supabase: any,
  provider: WhatsAppProvider,
  payload: any,
  instanceId: string
): Promise<void> {
  console.log(`[Webhook] handleReactionEvent - Provider: ${provider}, Payload:`, JSON.stringify(payload).substring(0, 1500));
  
  // Extract reaction data based on provider
  let reactionData: {
    messageId: string;
    emoji: string;
    fromMe: boolean;
    fromPhone: string;
  } | null = null;
  
  switch (provider) {
    case "evolution":
      let evolutionMsg = payload.data;
      if (Array.isArray(evolutionMsg)) evolutionMsg = evolutionMsg[0];
      
      // Format 1: Explicit messages.reaction event
      // { event: "messages.reaction", data: { key: {...}, reaction: { key: { id: originalMsgId }, text: "👍" } } }
      if (evolutionMsg?.reaction) {
        const reactionKey = evolutionMsg.reaction.key || {};
        const senderKey = evolutionMsg.key || {};
        reactionData = {
          messageId: reactionKey.id || "",
          emoji: evolutionMsg.reaction.text || "",
          fromMe: senderKey.fromMe || false,
          fromPhone: (senderKey.remoteJid || "").replace("@s.whatsapp.net", "").replace("@c.us", "").replace(/\D/g, "")
        };
        console.log(`[Webhook] Extracted from messages.reaction format`);
      }
      // Format 2: reactionMessage embedded in messages.upsert or send.message
      // { event: "send.message", data: { key: {...}, message: { reactionMessage: { key: { id }, text: "👍" } } } }
      else if (evolutionMsg?.message?.reactionMessage) {
        const reactionMsg = evolutionMsg.message.reactionMessage;
        const senderKey = evolutionMsg.key || {};
        reactionData = {
          messageId: reactionMsg.key?.id || "",
          emoji: reactionMsg.text || "",
          fromMe: senderKey.fromMe || false,
          fromPhone: (senderKey.remoteJid || "").replace("@s.whatsapp.net", "").replace("@c.us", "").replace(/\D/g, "")
        };
        console.log(`[Webhook] Extracted from reactionMessage format`);
      }
      break;
    
    case "uazapi":
      // UAZAPI format similar to Evolution
      const uazapiData = payload.data;
      if (uazapiData?.reaction) {
        reactionData = {
          messageId: uazapiData.reaction.key?.id || "",
          emoji: uazapiData.reaction.text || "",
          fromMe: uazapiData.key?.fromMe || false,
          fromPhone: (uazapiData.key?.remoteJid || "").replace("@s.whatsapp.net", "")
        };
      }
      break;
    
    case "zapi":
      // Z-API format
      if (payload.reactionMessageId) {
        reactionData = {
          messageId: payload.reactionMessageId,
          emoji: payload.reaction || "",
          fromMe: payload.fromMe || false,
          fromPhone: (payload.phone || "").replace(/\D/g, "")
        };
      }
      break;
  }
  
  if (!reactionData || !reactionData.messageId) {
    console.log(`[Webhook] Could not extract reaction data`);
    return;
  }
  
  console.log(`[Webhook] Reaction: messageId=${reactionData.messageId}, emoji="${reactionData.emoji}", fromMe=${reactionData.fromMe}, fromPhone=${reactionData.fromPhone}`);
  
  // Find the message by whatsapp_message_id
  const { data: message, error: findError } = await supabase
    .from("messages")
    .select("id, reactions, conversation_id")
    .eq("whatsapp_message_id", reactionData.messageId)
    .maybeSingle();
  
  if (findError || !message) {
    console.log(`[Webhook] Message not found for reaction: ${reactionData.messageId}`);
    return;
  }
  
  // Get current reactions array
  const currentReactions = (message.reactions as { emoji: string; user_id: string; from_contact?: boolean }[]) || [];
  
  // Determine if this is a removal (empty emoji) or addition
  const isRemoval = !reactionData.emoji || reactionData.emoji.trim() === "";
  
  let newReactions: { emoji: string; user_id: string; from_contact?: boolean }[];
  
  if (isRemoval) {
    // Remove reaction from this sender
    // For contact reactions (fromMe=false), remove by from_contact=true
    // For agent reactions (fromMe=true), we don't typically receive removal events from webhook
    if (!reactionData.fromMe) {
      newReactions = currentReactions.filter(r => r.from_contact !== true);
    } else {
      newReactions = currentReactions;
    }
    console.log(`[Webhook] Removing reaction from contact`);
  } else {
    // Add or update reaction
    if (!reactionData.fromMe) {
      // Reaction from contact - remove any existing contact reaction and add new one
      newReactions = currentReactions.filter(r => r.from_contact !== true);
      newReactions.push({
        emoji: reactionData.emoji,
        user_id: "contact", // Special identifier for contact reactions
        from_contact: true
      });
      console.log(`[Webhook] Adding reaction from contact: ${reactionData.emoji}`);
    } else {
      // Reaction from agent (fromMe) - this would be confirmation of sent reaction
      // We don't need to update as the frontend already saved it
      console.log(`[Webhook] Skipping fromMe reaction confirmation`);
      return;
    }
  }
  
  // Update the message
  const { error: updateError } = await supabase
    .from("messages")
    .update({ reactions: newReactions })
    .eq("id", message.id);
  
  if (updateError) {
    console.error(`[Webhook] Error updating message reactions:`, updateError);
  } else {
    console.log(`[Webhook] Message ${message.id} reactions updated:`, newReactions);
  }
}

function extractInstanceId(provider: WhatsAppProvider, payload: any): string {
  switch (provider) {
    case "zapi":
      return payload.instanceId || "";
    case "uazapi":
      // UAZAPI V2: instanceName pode estar no ROOT ou em body
      // Prioridade: root > body > fallbacks
      return payload.instanceName || payload.body?.instanceName || payload.instance || payload.session || payload.instanceId || "";
    case "evolution":
      return payload.instance || "";
    default:
      return "";
  }
}

function isMessageEvent(provider: WhatsAppProvider, payload: any): boolean {
  // IMPORTANTE: payload.event pode ser objeto em eventos de presence do UAZAPI
  const eventStr = typeof payload.event === 'string' ? payload.event : "";
  const typeStr = typeof payload.type === 'string' ? payload.type : "";
  const event = eventStr || typeStr || "";
  const normalizedEvent = event.toLowerCase().replace(/_/g, '.');
  
  let isMsg = false;
  
  switch (provider) {
    case "zapi":
      isMsg = !!(payload.phone && payload.text) || !!(payload.phone && (payload.image || payload.audio || payload.video || payload.document));
      break;
    case "uazapi":
      // UAZAPI V2: EventType pode estar no ROOT ou em body
      // Prioridade: root > body
      const uazapiEventType = (payload.EventType || payload.body?.EventType || "").toLowerCase();
      const hasMessage = payload.message || payload.body?.message;
      
      if (uazapiEventType === "messages" && hasMessage) {
        isMsg = true;
      } else {
        // Fallback para formato antigo
        isMsg = normalizedEvent === "message" || normalizedEvent === "messages.upsert" || !!payload.message;
      }
      break;
    case "evolution":
      isMsg = normalizedEvent === "messages.upsert" || normalizedEvent === "send.message";
      break;
    default:
      isMsg = false;
  }
  
  // DEBUG: Log detalhado para diagnóstico
  if (!isMsg) {
    console.log(`[Webhook DEBUG] Event NOT processed as message - Provider: ${provider}, RawEvent: "${event}", NormalizedEvent: "${normalizedEvent}", UAZAPIEventType: "${payload.EventType || payload.body?.EventType || 'N/A'}", IsMessageEvent: false`);
  }
  
  return isMsg;
}

function normalizeMessage(provider: WhatsAppProvider, payload: any): NormalizedMessage | null {
  try {
    let normalized: NormalizedMessage | null = null;
    switch (provider) {
      case "zapi":
        normalized = normalizeZAPIMessage(payload);
        break;
      case "uazapi":
        normalized = normalizeUAZAPIMessage(payload);
        break;
      case "evolution":
        normalized = normalizeEvolutionMessage(payload);
        break;
      default:
        normalized = null;
    }
    
    if (normalized) {
      console.log(`[Webhook] Normalized message - Type: ${normalized.type}, Content: ${normalized.content.substring(0, 50)}, MediaURL: ${normalized.mediaUrl ? 'YES' : 'NO'}, MediaBase64: ${normalized.mediaBase64 ? 'YES' : 'NO'}`);
    }
    
    return normalized;
  } catch (error) {
    console.error(`[Webhook] Error normalizing ${provider} message:`, error);
    return null;
  }
}

function normalizeZAPIMessage(payload: any): NormalizedMessage | null {
  if (!payload.phone) return null;

  const phone = payload.phone?.replace(/\D/g, "") || "";
  if (phone.startsWith("120363") || payload.isGroup || payload.isGroupMsg) {
    console.log(`[Webhook ZAPI] Ignoring group message from: ${phone}`);
    return null;
  }

  const messageType = detectZAPIMessageType(payload);
  
  return {
    id: `zapi_${payload.messageId}`,
    provider: "zapi",
    instanceId: payload.instanceId || "",
    from: payload.phone.replace(/\D/g, ""),
    fromName: payload.senderName || payload.chatName || "",
    isFromMe: payload.fromMe || false,
    type: messageType,
    content: extractZAPIContent(payload, messageType),
    mediaUrl: payload.image?.imageUrl || payload.audio?.audioUrl || payload.video?.videoUrl || payload.document?.documentUrl,
    mediaMimeType: payload.image?.mimetype || payload.audio?.mimetype || payload.video?.mimetype || payload.document?.mimetype,
    caption: payload.image?.caption || payload.video?.caption,
    timestamp: new Date(payload.momment || Date.now()),
    quotedMessageId: payload.quotedMessage?.messageId,
    status: "delivered",
    originalId: payload.messageId,
  };
}

function detectZAPIMessageType(payload: any): MessageType {
  if (payload.text) return "text";
  if (payload.image) return "image";
  if (payload.audio) return "audio";
  if (payload.video) return "video";
  if (payload.document) return "document";
  if (payload.sticker) return "sticker";
  if (payload.location) return "location";
  if (payload.contact) return "contact";
  return "text";
}

function extractZAPIContent(payload: any, type: MessageType): string {
  switch (type) {
    case "text": return payload.text?.message || payload.text || "";
    case "image": return payload.image?.caption || "[Imagem]";
    case "audio": return "[Áudio]";
    case "video": return payload.video?.caption || "[Vídeo]";
    case "document": return payload.document?.fileName || "[Documento]";
    case "sticker": return "[Sticker]";
    case "location": return `[Localização]`;
    case "contact": return `[Contato]`;
    default: return "";
  }
}

// =====================================================
// UAZAPI NORMALIZATION - FORMATO NOVO (body.EventType = "messages")
// =====================================================

/**
 * Extrai dados de referral/Meta Ads do formato UAZAPI
 * O UAZAPI fornece dados muito mais completos que o Evolution:
 * - sourceApp: "instagram" | "facebook"
 * - conversionSource: "FB_Ads"
 * - ctwaPayload: Payload completo base64
 * - greetingMessageBody: Mensagem de saudação do anúncio
 */
function extractReferralDataUAZAPI(message: any): ReferralData | null {
  const content = message?.content;
  const contextInfo = content?.contextInfo;
  
  if (!contextInfo) return null;
  
  // Verificar se é de Meta Ads
  const isFromAds = 
    contextInfo.conversionSource === 'FB_Ads' ||
    contextInfo.externalAdReply?.showAdAttribution ||
    contextInfo.entryPointConversionSource === 'ctwa_ad' ||
    contextInfo.externalAdReply?.sourceType === 'ad';
  
  if (!isFromAds) return null;
  
  const externalAd = contextInfo.externalAdReply || {};
  
  const referralData: ReferralData = {
    ctwaClid: externalAd.ctwaClid,
    sourceId: externalAd.sourceID,
    sourceType: externalAd.sourceType || 'ad',
    sourceUrl: externalAd.sourceURL,
    headline: externalAd.title,
    body: externalAd.greetingMessageBody,
    thumbnailUrl: externalAd.thumbnailURL,
    imageUrl: externalAd.originalImageURL || externalAd.thumbnailURL,
    videoUrl: externalAd.mediaURL,
    showAdAttribution: externalAd.showAdAttribution,
    // Campos UAZAPI específicos:
    sourceApp: externalAd.sourceApp, // "instagram" ou "facebook"
    conversionSource: contextInfo.conversionSource, // "FB_Ads"
    ctwaPayload: contextInfo.ctwaPayload, // Payload completo base64
    greetingMessageBody: externalAd.greetingMessageBody,
  };
  
  // Limpar campos undefined
  Object.keys(referralData).forEach(key => {
    if (referralData[key as keyof ReferralData] === undefined) {
      delete referralData[key as keyof ReferralData];
    }
  });
  
  if (Object.keys(referralData).length === 0) {
    return null;
  }
  
  console.log(`[Webhook UAZAPI] 📣 REFERRAL DATA EXTRACTED (Meta Ads):`, JSON.stringify(referralData));
  
  return referralData;
}

/**
 * Detecta tipo de mensagem no formato UAZAPI
 * IMPORTANTE: Prioriza messageType sobre type porque UAZAPI pode enviar:
 * - type: "chat" + messageType: "AudioMessage"
 * - type: "chat" + messageType: "ImageMessage"
 * Se usarmos type primeiro, detectamos incorretamente como "text"
 */
function detectUAZAPIMessageTypeNew(msg: any): MessageType {
  // Logar os valores para debug
  console.log(`[Webhook UAZAPI] detectUAZAPIMessageTypeNew - type: "${msg.type}", messageType: "${msg.messageType}", messageid: ${msg.messageid}`);
  
  // PRIORIZAR messageType sobre type (corrige detecção de mídia)
  const messageType = (msg.messageType || "").toLowerCase();
  const type = (msg.type || "").toLowerCase();
  
  // Função helper para match flexível
  const matchesType = (value: string, ...patterns: string[]): boolean => {
    return patterns.some(p => value.includes(p));
  };
  
  // Primeiro checar messageType (mais específico)
  if (messageType) {
    if (matchesType(messageType, "audio", "ptt", "voice")) {
      console.log(`[Webhook UAZAPI] ✅ Detected AUDIO from messageType: ${messageType}`);
      return "audio";
    }
    if (matchesType(messageType, "image")) {
      console.log(`[Webhook UAZAPI] ✅ Detected IMAGE from messageType: ${messageType}`);
      return "image";
    }
    if (matchesType(messageType, "video")) {
      console.log(`[Webhook UAZAPI] ✅ Detected VIDEO from messageType: ${messageType}`);
      return "video";
    }
    if (matchesType(messageType, "document", "file")) {
      console.log(`[Webhook UAZAPI] ✅ Detected DOCUMENT from messageType: ${messageType}`);
      return "document";
    }
    if (matchesType(messageType, "sticker")) {
      console.log(`[Webhook UAZAPI] ✅ Detected STICKER from messageType: ${messageType}`);
      return "sticker";
    }
    if (matchesType(messageType, "location")) {
      console.log(`[Webhook UAZAPI] ✅ Detected LOCATION from messageType: ${messageType}`);
      return "location";
    }
    if (matchesType(messageType, "vcard", "contact")) {
      console.log(`[Webhook UAZAPI] 📇 Detected CONTACTS from messageType: ${messageType} - vcard: ${msg.vcard?.substring(0, 100) || 'none'}`);
      return "contacts";
    }
  }
  
  // Depois checar type (fallback)
  if (type) {
    if (matchesType(type, "audio", "ptt", "voice")) {
      console.log(`[Webhook UAZAPI] ✅ Detected AUDIO from type: ${type}`);
      return "audio";
    }
    if (matchesType(type, "image")) {
      console.log(`[Webhook UAZAPI] ✅ Detected IMAGE from type: ${type}`);
      return "image";
    }
    if (matchesType(type, "video")) {
      console.log(`[Webhook UAZAPI] ✅ Detected VIDEO from type: ${type}`);
      return "video";
    }
    if (matchesType(type, "document", "file")) {
      console.log(`[Webhook UAZAPI] ✅ Detected DOCUMENT from type: ${type}`);
      return "document";
    }
    if (matchesType(type, "sticker")) {
      console.log(`[Webhook UAZAPI] ✅ Detected STICKER from type: ${type}`);
      return "sticker";
    }
    if (matchesType(type, "location")) {
      console.log(`[Webhook UAZAPI] ✅ Detected LOCATION from type: ${type}`);
      return "location";
    }
    if (matchesType(type, "vcard", "contact")) {
      console.log(`[Webhook UAZAPI] 📇 Detected CONTACTS from type: ${type} - vcard: ${msg.vcard?.substring(0, 100) || 'none'}`);
      return "contacts";
    }
    // text/chat/extendedtextmessage = text
    if (matchesType(type, "text", "chat", "extended")) {
      return "text";
    }
  }
  
  // Fallback: verificar se tem texto
  if (msg.text || msg.content?.text) return "text";
  console.log(`[Webhook UAZAPI] ⚠️ Unknown message type - defaulting to text`);
  return "text";
}

/**
 * Extrai conteúdo de mensagem UAZAPI (novo formato)
 */
function extractUAZAPIContentNew(msg: any, type: MessageType): string {
  switch (type) {
    case "text": 
      return msg.text || msg.content?.text || msg.body || "";
    case "image": 
      return msg.content?.caption || msg.caption || "[Imagem]";
    case "audio": 
      return "[Áudio]";
    case "video": 
      return msg.content?.caption || msg.caption || "[Vídeo]";
    case "document": 
      return msg.fileName || msg.title || "[Documento]";
    case "sticker": 
      return "[Sticker]";
    case "location": 
      return "[Localização]";
    case "contact":
    case "contacts": {
      // Tentar extrair dados do vCard
      const vcard = msg.vcard || msg.content?.vcard || msg.contactMessage?.vcard || '';
      const contacts = msg.contacts || msg.content?.contacts || [];
      
      // Se tiver array de contacts (formato CloudAPI-like)
      if (contacts.length > 0) {
        const c = contacts[0];
        const name = c.name?.formatted_name || c.name?.first_name || c.displayName || 'Contato';
        const phone = c.phones?.[0]?.phone || c.phones?.[0]?.wa_id || '';
        console.log(`[Webhook UAZAPI] 📇 Extracted contact from array: ${name} (${phone})`);
        return `📇 ${name}${phone ? ` (${phone})` : ''}`;
      }
      
      // Se tiver vCard string, fazer parse
      if (vcard) {
        const nameMatch = vcard.match(/FN:(.+)/);
        const phoneMatch = vcard.match(/TEL[^:]*:([+\d\s\-()]+)/);
        const name = nameMatch?.[1]?.trim() || 'Contato';
        const phone = phoneMatch?.[1]?.trim() || '';
        console.log(`[Webhook UAZAPI] 📇 Extracted contact from vCard: ${name} (${phone})`);
        return `📇 ${name}${phone ? ` (${phone})` : ''}`;
      }
      
      // Se tiver displayName direto
      if (msg.displayName || msg.content?.displayName) {
        const displayName = msg.displayName || msg.content?.displayName;
        console.log(`[Webhook UAZAPI] 📇 Extracted contact from displayName: ${displayName}`);
        return `📇 ${displayName}`;
      }
      
      return "[Contato]";  // Fallback
    }
    default: 
      return "";
  }
}

/**
 * Extrai URL de mídia do UAZAPI
 */
function extractUAZAPIMediaUrl(msg: any): string | undefined {
  return msg.mediaUrl || msg.media?.url || msg.content?.mediaUrl || undefined;
}

/**
 * Normaliza mensagem do UAZAPI - NOVO FORMATO
 * 
 * Estrutura esperada:
 * {
 *   body: {
 *     EventType: "messages",
 *     instanceName: "Vendas 07",
 *     message: { ... },
 *     chat: { ... }
 *   }
 * }
 */
function normalizeUAZAPIMessage(payload: any): NormalizedMessage | null {
  // UAZAPI V2: EventType e message podem estar no ROOT ou em body
  // Prioridade: root > body
  const eventType = payload.EventType || payload.body?.EventType;
  const message = payload.message || payload.body?.message;
  const chat = payload.chat || payload.body?.chat;
  const instanceName = payload.instanceName || payload.body?.instanceName;
  
  if (eventType === "messages" && message) {
    // Normalizar payload para formato esperado pelo normalizeUAZAPIMessageNew
    const normalizedPayload = {
      body: {
        EventType: eventType,
        message: message,
        chat: chat,
        instanceName: instanceName,
      }
    };
    return normalizeUAZAPIMessageNew(normalizedPayload);
  }
  
  // Fallback para formato legado
  return normalizeUAZAPIMessageLegacy(payload);
}

/**
 * Normaliza mensagem UAZAPI - NOVO FORMATO (body.EventType = "messages")
 */
function normalizeUAZAPIMessageNew(payload: any): NormalizedMessage | null {
  const body = payload.body;
  if (!body || body.EventType !== "messages") return null;
  
  const message = body.message;
  const chat = body.chat;
  
  if (!message) return null;
  
  const isFromMe = message.fromMe || false;
  
  // =====================================================
  // CORREÇÃO: Ignorar mensagens editadas via API (fromMe)
  // Quando editamos pelo CRM, a UAZAPI envia webhook de volta
  // como se fosse nova mensagem. O campo "edited" contém timestamp
  // =====================================================
  const isEdited = message.edited && message.edited !== "";
  
  if (isEdited && isFromMe) {
    console.log(`[Webhook UAZAPI] ⏭️ Ignoring edited fromMe message (already updated locally) - messageid: ${message.messageid}, edited: ${message.edited}`);
    return null;  // Retornar null para não processar
  }
  
  if (isEdited && !isFromMe) {
    console.log(`[Webhook UAZAPI] ✏️ Detected edited message from contact - messageid: ${message.messageid}, edited: ${message.edited}`);
  }
  
  console.log(`[Webhook UAZAPI] Processing NEW format message - instanceName: ${body.instanceName}, fromMe: ${isFromMe}, isEdited: ${isEdited}`);
  
  // =====================================================
  // CORREÇÃO CRÍTICA: Lógica diferente para fromMe vs recebida
  // - fromMe=true: usar telefone do DESTINATÁRIO (chat.phone ou chatid)
  // - fromMe=false: usar telefone do REMETENTE (sender_pn)
  // =====================================================
  let from = "";
  
  if (isFromMe) {
    // Mensagem ENVIADA pelo canal → usar número do DESTINATÁRIO (cliente)
    // Prioridade 1: chat.phone
    if (chat?.phone) {
      from = chat.phone.replace(/\D/g, "");
      console.log(`[Webhook UAZAPI] fromMe=true → Using chat.phone (recipient): ${from}`);
    }
    // Prioridade 2: chatid
    else if (message.chatid) {
      from = message.chatid
        .replace("@s.whatsapp.net", "")
        .replace("@c.us", "")
        .replace(/\D/g, "");
      console.log(`[Webhook UAZAPI] fromMe=true → Using chatid (recipient): ${from}`);
    }
    // Fallback: sender_pn para fromMe NÃO deve ser usado (é o número do canal)
    else {
      console.log(`[Webhook UAZAPI] ⚠️ fromMe=true but no recipient phone found - chat.phone: ${chat?.phone}, chatid: ${message.chatid}`);
    }
  } else {
    // Mensagem RECEBIDA do cliente → usar número do REMETENTE
    // Prioridade 1: sender_pn (número real do cliente)
    if (message.sender_pn) {
      from = message.sender_pn
        .replace("@s.whatsapp.net", "")
        .replace("@c.us", "")
        .replace(/\D/g, "");
      console.log(`[Webhook UAZAPI] fromMe=false → Using sender_pn (sender): ${from}`);
    }
    // Prioridade 2: chat.phone
    else if (chat?.phone) {
      from = chat.phone.replace(/\D/g, "");
      console.log(`[Webhook UAZAPI] fromMe=false → Using chat.phone: ${from}`);
    }
    // Prioridade 3: chatid
    else if (message.chatid) {
      from = message.chatid
        .replace("@s.whatsapp.net", "")
        .replace("@c.us", "")
        .replace(/\D/g, "");
      console.log(`[Webhook UAZAPI] fromMe=false → Using chatid: ${from}`);
    }
  }
  
  // Validar telefone brasileiro
  if (!isValidBrazilianPhone(from)) {
    console.log(`[Webhook UAZAPI] ⚠️ REJECTING message - Invalid phone (LID?): ${from}, sender_pn: ${message.sender_pn || 'N/A'}, chat.phone: ${chat?.phone || 'N/A'}, chatid: ${message.chatid || 'N/A'}`);
    return null;
  }
  
  // Ignorar grupos
  if (message.isGroup || chat?.wa_isGroup) {
    console.log(`[Webhook UAZAPI] Ignoring group message`);
    return null;
  }
  
  // Detectar tipo de mensagem
  const messageType = detectUAZAPIMessageTypeNew(message);
  
  // Extrair referral data (Meta Ads) - apenas para mensagens recebidas (não fromMe)
  const referralData = !message.fromMe 
    ? extractReferralDataUAZAPI(message) 
    : null;
  
  // Timestamp: UAZAPI usa milissegundos
  const timestamp = message.messageTimestamp 
    ? new Date(message.messageTimestamp)
    : new Date();
  
  console.log(`[Webhook UAZAPI] ✅ Normalized - Type: ${messageType}, From: ${from}, FromMe: ${message.fromMe}, HasReferral: ${!!referralData}, isEdited: ${isEdited}`);
  
  return {
    id: `uazapi_${message.messageid}`,
    provider: "uazapi",
    instanceId: body.instanceName || "",
    from,
    fromName: message.senderName || chat?.wa_name || "",
    isFromMe: message.fromMe || false,
    type: messageType,
    content: extractUAZAPIContentNew(message, messageType),
    mediaUrl: extractUAZAPIMediaUrl(message),
    mediaMimeType: message.mediaType || undefined,
    caption: message.content?.caption,
    timestamp,
    quotedMessageId: message.quoted || message.content?.contextInfo?.stanzaId,
    status: "delivered",
    originalId: message.messageid,
    referralData: referralData || undefined,
    isEdited: isEdited,  // Flag para atualização em vez de inserção
  };
}

/**
 * Normaliza mensagem UAZAPI - FORMATO LEGADO (para retrocompatibilidade)
 */
function normalizeUAZAPIMessageLegacy(payload: any): NormalizedMessage | null {
  const msg = payload.data || payload.message || payload;
  if (!msg) return null;

  let rawFrom = msg.from || msg.remoteJid || msg.phone || "";
  
  if (rawFrom.includes("@g.us")) {
    console.log(`[Webhook UAZAPI Legacy] Ignoring group message from: ${rawFrom}`);
    return null;
  }
  
  let from = rawFrom.replace("@s.whatsapp.net", "").replace("@c.us", "").replace(/\D/g, "");
  
  if (from.startsWith("120363")) {
    console.log(`[Webhook UAZAPI Legacy] Ignoring group message from ID: ${from}`);
    return null;
  }
  
  // Validate Brazilian phone to prevent LID contacts
  if (!isValidBrazilianPhone(from)) {
    console.log(`[Webhook UAZAPI Legacy] ⚠️ REJECTING message - Invalid phone (LID?): ${from}`);
    return null;
  }

  const messageType = detectUAZAPIMessageType(msg);

  return {
    id: `uazapi_${msg.id || msg.key?.id || Date.now()}`,
    provider: "uazapi",
    instanceId: payload.instance || payload.session || "",
    from,
    fromName: msg.pushName || msg.senderName || "",
    isFromMe: msg.fromMe || msg.key?.fromMe || false,
    type: messageType,
    content: extractUAZAPIContent(msg, messageType),
    mediaUrl: msg.mediaUrl || msg.media?.url,
    mediaMimeType: msg.mimetype || msg.media?.mimetype,
    caption: msg.caption,
    timestamp: new Date(msg.timestamp ? msg.timestamp * 1000 : Date.now()),
    quotedMessageId: msg.quotedMessageId || msg.contextInfo?.stanzaId,
    status: "delivered",
    originalId: msg.id || msg.key?.id || "",
  };
}

function detectUAZAPIMessageType(msg: any): MessageType {
  if (msg.type === "chat" || msg.type === "text" || msg.text || msg.body) return "text";
  if (msg.type === "image" || msg.image || msg.imageMessage) return "image";
  if (msg.type === "audio" || msg.type === "ptt" || msg.audio || msg.audioMessage) return "audio";
  if (msg.type === "video" || msg.video || msg.videoMessage) return "video";
  if (msg.type === "document" || msg.document || msg.documentMessage) return "document";
  if (msg.type === "sticker" || msg.sticker || msg.stickerMessage) return "sticker";
  if (msg.type === "location" || msg.location || msg.locationMessage) return "location";
  if (msg.type === "vcard" || msg.type === "contact" || msg.contactMessage) return "contact";
  return "text";
}

function extractUAZAPIContent(msg: any, type: MessageType): string {
  switch (type) {
    case "text": return msg.body || msg.text || msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    case "image": return msg.caption || "[Imagem]";
    case "audio": return "[Áudio]";
    case "video": return msg.caption || "[Vídeo]";
    case "document": return msg.fileName || msg.title || "[Documento]";
    case "sticker": return "[Sticker]";
    case "location": return "[Localização]";
    case "contact": return "[Contato]";
    default: return "";
  }
}

function normalizeEvolutionMessage(payload: any): NormalizedMessage | null {
  const eventStr = typeof payload.event === 'string' ? payload.event : "";
  const eventType = eventStr.toLowerCase().replace(/_/g, '.');
  if (eventType !== "messages.upsert" && eventType !== "send.message") return null;

  let msg = payload.data;
  if (Array.isArray(msg)) {
    msg = msg[0];
  }
  
  if (!msg?.key) return null;
  
  // =====================================================
  // CRITICAL: Skip reactionMessage - these are handled by handleReactionEvent
  // Processing them here creates "ghost messages" with just timestamps
  // =====================================================
  if (msg?.message?.reactionMessage || msg?.messageType === "reactionMessage") {
    console.log(`[Webhook Evolution] Skipping reactionMessage in normalizeEvolutionMessage - handled separately`);
    return null;
  }

  const rawRemoteJid = msg.key.remoteJid || "";
  
  // Filter out group messages
  if (rawRemoteJid.includes("@g.us")) {
    console.log(`[Webhook Evolution] Ignoring group message from: ${rawRemoteJid}`);
    return null;
  }
  
  // =====================================================
  // CRITICAL: Phone validation to prevent LID contacts
  // =====================================================
  const validPhone = extractValidPhoneFromPayload(msg, rawRemoteJid);
  
  if (!validPhone) {
    // Log the invalid phone for debugging - use cleanWhatsAppJid for accurate logging
    const extractedPhone = cleanWhatsAppJid(rawRemoteJid).replace(/\D/g, "");
    
    console.log(`[Webhook Evolution] ⚠️ REJECTING message - Invalid phone (LID?): ${extractedPhone}, rawJid: ${rawRemoteJid}, remoteJidAlt: ${msg.key.remoteJidAlt || 'none'}`);
    return null;
  }
  
  const from = validPhone;
  
  if (from.startsWith("120363")) {
    console.log(`[Webhook Evolution] Ignoring group message from ID: ${from}`);
    return null;
  }

  const messageType = detectEvolutionMessageType(msg);
  
  // Extract base64 data if available
  const mediaData = extractEvolutionMediaBase64(msg);
  
  // Extract quotedMessageId from multiple possible locations
  const quotedMessageId = extractEvolutionQuotedMessageId(msg);
  
  // Extract referral data (Meta Ads / Click-to-WhatsApp) - only for first message (not fromMe)
  const referralData = !msg.key.fromMe ? extractReferralData(msg) : null;
  
  if (quotedMessageId) {
    console.log(`[Webhook Evolution] Found quotedMessageId: ${quotedMessageId}`);
  }
  
  console.log(`[Webhook Evolution] ✅ Processing ${payload.event} - Type: ${messageType}, From: ${from}, FromMe: ${msg.key.fromMe}, HasBase64: ${!!mediaData.base64}, QuotedId: ${quotedMessageId || 'none'}, HasReferral: ${!!referralData}`);

  return {
    id: `evolution_${msg.key.id}`,
    provider: "evolution",
    instanceId: payload.instance || "",
    from,
    fromName: msg.pushName || "",
    isFromMe: msg.key.fromMe || false,
    type: messageType,
    content: extractEvolutionContent(msg, messageType),
    mediaUrl: msg.message?.imageMessage?.url || msg.message?.audioMessage?.url || msg.message?.videoMessage?.url || msg.message?.documentMessage?.url,
    mediaBase64: mediaData.base64 || undefined,
    mediaMimeType: mediaData.mimetype || msg.message?.imageMessage?.mimetype || msg.message?.audioMessage?.mimetype || msg.message?.videoMessage?.mimetype || msg.message?.documentMessage?.mimetype,
    caption: msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption,
    timestamp: new Date((msg.messageTimestamp || Date.now() / 1000) * 1000),
    quotedMessageId: quotedMessageId,
    status: "delivered",
    originalId: msg.key.id,
    referralData: referralData || undefined,
  };
}

// Helper function to extract quotedMessageId from all possible locations in Evolution API payload
function extractEvolutionQuotedMessageId(msg: any): string | undefined {
  // Check msg.contextInfo first (for send.message events)
  if (msg.contextInfo?.stanzaId) {
    return msg.contextInfo.stanzaId;
  }
  
  const message = msg.message;
  if (!message) return undefined;
  
  // Check each message type for contextInfo.stanzaId
  // Text messages
  if (message.extendedTextMessage?.contextInfo?.stanzaId) {
    return message.extendedTextMessage.contextInfo.stanzaId;
  }
  if (message.conversation && message.contextInfo?.stanzaId) {
    return message.contextInfo.stanzaId;
  }
  
  // Media messages
  if (message.imageMessage?.contextInfo?.stanzaId) {
    return message.imageMessage.contextInfo.stanzaId;
  }
  if (message.audioMessage?.contextInfo?.stanzaId) {
    return message.audioMessage.contextInfo.stanzaId;
  }
  if (message.videoMessage?.contextInfo?.stanzaId) {
    return message.videoMessage.contextInfo.stanzaId;
  }
  if (message.documentMessage?.contextInfo?.stanzaId) {
    return message.documentMessage.contextInfo.stanzaId;
  }
  if (message.stickerMessage?.contextInfo?.stanzaId) {
    return message.stickerMessage.contextInfo.stanzaId;
  }
  
  // Check messageContextInfo as fallback (some Evolution versions use this)
  if (message.messageContextInfo?.stanzaId) {
    return message.messageContextInfo.stanzaId;
  }
  
  return undefined;
}

function detectEvolutionMessageType(msg: any): MessageType {
  const message = msg.message;
  if (!message) return "text";
  
  if (message.conversation || message.extendedTextMessage) return "text";
  if (message.imageMessage) return "image";
  if (message.audioMessage) return "audio";
  if (message.videoMessage) return "video";
  if (message.documentMessage) return "document";
  if (message.stickerMessage) return "sticker";
  if (message.locationMessage) return "location";
  if (message.contactMessage || message.contactsArrayMessage) return "contacts";
  return "text";
}

function extractEvolutionContent(msg: any, type: MessageType): string {
  const message = msg.message;
  switch (type) {
    case "text": return message?.conversation || message?.extendedTextMessage?.text || "";
    case "image": return message?.imageMessage?.caption || "[Imagem]";
    case "audio": return "[Áudio]";
    case "video": return message?.videoMessage?.caption || "[Vídeo]";
    case "document": return message?.documentMessage?.fileName || "[Documento]";
    case "sticker": return "[Sticker]";
    case "location": return "[Localização]";
    case "contact":
    case "contacts": {
      const contactMsg = message?.contactMessage;
      const contactsArray = message?.contactsArrayMessage?.contacts;
      
      // Se tiver array de contacts
      if (contactsArray && contactsArray.length > 0) {
        const c = contactsArray[0];
        console.log(`[Webhook Evolution] 📇 Extracted contact from array: ${c.displayName}`);
        return `📇 ${c.displayName || 'Contato'}`;
      }
      
      // Se tiver contactMessage com vCard
      if (contactMsg) {
        const vcard = contactMsg.vcard || '';
        const nameMatch = vcard.match(/FN:(.+)/);
        const phoneMatch = vcard.match(/TEL[^:]*:([+\d\s\-()]+)/);
        const name = nameMatch?.[1]?.trim() || contactMsg.displayName || 'Contato';
        const phone = phoneMatch?.[1]?.trim() || '';
        console.log(`[Webhook Evolution] 📇 Extracted contact: ${name} (${phone})`);
        return `📇 ${name}${phone ? ` (${phone})` : ''}`;
      }
      
      return "[Contato]";
    }
    default: return "";
  }
}
