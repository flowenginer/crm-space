import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Eye, Globe, Smartphone, Monitor } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRedirectCampaignViews } from '@/hooks/useRedirectCampaigns';

interface VisitorsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId?: string;
  campaignName?: string;
}

// Cores para diferentes UTM sources
const getSourceColor = (source: string | null) => {
  if (!source) return 'bg-gray-100 text-gray-700';
  const s = source.toLowerCase();
  if (s.includes('google')) return 'bg-blue-100 text-blue-700';
  if (s.includes('facebook') || s.includes('fb')) return 'bg-indigo-100 text-indigo-700';
  if (s.includes('instagram') || s.includes('ig')) return 'bg-pink-100 text-pink-700';
  if (s.includes('tiktok')) return 'bg-gray-900 text-white';
  if (s.includes('youtube') || s.includes('yt')) return 'bg-red-100 text-red-700';
  if (s.includes('whatsapp') || s.includes('wpp')) return 'bg-green-100 text-green-700';
  if (s.includes('email')) return 'bg-yellow-100 text-yellow-700';
  if (s.includes('linkedin')) return 'bg-blue-200 text-blue-800';
  return 'bg-purple-100 text-purple-700';
};

// Detectar tipo de dispositivo pelo user agent
const getDeviceInfo = (userAgent: string | null) => {
  if (!userAgent) return { icon: Globe, label: 'Desconhecido' };
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return { icon: Smartphone, label: 'Mobile' };
  }
  return { icon: Monitor, label: 'Desktop' };
};

export function VisitorsDialog({ open, onOpenChange, campaignId, campaignName }: VisitorsDialogProps) {
  const { data: views = [], isLoading } = useRedirectCampaignViews(campaignId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Visitantes {campaignName ? `- ${campaignName}` : ''}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-3 animate-pulse bg-muted h-16" />
              ))}
            </div>
          ) : views.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Eye className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Nenhum visitante registrado ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {views.map((view: any) => {
                const device = getDeviceInfo(view.user_agent);
                const DeviceIcon = device.icon;
                
                return (
                  <Card key={view.id} className="p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-1">
                        {/* Data e Dispositivo */}
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">
                            {format(new Date(view.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                          </span>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <DeviceIcon className="h-3 w-3" />
                            {device.label}
                          </span>
                        </div>

                        {/* UTM Badges */}
                        <div className="flex flex-wrap gap-1">
                          {view.utm_source ? (
                            <Badge variant="secondary" className={getSourceColor(view.utm_source)}>
                              {view.utm_source}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Acesso direto
                            </Badge>
                          )}
                          {view.utm_medium && (
                            <Badge variant="outline" className="text-xs">
                              {view.utm_medium}
                            </Badge>
                          )}
                          {view.utm_campaign && (
                            <Badge variant="outline" className="text-xs">
                              {view.utm_campaign}
                            </Badge>
                          )}
                        </div>

                        {/* Referrer */}
                        {view.referrer && (
                          <p className="text-xs text-muted-foreground truncate">
                            Referrer: {view.referrer}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Mostrando os últimos {views.length} visitantes únicos
        </div>
      </DialogContent>
    </Dialog>
  );
}
