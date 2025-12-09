import { useState } from 'react';
import { FileText, ExternalLink } from 'lucide-react';
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
  const [iframeError, setIframeError] = useState(false);

  const isPDF = fileName.toLowerCase().endsWith('.pdf') || 
                url.toLowerCase().includes('.pdf');

  return (
    <>
      <div 
        className={cn(
          'rounded-lg overflow-hidden transition-colors cursor-pointer',
          isMe ? 'bg-white/10 hover:bg-white/15' : 'bg-muted hover:bg-muted/80'
        )}
        onClick={() => setShowPreview(true)}
      >
        {/* PDF Preview Thumbnail */}
        {isPDF && !iframeError && (
          <div className="relative w-full h-32 bg-white overflow-hidden">
            <iframe
              src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
              className="w-full h-full border-0 pointer-events-none scale-100"
              title={fileName}
              onError={() => setIframeError(true)}
            />
            <div className="absolute inset-0 bg-transparent" />
          </div>
        )}

        {/* File Info Bar */}
        <div className="flex items-center gap-3 p-3">
          <FileText size={24} className={cn('flex-shrink-0', isMe ? 'text-white' : 'text-muted-foreground')} />
          <div className="flex-1 min-w-0">
            <span className="text-sm truncate block">{fileName}</span>
            {isPDF && (
              <span className={cn('text-xs', isMe ? 'text-white/60' : 'text-muted-foreground')}>
                Clique para visualizar
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
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

      <DocumentPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        documentUrl={url}
        documentName={fileName}
      />
    </>
  );
};
