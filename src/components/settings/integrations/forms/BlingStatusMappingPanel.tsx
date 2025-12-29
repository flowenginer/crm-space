import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useBlingStatusMappings,
  useBlingStatusMappingsMutation,
  useInitializeBlingStatusMappings,
  BlingStatusMapping,
} from '@/hooks/useBlingIntegration';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// Available local order statuses
const LOCAL_ORDER_STATUSES = [
  { value: 'pending', label: 'Pendente', color: '#f59e0b' },
  { value: 'approved', label: 'Aprovado', color: '#22c55e' },
  { value: 'in_production', label: 'Em Produção', color: '#3b82f6' },
  { value: 'ready_to_ship', label: 'Pronto para Envio', color: '#06b6d4' },
  { value: 'shipped', label: 'Enviado', color: '#14b8a6' },
  { value: 'delivered', label: 'Entregue', color: '#22c55e' },
  { value: 'completed', label: 'Concluído', color: '#10b981' },
  { value: 'cancelled', label: 'Cancelado', color: '#ef4444' },
  { value: 'returned', label: 'Devolvido', color: '#f97316' },
  { value: 'verified', label: 'Verificado', color: '#a855f7' },
];

const LOCAL_QUOTE_STATUSES = [
  { value: 'pending', label: 'Pendente', color: '#f59e0b' },
  { value: 'approved', label: 'Aprovado', color: '#22c55e' },
  { value: 'rejected', label: 'Recusado', color: '#ef4444' },
  { value: 'expired', label: 'Expirado', color: '#6b7280' },
];

interface StatusMappingItemProps {
  mapping: BlingStatusMapping;
  localStatuses: typeof LOCAL_ORDER_STATUSES;
  onChange: (updates: Partial<BlingStatusMapping>) => void;
}

function StatusMappingItem({ mapping, localStatuses, onChange }: StatusMappingItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <div 
        className="w-3 h-3 rounded-full flex-shrink-0" 
        style={{ backgroundColor: mapping.color || '#6b7280' }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{mapping.bling_status_name}</span>
          <Badge variant="outline" className="text-xs">ID: {mapping.bling_status_id}</Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={mapping.local_status}
          onValueChange={(value) => onChange({ local_status: value })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {localStatuses.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: status.color }}
                  />
                  {status.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Switch
          checked={mapping.is_active}
          onCheckedChange={(checked) => onChange({ is_active: checked })}
        />
      </div>
    </div>
  );
}

export function BlingStatusMappingPanel() {
  const { data: mappings, isLoading } = useBlingStatusMappings();
  const saveMappings = useBlingStatusMappingsMutation();
  const initializeMappings = useInitializeBlingStatusMappings();
  
  const [localMappings, setLocalMappings] = useState<BlingStatusMapping[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (mappings) {
      setLocalMappings(mappings);
    }
  }, [mappings]);

  const orderMappings = localMappings.filter(m => m.entity_type === 'order');
  const quoteMappings = localMappings.filter(m => m.entity_type === 'quote');

  const handleMappingChange = (id: string, updates: Partial<BlingStatusMapping>) => {
    setLocalMappings(prev => 
      prev.map(m => m.id === id ? { ...m, ...updates } : m)
    );
  };

  const handleSave = async () => {
    const changedMappings = localMappings.map(m => ({
      entity_type: m.entity_type as 'order' | 'quote',
      bling_status_id: m.bling_status_id,
      bling_status_name: m.bling_status_name,
      local_status: m.local_status,
      color: m.color,
      is_active: m.is_active,
    }));

    await saveMappings.mutateAsync(changedMappings);
  };

  const handleInitialize = async () => {
    await initializeMappings.mutateAsync();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Mapeamento de Status
          </div>
          <Badge variant="secondary">{localMappings.length} mapeamentos</Badge>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 space-y-4">
        {localMappings.length === 0 ? (
          <div className="text-center py-6 bg-muted/50 rounded-lg">
            <p className="text-muted-foreground mb-4">
              Nenhum mapeamento de status configurado
            </p>
            <Button 
              onClick={handleInitialize}
              disabled={initializeMappings.isPending}
            >
              {initializeMappings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Plus className="mr-2 h-4 w-4" />
              Criar Mapeamentos Padrão
            </Button>
          </div>
        ) : (
          <>
            {/* Order Status Mappings */}
            {orderMappings.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Status de Pedidos</Label>
                <div className="space-y-2">
                  {orderMappings.map((mapping) => (
                    <StatusMappingItem
                      key={mapping.id}
                      mapping={mapping}
                      localStatuses={LOCAL_ORDER_STATUSES}
                      onChange={(updates) => handleMappingChange(mapping.id, updates)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quote Status Mappings */}
            {quoteMappings.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Status de Orçamentos</Label>
                <div className="space-y-2">
                  {quoteMappings.map((mapping) => (
                    <StatusMappingItem
                      key={mapping.id}
                      mapping={mapping}
                      localStatuses={LOCAL_QUOTE_STATUSES}
                      onChange={(updates) => handleMappingChange(mapping.id, updates)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={handleSave} 
                disabled={saveMappings.isPending}
                className="flex-1"
              >
                {saveMappings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Mapeamentos
              </Button>
              <Button 
                variant="outline"
                onClick={handleInitialize}
                disabled={initializeMappings.isPending}
              >
                {initializeMappings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Restaurar Padrão
              </Button>
            </div>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
