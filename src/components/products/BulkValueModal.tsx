import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useCreateBulkAttributeValues, generateSlug } from '@/hooks/useProductAttributes';
import { toast } from 'sonner';

interface BulkValueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attributeTypeId: string;
}

export function BulkValueModal({ open, onOpenChange, attributeTypeId }: BulkValueModalProps) {
  const [text, setText] = useState('');
  const createMutation = useCreateBulkAttributeValues();

  const values = useMemo(() => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((value) => ({
        value,
        slug: generateSlug(value),
      }));
  }, [text]);

  const handleSubmit = async () => {
    if (values.length === 0) {
      toast.error('Insira pelo menos um valor');
      return;
    }

    try {
      await createMutation.mutateAsync({
        attribute_type_id: attributeTypeId,
        values,
      });
      toast.success(`${values.length} ${values.length === 1 ? 'valor criado' : 'valores criados'} com sucesso`);
      setText('');
      onOpenChange(false);
    } catch (error: any) {
      if (error?.message?.includes('duplicate key')) {
        toast.error('Um ou mais valores já existem neste atributo');
      } else {
        toast.error('Erro ao criar valores');
      }
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setText('');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Múltiplos Valores</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="bulk-values">Valores (um por linha)</Label>
            <Textarea
              id="bulk-values"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="PP&#10;P&#10;M&#10;G&#10;GG"
              rows={8}
              className="mt-2 font-mono"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Digite um valor por linha. Slugs serão gerados automaticamente.
            </p>
          </div>

          {values.length > 0 && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Preview</span>
                <Badge variant="secondary">
                  {values.length} {values.length === 1 ? 'valor' : 'valores'}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {values.slice(0, 20).map((v, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {v.value}
                  </Badge>
                ))}
                {values.length > 20 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    +{values.length - 20} mais
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || values.length === 0}
          >
            {createMutation.isPending ? 'Criando...' : `Criar ${values.length > 0 ? values.length : ''} ${values.length === 1 ? 'Valor' : 'Valores'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
