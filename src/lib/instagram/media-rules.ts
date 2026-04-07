// =====================================================
// REGRAS DE MÍDIA DO INSTAGRAM (Meta Graph API)
// Baseado em: https://developers.facebook.com/docs/messenger-platform/instagram/features/send-message
// =====================================================

export const INSTAGRAM_SUPPORTED_FORMATS = {
  audio: {
    extensions: ['aac', 'm4a', 'wav', 'mp4'],
    mimeTypes: ['audio/aac', 'audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/wave'],
    maxSizeMB: 25,
    description: 'AAC, M4A, WAV ou MP4',
  },
  image: {
    extensions: ['png', 'jpeg', 'jpg', 'gif'],
    mimeTypes: ['image/png', 'image/jpeg', 'image/gif'],
    maxSizeMB: 8,
    description: 'PNG, JPEG ou GIF',
  },
  video: {
    extensions: ['mp4', 'ogg', 'avi', 'mov', 'webm'],
    mimeTypes: ['video/mp4', 'video/ogg', 'video/avi', 'video/quicktime', 'video/webm'],
    maxSizeMB: 25,
    description: 'MP4, OGG, AVI, MOV ou WebM',
  },
  file: {
    extensions: ['pdf'],
    mimeTypes: ['application/pdf'],
    maxSizeMB: 25,
    description: 'PDF',
  },
} as const;

// Formatos de áudio rejeitados pelo Instagram que precisam ser convertidos
export const INSTAGRAM_REJECTED_AUDIO_MIMES = [
  'audio/mpeg',      // MP3
  'audio/mp3',       // MP3 alternativo
  'audio/ogg',       // OGG
  'audio/webm',      // WebM
  'audio/opus',      // Opus
];

/**
 * Verifica se um MIME type é suportado pelo Instagram para o tipo de mensagem
 */
export function isInstagramSupportedMime(messageType: string, mimeType: string): boolean {
  const key = messageType as keyof typeof INSTAGRAM_SUPPORTED_FORMATS;
  const rules = INSTAGRAM_SUPPORTED_FORMATS[key];
  if (!rules) return true; // text e outros tipos sem restrição de formato
  return (rules.mimeTypes as readonly string[]).includes(mimeType.toLowerCase());
}

/**
 * Verifica se um arquivo de áudio precisa ser convertido para enviar via Instagram
 */
export function needsInstagramAudioConversion(mimeType: string): boolean {
  return INSTAGRAM_REJECTED_AUDIO_MIMES.includes(mimeType.toLowerCase());
}

/**
 * Retorna mensagem de erro amigável para formato não suportado
 */
export function getInstagramFormatError(messageType: string): string {
  const rules = INSTAGRAM_SUPPORTED_FORMATS[messageType as keyof typeof INSTAGRAM_SUPPORTED_FORMATS];
  if (!rules) return 'Formato não suportado pelo Instagram.';
  return `Instagram aceita ${messageType === 'audio' ? 'áudio' : messageType} apenas em: ${rules.description} (máx ${rules.maxSizeMB}MB).`;
}
