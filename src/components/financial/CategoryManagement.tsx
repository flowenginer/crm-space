import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useFinancialCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, FinancialCategory } from '@/hooks/useFinancial';

export function CategoryManagement() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [color, setColor] = useState('#8B5CF6');

  const { data: categories = [], isLoading } = useFinancialCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  const handleSubmit = async () => {
    if (!name) return;

    if (editingCategory) {
      await updateCategory.mutateAsync({
        id: editingCategory.id,
        name,
        color,
      });
    } else {
      await createCategory.mutateAsync({ name, type, color });
    }

    closeModal();
  };

  const openEdit = (category: FinancialCategory) => {
    setEditingCategory(category);
    setName(category.name);
    setType(category.type);
    setColor(category.color || '#8B5CF6');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta categoria?')) {
      await deleteCategory.mutateAsync(id);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setName('');
    setType('expense');
    setColor('#8B5CF6');
  };

  const CategoryCard = ({ category }: { category: FinancialCategory }) => (
    <div
      className="flex items-center justify-between p-3 rounded-lg border"
      style={{ borderLeftColor: category.color || '#8B5CF6', borderLeftWidth: '4px' }}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">{category.name}</span>
        <Badge variant={category.type === 'income' ? 'default' : 'secondary'}>
          {category.type === 'income' ? 'Receita' : 'Despesa'}
        </Badge>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={() => openEdit(category)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => handleDelete(category.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Categorias Financeiras</h3>
            <p className="text-sm text-muted-foreground">
              Gerencie suas categorias de receitas e despesas
            </p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Categoria
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-emerald-600 text-base">Receitas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {incomeCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma categoria de receita</p>
                ) : (
                  incomeCategories.map(cat => <CategoryCard key={cat.id} category={cat} />)
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-rose-600 text-base">Despesas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {expenseCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma categoria de despesa</p>
                ) : (
                  expenseCategories.map(cat => <CategoryCard key={cat.id} category={cat} />)
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Vendas de Produtos"
              />
            </div>

            {!editingCategory && (
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v as 'income' | 'expense')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#8B5CF6"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createCategory.isPending || updateCategory.isPending || !name}
            >
              {createCategory.isPending || updateCategory.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
