import { useState, useCallback } from 'react';
import { Upload, Link, X, ImageIcon, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProductImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function ProductImageUploader({ value, onChange }: ProductImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(value ? 'url' : 'upload');
  const [urlInput, setUrlInput] = useState(value || '');

  const uploadFile = async (file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Formato não suportado. Use PNG, JPEG ou WEBP.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('Arquivo muito grande. Máximo 5MB.');
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      onChange(publicUrl);
      toast.success('Imagem carregada com sucesso!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao carregar imagem.');
    } finally {
      setIsUploading(false);
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

    const file = e.dataTransfer.files[0];
    if (file) {
      uploadFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleUrlApply = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      toast.success('URL aplicada!');
    }
  };

  const handleRemove = async () => {
    // If it's a supabase storage URL, try to delete the file
    if (value.includes('product-images')) {
      try {
        const url = new URL(value);
        const pathParts = url.pathname.split('/product-images/');
        if (pathParts[1]) {
          await supabase.storage
            .from('product-images')
            .remove([pathParts[1]]);
        }
      } catch (error) {
        console.error('Error removing file:', error);
      }
    }
    onChange('');
    setUrlInput('');
  };

  // If we have a value, show the preview
  if (value) {
    return (
      <div className="relative group">
        <div className="relative aspect-square w-full max-w-[200px] rounded-lg border border-border overflow-hidden bg-muted">
          <img
            src={value}
            alt="Preview"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder.svg';
            }}
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 truncate max-w-[200px]">
          {value.includes('product-images') ? 'Imagem carregada' : 'URL externa'}
        </p>
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="upload" className="flex items-center gap-1.5">
          <Upload className="h-4 w-4" />
          Upload
        </TabsTrigger>
        <TabsTrigger value="url" className="flex items-center gap-1.5">
          <Link className="h-4 w-4" />
          URL Externa
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="mt-3">
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
            }
            ${isUploading ? 'pointer-events-none opacity-60' : ''}
          `}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => !isUploading && document.getElementById('product-image-input')?.click()}
        >
          <input
            id="product-image-input"
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-muted">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Arraste uma imagem aqui</p>
                <p className="text-xs text-muted-foreground">
                  ou clique para selecionar
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                PNG, JPEG, WEBP (máx. 5MB)
              </p>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="url" className="mt-3">
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="https://exemplo.com/imagem.jpg"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleUrlApply}
            disabled={!urlInput.trim()}
          >
            Aplicar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Cole a URL de uma imagem externa
        </p>
      </TabsContent>
    </Tabs>
  );
}
