import { useState } from 'react';
import { FileText, ExternalLink, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MediaDownloadButton } from './MediaDownloadButton';
import { DocumentPreviewDialog } from './DocumentPreviewDialog';

interface DocumentPreviewProps {
  url: string;
  fileName: string;
  isMe: boolean;
}

export const DocumentPreview = ({ url, fileName, isMe }: DocumentPreviewProps) => {
  const [showPreview, setShowPreview] = useState(false);

  const isPDF = fileName.toLowerCase().endsWith('.pdf') || 
                url.toLowerCase().includes('.pdf');

  // Validate URL before attempting any preview
  const isValidUrl = url && (url.startsWith('http://') || url.startsWith('https://'));

  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPDF && isValidUrl) {
      setShowPreview(true);
    } else {
      // For non-PDFs, open in new tab
      window.open(url, '_blank');
    }
  };

  return (
    <>
      <div 
        className={cn(
          'rounded-lg overflow-hidden transition-colors',
          isMe ? 'bg-white/10' : 'bg-muted'
        )}
      >
        {/* File Info Bar */}
        <div className="flex items-center gap-3 p-3">
          <FileText size={24} className={cn('flex-shrink-0', isMe ? 'text-white' : 'text-muted-foreground')} />
          <div className="flex-1 min-w-0">
            <span className="text-sm truncate block">{fileName}</span>
            {isPDF && (
              <span className={cn('text-xs', isMe ? 'text-white/60' : 'text-muted-foreground')}>
                PDF
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isPDF && isValidUrl && (
              <button
                onClick={handlePreviewClick}
                className={cn(
                  'p-1.5 rounded-full transition-colors',
                  isMe ? 'hover:bg-white/20' : 'hover:bg-muted-foreground/20'
                )}
                title="Visualizar"
              >
                <Eye size={16} className={isMe ? 'text-white/70' : 'text-muted-foreground'} />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(url, '_blank');
              }}
              className={cn(
                'p-1.5 rounded-full transition-colors',
                isMe ? 'hover:bg-white/20' : 'hover:bg-muted-foreground/20'
              )}
              title="Abrir em nova aba"
            >
              <ExternalLink size={16} className={isMe ? 'text-white/70' : 'text-muted-foreground'} />
            </button>
            <MediaDownloadButton
              url={url}
              fileName={fileName}
              className={cn(
                '!bg-transparent',
                isMe ? 'hover:!bg-white/20' : 'hover:!bg-muted-foreground/20'
              )}
            />
          </div>
        </div>
      </div>

      {isPDF && isValidUrl && (
        <DocumentPreviewDialog
          open={showPreview}
          onOpenChange={setShowPreview}
          documentUrl={url}
          documentName={fileName}
        />
      )}
    </>
  );
};
