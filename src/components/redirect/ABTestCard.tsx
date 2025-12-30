import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  Split,
  MoreVertical,
  Copy,
  Pencil,
  Trash2,
  Eye,
  TrendingUp,
  Users,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ABTest } from '@/hooks/useABTests';

interface ABTestCardProps {
  abTest: ABTest;
  onEdit: (abTest: ABTest) => void;
  onDelete: (id: string) => Promise<void>;
  onToggleActive: (id: string, isActive: boolean) => Promise<void>;
}

export function ABTestCard({ abTest, onEdit, onDelete, onToggleActive }: ABTestCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const publicUrl = `${window.location.origin}/ab/${abTest.slug}`;

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success('Link copiado para a área de transferência!');
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(abTest.id);
      setShowDeleteDialog(false);
    } finally {
      setIsDeleting(false);
    }
  };

  // Calcular estatísticas
  const totalVariantViews = abTest.variants?.reduce((sum, v) => sum + (v.views_count || 0), 0) || 0;
  const totalVariantLeads = abTest.variants?.reduce((sum, v) => sum + (v.leads_count || 0), 0) || 0;
  const conversionRate = totalVariantViews > 0 
    ? ((totalVariantLeads / totalVariantViews) * 100).toFixed(1) 
    : '0.0';

  // Encontrar variante vencedora (maior taxa de conversão)
  const variantStats = abTest.variants?.map(v => {
    const rate = v.views_count > 0 ? (v.leads_count / v.views_count) * 100 : 0;
    return { ...v, conversionRate: rate };
  }) || [];
  
  const winningVariant = variantStats.length > 0 
    ? variantStats.reduce((prev, current) => 
        (current.conversionRate > prev.conversionRate) ? current : prev
      )
    : null;

  return (
    <>
      <Card className="relative overflow-hidden">
        {/* Badge de Teste A/B */}
        <div className="absolute top-3 left-3">
          <Badge variant="secondary" className="gap-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            <Split className="h-3 w-3" />
            Teste A/B
          </Badge>
        </div>

        <CardHeader className="pt-10 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">{abTest.name}</h3>
              <p className="text-sm text-muted-foreground">/ab/{abTest.slug}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={abTest.is_active}
                onCheckedChange={(checked) => onToggleActive(abTest.id, checked)}
              />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={copyLink}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar Link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.open(publicUrl, '_blank')}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir Link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onEdit(abTest)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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
          {/* Stats resumo */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-muted/50">
              <Eye className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-lg font-bold">{abTest.total_views || 0}</p>
              <p className="text-xs text-muted-foreground">Acessos</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/50">
              <Users className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-lg font-bold">{totalVariantLeads}</p>
              <p className="text-xs text-muted-foreground">Leads</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/50">
              <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-lg font-bold">{conversionRate}%</p>
              <p className="text-xs text-muted-foreground">Conversão</p>
            </div>
          </div>

          {/* Variantes */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Variantes:</p>
            {abTest.variants?.map((variant) => {
              const isWinner = winningVariant?.id === variant.id && totalVariantViews > 0;
              const variantConversion = variant.views_count > 0 
                ? ((variant.leads_count / variant.views_count) * 100).toFixed(1)
                : '0.0';
              
              return (
                <div 
                  key={variant.id}
                  className={`flex items-center justify-between p-2 rounded-lg border ${
                    isWinner ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className={`w-2 h-2 rounded-full ${
                        isWinner ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                    <span className="text-sm font-medium">
                      {variant.campaign?.name || 'Campanha removida'}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {variant.weight}%
                    </Badge>
                    {isWinner && (
                      <Badge className="text-xs bg-green-500">
                        Vencedor
                      </Badge>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <span>{variant.views_count || 0} views</span>
                    <span className="mx-1">•</span>
                    <span>{variantConversion}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tipo de distribuição */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>Distribuição: {abTest.distribution_type === 'equal' ? 'Igual' : 'Personalizada'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Teste A/B?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O teste "{abTest.name}" e todas as suas estatísticas serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
