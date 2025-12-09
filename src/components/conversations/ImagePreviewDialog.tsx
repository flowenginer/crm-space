import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ZoomIn, ZoomOut, RotateCcw, Download, Move } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  imageName?: string;
}

export function ImagePreviewDialog({ open, onOpenChange, imageUrl, imageName }: ImagePreviewDialogProps) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3;
  const ZOOM_STEP = 0.25;

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => {
      const newZoom = Math.max(prev - ZOOM_STEP, MIN_ZOOM);
      // Reset position if zooming back to 1 or less
      if (newZoom <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  }, []);

  const handleReset = useCallback(() => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  }, [handleZoomIn, handleZoomOut]);

  const handleDoubleClick = useCallback(() => {
    if (zoomLevel === 1) {
      setZoomLevel(2);
    } else {
      handleReset();
    }
  }, [zoomLevel, handleReset]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [zoomLevel, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, zoomLevel, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = imageName || `imagem-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      // Fallback: open in new tab
      window.open(imageUrl, '_blank');
    }
  }, [imageUrl, imageName]);

  // Reset zoom when dialog closes
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setZoomLevel(1);
      setPosition({ x: 0, y: 0 });
    }
    onOpenChange(open);
  }, [onOpenChange]);

  const zoomPercentage = Math.round(zoomLevel * 100);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none overflow-hidden">
        {/* Close button */}
        <button 
          onClick={() => handleOpenChange(false)}
          className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white z-20 transition-colors"
        >
          <X size={24} />
        </button>

        {/* Image container */}
        <div 
          ref={containerRef}
          className={cn(
            "relative flex items-center justify-center min-h-[60vh] overflow-hidden",
            zoomLevel > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
          )}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <img 
            src={imageUrl} 
            alt="Imagem expandida" 
            className="max-w-full max-h-[80vh] object-contain select-none transition-transform duration-200 ease-out"
            style={{
              transform: `scale(${zoomLevel}) translate(${position.x / zoomLevel}px, ${position.y / zoomLevel}px)`,
            }}
            draggable={false}
          />
        </div>

        {/* Controls bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent py-4 px-6">
          <div className="flex items-center justify-center gap-2">
            {/* Zoom controls */}
            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoomLevel <= MIN_ZOOM}
                className="h-8 w-8 p-0 text-white hover:bg-white/20 hover:text-white disabled:opacity-40"
                title="Diminuir zoom"
              >
                <ZoomOut size={18} />
              </Button>

              <div className="px-3 min-w-[60px] text-center">
                <span className="text-white text-sm font-medium">{zoomPercentage}%</span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoomLevel >= MAX_ZOOM}
                className="h-8 w-8 p-0 text-white hover:bg-white/20 hover:text-white disabled:opacity-40"
                title="Aumentar zoom"
              >
                <ZoomIn size={18} />
              </Button>
            </div>

            {/* Separator */}
            <div className="w-px h-6 bg-white/20" />

            {/* Reset button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={zoomLevel === 1 && position.x === 0 && position.y === 0}
              className="h-8 px-3 text-white hover:bg-white/20 hover:text-white disabled:opacity-40 gap-1.5"
              title="Resetar"
            >
              <RotateCcw size={16} />
              <span className="text-sm">Resetar</span>
            </Button>

            {/* Separator */}
            <div className="w-px h-6 bg-white/20" />

            {/* Download button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-8 px-3 text-white hover:bg-white/20 hover:text-white gap-1.5"
              title="Baixar imagem"
            >
              <Download size={16} />
              <span className="text-sm">Baixar</span>
            </Button>
          </div>

          {/* Hint text */}
          {zoomLevel > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-2 text-white/60 text-xs">
              <Move size={12} />
              <span>Arraste para mover a imagem</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
