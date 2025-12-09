import { ExternalLink, Play, Trophy, Image as ImageIcon, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CreativeCardProps {
  sourceId: string;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  headline: string | null;
  mediaType: number | null;
  campaignName?: string | null;
  adName?: string | null;
  total: number;
  conversions: number;
  conversionRate: number;
  isChampion?: boolean;
  compact?: boolean;
}

export function CreativeCard({
  sourceId,
  sourceUrl,
  thumbnailUrl,
  imageUrl,
  headline,
  mediaType,
  campaignName,
  adName,
  total,
  conversions,
  conversionRate,
  isChampion = false,
  compact = false,
}: CreativeCardProps) {
  const previewUrl = thumbnailUrl || imageUrl;
  const isVideo = mediaType === 2;
  const displayName = campaignName || headline || adName || 'Sem nome';

  const openCreative = () => {
    if (sourceUrl) {
      window.open(sourceUrl, '_blank');
    }
  };

  if (compact) {
    return (
      <div 
        className="bg-card rounded-xl border border-border/50 overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group"
        onClick={openCreative}
      >
        {/* Thumbnail */}
        <div className="relative aspect-square bg-muted">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={headline || 'Creative'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isVideo ? (
                <Video className="h-12 w-12 text-muted-foreground" />
              ) : (
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
          )}
          {/* Play overlay for videos */}
          {isVideo && previewUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                <Play className="h-6 w-6 text-gray-900 ml-1" fill="currentColor" />
              </div>
            </div>
          )}
          {/* Conversion badge */}
          {conversions > 0 && (
            <Badge className="absolute top-2 right-2 bg-green-500/90 text-white border-0">
              {conversionRate.toFixed(1)}%
            </Badge>
          )}
        </div>
        {/* Info */}
        <div className="p-3 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">{total} leads</span>
            <span className="text-green-600 font-medium">{conversions} conv.</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{displayName}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        {isChampion && (
          <>
            <Trophy className="h-5 w-5 text-yellow-500" />
            <h3 className="text-lg font-semibold text-foreground">Criativo Campeão</h3>
          </>
        )}
      </div>

      <div className="flex gap-6">
        {/* Preview */}
        <div className="relative w-48 h-48 rounded-xl overflow-hidden bg-muted flex-shrink-0 group">
          {previewUrl ? (
            <>
              <img
                src={previewUrl}
                alt={headline || 'Creative'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform" onClick={openCreative}>
                    <Play className="h-7 w-7 text-gray-900 ml-1" fill="currentColor" />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isVideo ? (
                <Video className="h-16 w-16 text-muted-foreground" />
              ) : (
                <ImageIcon className="h-16 w-16 text-muted-foreground" />
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 space-y-4">
          <div>
            <p className="text-base font-medium text-foreground line-clamp-2">
              {displayName}
            </p>
            {adName && campaignName && (
              <p className="text-sm text-muted-foreground mt-1">{adName}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-xl bg-muted/50">
              <p className="text-2xl font-bold text-foreground">{total}</p>
              <p className="text-xs text-muted-foreground">Total Leads</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-green-500/10">
              <p className="text-2xl font-bold text-green-600">{conversions}</p>
              <p className="text-xs text-muted-foreground">Conversões</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-primary/10">
              <p className="text-2xl font-bold text-primary">{conversionRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Taxa</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>ID: {sourceId.slice(0, 15)}...</span>
          </div>

          {sourceUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={openCreative}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir no Instagram
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
