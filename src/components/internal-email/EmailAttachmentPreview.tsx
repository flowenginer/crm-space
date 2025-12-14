import { useState } from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  FileSpreadsheet, 
  FileType, 
  File, 
  Download, 
  Eye,
  X,
  Music,
  Video,
  Archive,
  Code
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Attachment {
  id?: string;
  file_name: string;
  file_url: string;
  file_size?: number | null;
  mime_type?: string | null;
}

interface EmailAttachmentPreviewProps {
  attachments: Attachment[];
  showRemove?: boolean;
  onRemove?: (index: number) => void;
  compact?: boolean;
}

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function getFileIcon(fileName: string, mimeType?: string | null) {
  const ext = getFileExtension(fileName);
  const mime = mimeType?.toLowerCase() || '';

  // Imagens
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'heic'].includes(ext)) {
    return { icon: ImageIcon, color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
  }

  // PDFs
  if (ext === 'pdf' || mime === 'application/pdf') {
    return { icon: FileText, color: 'text-red-500', bg: 'bg-red-500/10' };
  }

  // Documentos Word
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext) || mime.includes('word') || mime.includes('document')) {
    return { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' };
  }

  // Planilhas
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel')) {
    return { icon: FileSpreadsheet, color: 'text-green-600', bg: 'bg-green-600/10' };
  }

  // Apresentações
  if (['ppt', 'pptx', 'odp'].includes(ext) || mime.includes('presentation') || mime.includes('powerpoint')) {
    return { icon: FileType, color: 'text-orange-500', bg: 'bg-orange-500/10' };
  }

  // Arquivos de design (Photoshop, Illustrator, CorelDRAW, etc)
  if (['psd', 'ai', 'cdr', 'eps', 'indd', 'sketch', 'fig', 'xd', 'afdesign', 'afphoto'].includes(ext)) {
    return { icon: FileType, color: 'text-purple-500', bg: 'bg-purple-500/10' };
  }

  // Áudio
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) {
    return { icon: Music, color: 'text-pink-500', bg: 'bg-pink-500/10' };
  }

  // Vídeo
  if (mime.startsWith('video/') || ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'webm'].includes(ext)) {
    return { icon: Video, color: 'text-cyan-500', bg: 'bg-cyan-500/10' };
  }

  // Arquivos compactados
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) {
    return { icon: Archive, color: 'text-amber-500', bg: 'bg-amber-500/10' };
  }

  // Código
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'xml', 'py', 'java', 'cpp', 'c', 'h', 'php', 'rb', 'go', 'rs', 'swift', 'kt'].includes(ext)) {
    return { icon: Code, color: 'text-slate-500', bg: 'bg-slate-500/10' };
  }

  // Padrão
  return { icon: File, color: 'text-muted-foreground', bg: 'bg-muted' };
}

function isPreviewableImage(fileName: string, mimeType?: string | null): boolean {
  const ext = getFileExtension(fileName);
  const mime = mimeType?.toLowerCase() || '';
  return mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
}

function isPdf(fileName: string, mimeType?: string | null): boolean {
  const ext = getFileExtension(fileName);
  return ext === 'pdf' || mimeType === 'application/pdf';
}

export function EmailAttachmentPreview({ 
  attachments, 
  showRemove = false, 
  onRemove,
  compact = false 
}: EmailAttachmentPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | null>(null);
  const [previewName, setPreviewName] = useState<string>('');

  const handlePreview = (attachment: Attachment) => {
    if (isPreviewableImage(attachment.file_name, attachment.mime_type)) {
      setPreviewUrl(attachment.file_url);
      setPreviewType('image');
      setPreviewName(attachment.file_name);
    } else if (isPdf(attachment.file_name, attachment.mime_type)) {
      setPreviewUrl(attachment.file_url);
      setPreviewType('pdf');
      setPreviewName(attachment.file_name);
    } else {
      // Para outros arquivos, abre direto para download
      window.open(attachment.file_url, '_blank');
    }
  };

  const handleDownload = (attachment: Attachment) => {
    const link = document.createElement('a');
    link.href = attachment.file_url;
    link.download = attachment.file_name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (compact) {
    return (
      <>
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment, index) => {
            const { icon: Icon, color, bg } = getFileIcon(attachment.file_name, attachment.mime_type);
            const canPreview = isPreviewableImage(attachment.file_name, attachment.mime_type) || isPdf(attachment.file_name, attachment.mime_type);

            return (
              <Badge key={index} variant="secondary" className="gap-1.5 pr-1 py-1">
                <div className={cn('p-0.5 rounded', bg)}>
                  <Icon className={cn('h-3 w-3', color)} />
                </div>
                <span className="max-w-[120px] truncate text-xs">{attachment.file_name}</span>
                {showRemove && onRemove ? (
                  <button onClick={() => onRemove(index)} className="ml-1 hover:bg-muted rounded p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                ) : (
                  <button onClick={() => handlePreview(attachment)} className="ml-1 hover:bg-muted rounded p-0.5">
                    {canPreview ? <Eye className="h-3 w-3" /> : <Download className="h-3 w-3" />}
                  </button>
                )}
              </Badge>
            );
          })}
        </div>

        {/* Preview Dialog */}
        <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0">
            <DialogHeader className="p-4 border-b">
              <DialogTitle className="flex items-center justify-between">
                <span className="truncate">{previewName}</span>
                <Button variant="outline" size="sm" onClick={() => previewUrl && handleDownload({ file_name: previewName, file_url: previewUrl })}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto max-h-[calc(90vh-80px)]">
              {previewType === 'image' && previewUrl && (
                <img 
                  src={previewUrl} 
                  alt={previewName} 
                  className="w-full h-auto object-contain"
                />
              )}
              {previewType === 'pdf' && previewUrl && (
                <iframe 
                  src={previewUrl} 
                  className="w-full h-[70vh]"
                  title={previewName}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {attachments.map((attachment, index) => {
          const { icon: Icon, color, bg } = getFileIcon(attachment.file_name, attachment.mime_type);
          const canPreview = isPreviewableImage(attachment.file_name, attachment.mime_type);

          return (
            <div
              key={index}
              className="group relative flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              {/* Thumbnail para imagens */}
              {canPreview ? (
                <div 
                  className="w-12 h-12 rounded overflow-hidden bg-muted flex items-center justify-center cursor-pointer"
                  onClick={() => handlePreview(attachment)}
                >
                  <img 
                    src={attachment.file_url} 
                    alt={attachment.file_name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback para ícone se a imagem não carregar
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement?.classList.add(bg);
                    }}
                  />
                </div>
              ) : (
                <div className={cn('p-3 rounded-lg', bg)}>
                  <Icon className={cn('h-5 w-5', color)} />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.file_size)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {(isPreviewableImage(attachment.file_name, attachment.mime_type) || isPdf(attachment.file_name, attachment.mime_type)) && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => handlePreview(attachment)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => handleDownload(attachment)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                {showRemove && onRemove && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive"
                    onClick={() => onRemove(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate">{previewName}</span>
              <Button variant="outline" size="sm" onClick={() => previewUrl && handleDownload({ file_name: previewName, file_url: previewUrl })}>
                <Download className="h-4 w-4 mr-2" />
                Baixar
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto max-h-[calc(90vh-80px)]">
            {previewType === 'image' && previewUrl && (
              <img 
                src={previewUrl} 
                alt={previewName} 
                className="w-full h-auto object-contain"
              />
            )}
            {previewType === 'pdf' && previewUrl && (
              <iframe 
                src={previewUrl} 
                className="w-full h-[70vh]"
                title={previewName}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
