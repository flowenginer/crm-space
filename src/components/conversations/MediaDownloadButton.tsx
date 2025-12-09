import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaDownloadButtonProps {
  url: string;
  fileName: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const MediaDownloadButton = ({ 
  url, 
  fileName, 
  className,
  size = 'sm'
}: MediaDownloadButtonProps) => {
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      window.open(url, '_blank');
    }
  };

  const sizeClasses = size === 'sm' ? 'p-1.5' : 'p-2';
  const iconSize = size === 'sm' ? 14 : 18;

  return (
    <button
      onClick={handleDownload}
      className={cn(
        'bg-black/60 hover:bg-black/80 rounded-full transition-all',
        'flex items-center justify-center',
        sizeClasses,
        className
      )}
      title="Baixar"
    >
      <Download size={iconSize} className="text-white" />
    </button>
  );
};
