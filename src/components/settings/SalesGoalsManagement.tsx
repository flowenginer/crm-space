import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Target,
  Save,
  DollarSign,
  Award,
  Users,
  Loader2,
} from 'lucide-react';

interface SellerGoals {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  sales_target_1: number | null;
  sales_target_2: number | null;
  sales_target_3: number | null;
  bonus_target_1: number | null;
  bonus_target_2: number | null;
  bonus_target_3: number | null;
  commission_percent: number | null;
}

export function SalesGoalsManagement() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<SellerGoals>>({});

  const { data: sellers, isLoading } = useQuery({
    queryKey: ['sellers-goals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, sales_target_1, sales_target_2, sales_target_3, bonus_target_1, bonus_target_2, bonus_target_3, commission_percent')
        .in('role', ['vendedor', 'admin', 'supervisor'])
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      return data as SellerGoals[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<SellerGoals> }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          sales_target_1: data.updates.sales_target_1 || 0,
          sales_target_2: data.updates.sales_target_2 || 0,
          sales_target_3: data.updates.sales_target_3 || 0,
          bonus_target_1: data.updates.bonus_target_1 || 0,
          bonus_target_2: data.updates.bonus_target_2 || 0,
          bonus_target_3: data.updates.bonus_target_3 || 0,
          commission_percent: data.updates.commission_percent || 0,
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellers-goals'] });
      queryClient.invalidateQueries({ queryKey: ['seller-goal-progress'] });
      toast.success('Metas atualizadas com sucesso!');
      setEditingId(null);
      setFormData({});
    },
    onError: (error) => {
      toast.error('Erro ao atualizar metas: ' + error.message);
    },
  });

  const handleEdit = (seller: SellerGoals) => {
    setEditingId(seller.id);
    setFormData({
      sales_target_1: seller.sales_target_1 || 0,
      sales_target_2: seller.sales_target_2 || 0,
      sales_target_3: seller.sales_target_3 || 0,
      bonus_target_1: seller.bonus_target_1 || 0,
      bonus_target_2: seller.bonus_target_2 || 0,
      bonus_target_3: seller.bonus_target_3 || 0,
      commission_percent: seller.commission_percent || 0,
    });
  };

  const handleSave = (sellerId: string) => {
    updateMutation.mutate({ id: sellerId, updates: formData });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({});
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return 'Não definida';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5" />
            Metas de Vendas
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure as metas e bônus de cada vendedor
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {sellers?.map((seller) => (
          <Card key={seller.id} className={editingId === seller.id ? 'ring-2 ring-primary' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={seller.avatar_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                      {seller.full_name?.charAt(0) || 'V'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">{seller.full_name}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{seller.role}</Badge>
                      {seller.commission_percent && (
                        <span className="text-xs">Comissão: {seller.commission_percent}%</span>
                      )}
                    </CardDescription>
                  </div>
                </div>
                {editingId === seller.id ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleCancel}>
                      Cancelar
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => handleSave(seller.id)}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Salvar
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => handleEdit(seller)}>
                    Editar Metas
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingId === seller.id ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Commission */}
                  <div className="space-y-2">
                    <Label className="text-xs">Comissão (%)</Label>
                    <Input
                      type="number"
                      placeholder="5"
                      value={formData.commission_percent || ''}
                      onChange={(e) => setFormData({ ...formData, commission_percent: Number(e.target.value) })}
                    />
                  </div>

                  {/* Meta 1 */}
                  <div className="space-y-2">
                    <Label className="text-xs text-blue-500">Meta 1 (R$)</Label>
                    <Input
                      type="number"
                      placeholder="20000"
                      value={formData.sales_target_1 || ''}
                      onChange={(e) => setFormData({ ...formData, sales_target_1: Number(e.target.value) })}
                    />
                    <Input
                      type="number"
                      placeholder="Bônus Meta 1"
                      value={formData.bonus_target_1 || ''}
                      onChange={(e) => setFormData({ ...formData, bonus_target_1: Number(e.target.value) })}
                      className="text-xs"
                    />
                  </div>

                  {/* Meta 2 */}
                  <div className="space-y-2">
                    <Label className="text-xs text-purple-500">Meta 2 (R$)</Label>
                    <Input
                      type="number"
                      placeholder="35000"
                      value={formData.sales_target_2 || ''}
                      onChange={(e) => setFormData({ ...formData, sales_target_2: Number(e.target.value) })}
                    />
                    <Input
                      type="number"
                      placeholder="Bônus Meta 2"
                      value={formData.bonus_target_2 || ''}
                      onChange={(e) => setFormData({ ...formData, bonus_target_2: Number(e.target.value) })}
                      className="text-xs"
                    />
                  </div>

                  {/* Meta 3 */}
                  <div className="space-y-2">
                    <Label className="text-xs text-amber-500">Meta 3 (R$)</Label>
                    <Input
                      type="number"
                      placeholder="50000"
                      value={formData.sales_target_3 || ''}
                      onChange={(e) => setFormData({ ...formData, sales_target_3: Number(e.target.value) })}
                    />
                    <Input
                      type="number"
                      placeholder="Bônus Meta 3"
                      value={formData.bonus_target_3 || ''}
                      onChange={(e) => setFormData({ ...formData, bonus_target_3: Number(e.target.value) })}
                      className="text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <DollarSign className="h-3 w-3" />
                      Comissão
                    </div>
                    <p className="font-medium">{seller.commission_percent || 0}%</p>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <div className="flex items-center gap-2 text-xs text-blue-500 mb-1">
                      <Target className="h-3 w-3" />
                      Meta 1
                    </div>
                    <p className="font-medium text-sm">{formatCurrency(seller.sales_target_1)}</p>
                    {seller.bonus_target_1 ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Award className="h-3 w-3" />
                        Bônus: {formatCurrency(seller.bonus_target_1)}
                      </p>
                    ) : null}
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <div className="flex items-center gap-2 text-xs text-purple-500 mb-1">
                      <Target className="h-3 w-3" />
                      Meta 2
                    </div>
                    <p className="font-medium text-sm">{formatCurrency(seller.sales_target_2)}</p>
                    {seller.bonus_target_2 ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Award className="h-3 w-3" />
                        Bônus: {formatCurrency(seller.bonus_target_2)}
                      </p>
                    ) : null}
                  </div>
                  <div className="p-3 bg-amber-500/10 rounded-lg">
                    <div className="flex items-center gap-2 text-xs text-amber-500 mb-1">
                      <Target className="h-3 w-3" />
                      Meta 3
                    </div>
                    <p className="font-medium text-sm">{formatCurrency(seller.sales_target_3)}</p>
                    {seller.bonus_target_3 ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Award className="h-3 w-3" />
                        Bônus: {formatCurrency(seller.bonus_target_3)}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {sellers?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum vendedor encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
