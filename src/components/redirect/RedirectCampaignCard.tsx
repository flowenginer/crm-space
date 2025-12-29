import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Copy, 
  ExternalLink, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  BarChart3,
  Users,
  MousePointer,
  Phone
} from 'lucide-react';
import { toast } from 'sonner';
import type { RedirectCampaign } from '@/hooks/useRedirectCampaigns';

interface RedirectCampaignCardProps {
  campaign: RedirectCampaign;
  onEdit: (campaign: RedirectCampaign) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onViewStats: (campaign: RedirectCampaign) => void;
}

export function RedirectCampaignCard({
  campaign,
  onEdit,
  onDelete,
  onToggleActive,
  onViewStats,
}: RedirectCampaignCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const publicUrl = `${window.location.origin}/r/${campaign.slug}`;

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success('Link copiado!');
  };

  const openLink = () => {
    window.open(publicUrl, '_blank');
  };

  const activeChannels = campaign.channels?.filter(c => c.is_active && c.channel?.status === 'connected') || [];

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg truncate">{campaign.name}</h3>
                <Badge variant={campaign.is_active ? 'default' : 'secondary'}>
                  {campaign.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 truncate">
                /r/{campaign.slug}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={campaign.is_active}
                onCheckedChange={(checked) => onToggleActive(campaign.id, checked)}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(campaign)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onViewStats(campaign)}>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Estatísticas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={copyLink}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar Link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openLink}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir Landing
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Estatísticas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <MousePointer className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Cliques</p>
                <p className="font-semibold">{campaign.total_clicks}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Leads</p>
                <p className="font-semibold">{campaign.total_leads}</p>
              </div>
            </div>
          </div>

          {/* Canais */}
          <div>
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              Canais ({activeChannels.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activeChannels.slice(0, 3).map((channelLink) => (
                <Badge key={channelLink.id} variant="outline" className="text-xs">
                  {channelLink.channel?.name || 'Canal'}
                </Badge>
              ))}
              {activeChannels.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{activeChannels.length - 3}
                </Badge>
              )}
              {activeChannels.length === 0 && (
                <span className="text-xs text-muted-foreground">Nenhum canal ativo</span>
              )}
            </div>
          </div>

          {/* Link rápido */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={copyLink}
            >
              <Copy className="mr-2 h-3.5 w-3.5" />
              Copiar Link
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={openLink}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A campanha "{campaign.name}" e todos os logs associados serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(campaign.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
