import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Plus, ExternalLink, MousePointer, Users, Eye, TrendingUp, Split } from 'lucide-react';
import { RedirectCampaignCard } from '@/components/redirect/RedirectCampaignCard';
import { RedirectCampaignForm } from '@/components/redirect/RedirectCampaignForm';
import { ABTestCard } from '@/components/redirect/ABTestCard';
import { ABTestForm } from '@/components/redirect/ABTestForm';
import {
  useRedirectCampaigns,
  useCreateRedirectCampaign,
  useUpdateRedirectCampaign,
  useDeleteRedirectCampaign,
  useRedirectCampaignLogs,
  type RedirectCampaign,
} from '@/hooks/useRedirectCampaigns';
import {
  useABTests,
  useCreateABTest,
  useUpdateABTest,
  useDeleteABTest,
  type ABTest,
} from '@/hooks/useABTests';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export default function Redirect() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isABTestFormOpen, setIsABTestFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<RedirectCampaign | null>(null);
  const [editingABTest, setEditingABTest] = useState<ABTest | null>(null);
  const [viewingStatsCampaign, setViewingStatsCampaign] = useState<RedirectCampaign | null>(null);

  const { data: campaigns = [], isLoading } = useRedirectCampaigns();
  const { data: abTests = [] } = useABTests();
  const createCampaign = useCreateRedirectCampaign();
  const updateCampaign = useUpdateRedirectCampaign();
  const createABTest = useCreateABTest();
  const updateABTest = useUpdateABTest();
  const deleteABTest = useDeleteABTest();
  const deleteCampaign = useDeleteRedirectCampaign();
  const { data: logs = [] } = useRedirectCampaignLogs(viewingStatsCampaign?.id);

  const totalClicks = campaigns.reduce((sum, c) => sum + c.total_clicks, 0);
  const totalLeads = campaigns.reduce((sum, c) => sum + c.total_leads, 0);
  const totalViews = campaigns.reduce((sum, c) => sum + ((c as any).views_count || 0), 0);

  const handleCreateOrUpdate = async (data: any) => {
    if (editingCampaign) {
      await updateCampaign.mutateAsync({ id: editingCampaign.id, ...data });
    } else {
      await createCampaign.mutateAsync(data);
    }
    setIsFormOpen(false);
    setEditingCampaign(null);
  };

  const handleEdit = (campaign: RedirectCampaign) => {
    setEditingCampaign(campaign);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteCampaign.mutateAsync(id);
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await updateCampaign.mutateAsync({ id, is_active: isActive });
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingCampaign(null);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ExternalLink className="h-6 w-6" />
            Campanhas de Redirect
          </h1>
          <p className="text-muted-foreground">
            Crie landing pages para capturar leads e redirecionar para WhatsApp
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsABTestFormOpen(true)}>
            <Split className="mr-2 h-4 w-4" />
            Teste A/B
          </Button>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Campanha
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <ExternalLink className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Campanhas Ativas</p>
                <p className="text-2xl font-bold">{campaigns.filter(c => c.is_active).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
                <Eye className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Visitantes</p>
                <p className="text-2xl font-bold">{totalViews}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <MousePointer className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Cliques</p>
                <p className="text-2xl font-bold">{totalClicks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Leads Capturados</p>
                <p className="text-2xl font-bold">{totalLeads}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-20 bg-muted" />
              <CardContent className="h-32 bg-muted/50" />
            </Card>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="p-12 text-center">
          <ExternalLink className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma campanha criada</h3>
          <p className="text-muted-foreground mb-4">
            Crie sua primeira campanha de redirect para capturar leads via WhatsApp
          </p>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Criar Campanha
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Testes A/B primeiro */}
          {abTests.map((abTest) => (
            <ABTestCard
              key={abTest.id}
              abTest={abTest}
            onEdit={(ab) => { setEditingABTest(ab); setIsABTestFormOpen(true); }}
            onDelete={(id) => deleteABTest.mutateAsync(id).then(() => {})}
            onToggleActive={(id, isActive) => updateABTest.mutateAsync({ id, is_active: isActive }).then(() => {})}
            />
          ))}
          {/* Campanhas */}
          {campaigns.map((campaign) => (
            <RedirectCampaignCard
              key={campaign.id}
              campaign={campaign}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
              onViewStats={setViewingStatsCampaign}
            />
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCampaign ? 'Editar Campanha' : 'Nova Campanha de Redirect'}
            </DialogTitle>
          </DialogHeader>
          <RedirectCampaignForm
            campaign={editingCampaign}
            onSubmit={handleCreateOrUpdate}
            onCancel={handleCloseForm}
            isLoading={createCampaign.isPending || updateCampaign.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* A/B Test Form Dialog */}
      <Dialog open={isABTestFormOpen} onOpenChange={(open) => { setIsABTestFormOpen(open); if (!open) setEditingABTest(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingABTest ? 'Editar Teste A/B' : 'Novo Teste A/B'}
            </DialogTitle>
          </DialogHeader>
          <ABTestForm
            abTest={editingABTest}
            onSubmit={async (data) => {
              if (editingABTest) {
                await updateABTest.mutateAsync({ id: editingABTest.id, ...data });
              } else {
                await createABTest.mutateAsync(data);
              }
              setIsABTestFormOpen(false);
              setEditingABTest(null);
            }}
            onCancel={() => { setIsABTestFormOpen(false); setEditingABTest(null); }}
            isLoading={createABTest.isPending || updateABTest.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Stats Sheet */}
      <Sheet open={!!viewingStatsCampaign} onOpenChange={() => setViewingStatsCampaign(null)}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Estatísticas: {viewingStatsCampaign?.name}</SheetTitle>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Visitantes</p>
                  </div>
                  <p className="text-2xl font-bold">{(viewingStatsCampaign as any)?.views_count || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Leads</p>
                  </div>
                  <p className="text-2xl font-bold">{viewingStatsCampaign?.total_leads}</p>
                </CardContent>
              </Card>
            </div>
            
            {/* Conversion rate */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                  </div>
                  <p className="text-xl font-bold text-green-600">
                    {((viewingStatsCampaign as any)?.views_count || 0) > 0 
                      ? ((viewingStatsCampaign?.total_leads || 0) / ((viewingStatsCampaign as any)?.views_count || 1) * 100).toFixed(1)
                      : 0}%
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Leads / Visitantes
                </p>
              </CardContent>
            </Card>

            {/* Recent logs */}
            <div>
              <h4 className="font-medium mb-3">Últimos leads</h4>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {logs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum lead capturado ainda
                    </p>
                  ) : (
                    logs.map((log: any) => (
                      <Card key={log.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{log.contact?.full_name || log.phone}</p>
                            <p className="text-sm text-muted-foreground">{log.phone}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(log.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </p>
                            {log.utm_source && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {log.utm_source}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {log.channel && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Direcionado para: {log.channel.name}
                          </p>
                        )}
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
