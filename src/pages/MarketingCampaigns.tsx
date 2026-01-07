import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Clock,
  MessageSquare,
  Megaphone,
  Loader2,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  useMarketingCampaigns,
  useDeleteMarketingCampaign,
  useDuplicateMarketingCampaign,
} from '@/hooks/useMarketingCampaigns';
import { MarketingCampaignModal } from '@/components/marketing/MarketingCampaignModal';
import type { MarketingCampaign } from '@/types/marketing';

export default function MarketingCampaigns() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<MarketingCampaign | null>(null);
  const [deleteCampaignId, setDeleteCampaignId] = useState<string | null>(null);

  const { data: campaigns = [], isLoading } = useMarketingCampaigns();
  const deleteCampaign = useDeleteMarketingCampaign();
  const duplicateCampaign = useDuplicateMarketingCampaign();

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(
      (c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    );
  }, [campaigns, searchQuery]);

  const handleEdit = (campaign: MarketingCampaign) => {
    setEditingCampaign(campaign);
    setShowModal(true);
  };

  const handleNewCampaign = () => {
    setEditingCampaign(null);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteCampaignId) return;
    try {
      await deleteCampaign.mutateAsync(deleteCampaignId);
      toast.success('Campanha excluída!');
      setDeleteCampaignId(null);
    } catch (error) {
      toast.error('Erro ao excluir campanha');
    }
  };

  const handleDuplicate = async (campaignId: string) => {
    try {
      const newCampaign = await duplicateCampaign.mutateAsync(campaignId);
      toast.success(`Campanha "${newCampaign.title}" criada com sucesso!`);
    } catch (error) {
      toast.error('Erro ao duplicar campanha');
    }
  };

  const formatTimer = (minutes: number): string => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins}min`;
  };

  return (
    <div className="flex h-[calc(100vh-72px)]">
      {/* Main Content */}
      <div className="flex-1 bg-background flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Megaphone size={24} className="text-primary" />
            <h1 className="text-xl font-bold text-foreground">
              Campanhas de Marketing
            </h1>
            <Badge variant="secondary" className="font-medium">
              {filteredCampaigns.length}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>

            <Button onClick={handleNewCampaign} size="sm">
              <Plus size={16} className="mr-1" />
              NOVA CAMPANHA
            </Button>
          </div>
        </div>

        {/* Table */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-8" />
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-20" />
                    </div>
                  ))}
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="p-8 text-center">
                  <Megaphone size={48} className="mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma campanha criada</h3>
                  <p className="text-muted-foreground mb-4">
                    Crie campanhas com sequências de mensagens e ações automatizadas.
                  </p>
                  <Button onClick={handleNewCampaign}>
                    <Plus size={16} className="mr-1" />
                    Criar Campanha
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead className="w-48">Título</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-24 text-center">Mensagens</TableHead>
                      <TableHead className="w-32 text-center">Timers</TableHead>
                      <TableHead className="w-24 text-center">Status</TableHead>
                      <TableHead className="w-32 text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCampaigns.map((campaign, index) => (
                      <TableRow key={campaign.id} className="group">
                        <TableCell className="text-center text-muted-foreground font-mono text-sm">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-foreground">
                            {campaign.title}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground text-sm">
                            {campaign.description ? campaign.description.substring(0, 60) + (campaign.description.length > 60 ? '...' : '') : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <MessageSquare size={14} className="text-muted-foreground" />
                            <span className="text-sm">{campaign.steps?.length || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Clock size={14} className="text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {campaign.steps?.map(s => formatTimer(s.timer_minutes || 0)).join(' → ') || '—'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={campaign.is_active ? "default" : "secondary"} className="text-xs">
                            {campaign.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(campaign)}
                              title="Editar"
                            >
                              <Edit3 size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDuplicate(campaign.id)}
                              disabled={duplicateCampaign.isPending}
                              title="Duplicar"
                            >
                              <Copy size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteCampaignId(campaign.id)}
                              disabled={deleteCampaign.isPending}
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Campaign Modal */}
      <MarketingCampaignModal
        open={showModal}
        onOpenChange={setShowModal}
        campaign={editingCampaign}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteCampaignId} onOpenChange={() => setDeleteCampaignId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A campanha será desativada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCampaign.isPending}
            >
              {deleteCampaign.isPending && <Loader2 size={14} className="mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
