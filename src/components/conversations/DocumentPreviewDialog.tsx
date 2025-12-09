import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, X, FileText } from 'lucide-react';

interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentUrl: string;
  documentName: string;
}

export const DocumentPreviewDialog = ({
  open,
  onOpenChange,
  documentUrl,
  documentName,
}: DocumentPreviewDialogProps) => {
  const [loadError, setLoadError] = useState(false);

  const handleDownload = async () => {
    try {
      const response = await fetch(documentUrl);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = documentName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      window.open(documentUrl, '_blank');
    }
  };

  const handleOpenInNewTab = () => {
    window.open(documentUrl, '_blank');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setLoadError(false);
    }
    onOpenChange(newOpen);
  };

  const isPDF = documentName.toLowerCase().endsWith('.pdf') || 
                documentUrl.toLowerCase().includes('.pdf');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-background">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileText size={20} className="text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium truncate">{documentName}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenInNewTab}
              className="flex items-center gap-1.5"
            >
              <ExternalLink size={16} />
              <span className="hidden sm:inline">Abrir em nova aba</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="flex items-center gap-1.5"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Baixar</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X size={18} />
            </Button>
          </div>
        </div>

        {/* Document Preview */}
        <div className="flex-1 h-[calc(90vh-57px)] bg-muted/30">
          {loadError ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <FileText size={64} className="text-muted-foreground" />
              <p className="text-muted-foreground text-center">
                Não foi possível carregar a visualização do documento.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleOpenInNewTab}>
                  <ExternalLink size={16} className="mr-2" />
                  Abrir em nova aba
                </Button>
                <Button onClick={handleDownload}>
                  <Download size={16} className="mr-2" />
                  Baixar
                </Button>
              </div>
            </div>
          ) : isPDF ? (
            <iframe
              src={`${documentUrl}#toolbar=1&navpanes=0`}
              className="w-full h-full border-0"
              title={documentName}
              onError={() => setLoadError(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <FileText size={64} className="text-muted-foreground" />
              <p className="text-muted-foreground text-center">
                Visualização não disponível para este tipo de arquivo.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleOpenInNewTab}>
                  <ExternalLink size={16} className="mr-2" />
                  Abrir em nova aba
                </Button>
                <Button onClick={handleDownload}>
                  <Download size={16} className="mr-2" />
                  Baixar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
