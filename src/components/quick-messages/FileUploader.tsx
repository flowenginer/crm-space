import { useState, useRef, useCallback } from 'react';
import { Paperclip, X, FileText, Image as ImageIcon, Video, File, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface FileUploaderProps {
  onFileUploaded: (url: string, type: string, name: string) => void;
  existingUrl?: string | null;
  existingType?: string | null;
  existingName?: string | null;
  onRemove?: () => void;
  category: 'media' | 'documents';
  compact?: boolean;
}

// Limite de 50MB (padrão do Supabase Storage)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const MEDIA_TYPES = {
  media: {
    accept: 'image/*,video/*,.pdf',
    description: 'PNG, JPEG, GIF, MP4, PDF (máx. 50MB)',
    extensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.mov', '.pdf'],
  },
  documents: {
    accept: '*/*',
    description: 'Qualquer tipo de arquivo (máx. 50MB)',
    extensions: ['*'],
  },
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function FileUploader({ 
  onFileUploaded, 
  existingUrl, 
  existingType,
  existingName,
  onRemove,
  category,
  compact = false
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileUrl, setFileUrl] = useState<string | null>(existingUrl || null);
  const [fileType, setFileType] = useState<string | null>(existingType || null);
  const [fileName, setFileName] = useState<string | null>(existingName || null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sanitizeFileName = (name: string): string => {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_');
  };

  const getFileIcon = (type: string | null) => {
    if (!type) return <File size={24} />;
    if (type.startsWith('image')) return <ImageIcon size={24} />;
    if (type.startsWith('video')) return <Video size={24} />;
    if (type.includes('pdf')) return <FileText size={24} className="text-red-500" />;
    return <FileText size={24} />;
  };

  const validateFileSize = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      const fileSize = formatFileSize(file.size);
      const maxSize = formatFileSize(MAX_FILE_SIZE);
      toast({ 
        title: 'Arquivo muito grande', 
        description: `O arquivo "${file.name}" tem ${fileSize}. O limite máximo é ${maxSize}.`,
        variant: 'destructive' 
      });
      return false;
    }
    return true;
  };

  const uploadFile = async (file: File) => {
    // Validar tamanho antes de enviar
    if (!validateFileSize(file)) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const folder = category === 'media' ? 'media' : 'documents';
      const sanitizedName = sanitizeFileName(file.name);
      const fileName = `${folder}/${Date.now()}_${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('template-attachments')
        .upload(fileName, file, { 
          contentType: file.type,
          upsert: true 
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('template-attachments')
        .getPublicUrl(fileName);

      setFileUrl(publicUrl);
      setFileType(file.type);
      setFileName(file.name);
      
      const mediaType = file.type.startsWith('image') ? 'image' : 
                       file.type.startsWith('video') ? 'video' : 
                       file.type.includes('pdf') ? 'document' : 'document';
      
      onFileUploaded(publicUrl, mediaType, file.name);
      toast({ title: 'Arquivo enviado com sucesso!' });
    } catch (error) {
      console.error('Error uploading file:', error);
      
      let errorMessage = 'Erro ao enviar arquivo';
      let errorDescription = 'Tente novamente mais tarde.';
      
      if (error instanceof Error) {
        if (error.message.includes('exceeded the maximum') || error.message.includes('Payload too large')) {
          errorMessage = 'Arquivo muito grande';
          errorDescription = `O arquivo excede o limite permitido pelo servidor. Reduza o tamanho e tente novamente.`;
        }
      }
      
      toast({ 
        title: errorMessage, 
        description: errorDescription,
        variant: 'destructive' 
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(100);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleRemove = () => {
    setFileUrl(null);
    setFileType(null);
    setFileName(null);
    if (onRemove) onRemove();
  };

  const config = MEDIA_TYPES[category];

  return (
    <div className="space-y-4">
      {!fileUrl ? (
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl text-center cursor-pointer transition-all
            ${compact ? 'p-4' : 'p-8'}
            ${isDragging 
              ? 'border-primary bg-primary/10' 
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
            }
          `}
        >
          {isUploading ? (
            <div className={`flex items-center gap-3 ${compact ? 'flex-row' : 'flex-col'}`}>
              <Loader2 size={compact ? 20 : 32} className="animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Enviando...</span>
              {!compact && (
                <div className="w-full max-w-xs h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className={`flex items-center gap-3 ${compact ? 'flex-row' : 'flex-col'}`}>
              <Paperclip size={compact ? 18 : 32} className="text-muted-foreground" />
              <div className={compact ? 'text-left' : 'text-center'}>
                <p className={`font-medium text-foreground ${compact ? 'text-sm' : ''}`}>
                  {compact ? 'Anexar arquivo (opcional)' : 'Arraste arquivos ou clique aqui'}
                </p>
                {!compact && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {config.description}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          {/* Preview */}
          {fileType?.startsWith('image') && (
            <div className="aspect-video bg-muted flex items-center justify-center">
              <img 
                src={fileUrl} 
                alt="Preview" 
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
          
          {fileType?.startsWith('video') && (
            <div className="aspect-video bg-black">
              <video 
                src={fileUrl} 
                controls 
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {!fileType?.startsWith('image') && !fileType?.startsWith('video') && (
            <div className="p-6 bg-muted flex items-center justify-center">
              {getFileIcon(fileType)}
            </div>
          )}

          {/* File Info & Remove */}
          <div className="flex items-center justify-between p-3 bg-card">
            <div className="flex items-center gap-2 min-w-0">
              {getFileIcon(fileType)}
              <span className="text-sm font-medium truncate">
                {fileName || 'Arquivo'}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleRemove}
              className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
            >
              <X size={16} />
            </Button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={config.accept}
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
