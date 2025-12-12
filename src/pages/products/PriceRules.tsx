import { useState } from 'react';
import { Plus, DollarSign, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { PriceRuleModal } from '@/components/products/PriceRuleModal';
import {
  usePriceRules,
  useDeletePriceRule,
  useTogglePriceRuleStatus,
  type PriceRuleWithDetails,
} from '@/hooks/useAttributePriceRules';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function PriceRules() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PriceRuleWithDetails | null>(null);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);

  const { data: rules = [], isLoading } = usePriceRules();
  const deleteMutation = useDeletePriceRule();
  const toggleMutation = useTogglePriceRuleStatus();

  const handleEdit = (rule: PriceRuleWithDetails) => {
    setEditingRule(rule);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
  };

  const handleDelete = async () => {
    if (!deleteRuleId) return;
    try {
      await deleteMutation.mutateAsync(deleteRuleId);
      toast.success('Regra excluída com sucesso');
      setDeleteRuleId(null);
    } catch (error) {
      toast.error('Erro ao excluir regra');
    }
  };

  const handleToggleStatus = async (rule: PriceRuleWithDetails) => {
    try {
      await toggleMutation.mutateAsync({ id: rule.id, is_active: !rule.is_active });
      toast.success(rule.is_active ? 'Regra desativada' : 'Regra ativada');
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  };

  const formatAdjustment = (rule: PriceRuleWithDetails) => {
    const sign = rule.adjustment_value >= 0 ? '+' : '';
    if (rule.adjustment_type === 'fixed') {
      return `${sign}R$ ${rule.adjustment_value.toFixed(2).replace('.', ',')}`;
    }
    return `${sign}${rule.adjustment_value}%`;
  };

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Regras de Preço por Atributo</h1>
              <p className="text-sm text-muted-foreground">
                Configure acréscimos ou descontos automáticos
              </p>
            </div>
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Regra
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 py-16">
          <DollarSign className="h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium text-foreground">Nenhuma regra cadastrada</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie sua primeira regra de preço para ajustar valores por atributo
          </p>
          <Button onClick={() => setIsModalOpen(true)} className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Nova Regra
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Atributo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ajuste</TableHead>
                <TableHead>Aplicar em</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">
                    {rule.attribute_value?.attribute_type?.name || '-'}
                  </TableCell>
                  <TableCell>
                    {rule.attribute_value?.display_value || rule.attribute_value?.value || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {rule.adjustment_type === 'fixed' ? 'Fixo' : 'Percentual'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      'font-medium',
                      rule.adjustment_value >= 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      {formatAdjustment(rule)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {rule.product_id ? 'Produto específico' : 'Todos produtos'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleToggleStatus(rule)}
                      className="flex items-center gap-1.5"
                    >
                      {rule.is_active ? (
                        <>
                          <ToggleRight className="h-5 w-5 text-green-500" />
                          <span className="text-sm text-green-600">Ativo</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Inativo</span>
                        </>
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(rule)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteRuleId(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal */}
      <PriceRuleModal
        open={isModalOpen}
        onOpenChange={handleCloseModal}
        editingRule={editingRule}
      />

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteRuleId} onOpenChange={() => setDeleteRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir regra</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta regra de preço?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
