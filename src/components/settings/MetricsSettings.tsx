import { useState, useEffect } from 'react';
import { Check, Target, Loader2, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useLeadStatuses, LeadStatus } from '@/hooks/useLeadStatuses';
import { useCompanySettings, useUpdateCompanySettings } from '@/hooks/useCompanySettings';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function MetricsSettings() {
  const { data: leadStatuses = [], isLoading: loadingStatuses } = useLeadStatuses();
  const { data: settings, isLoading: loadingSettings } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();

  const [selectedStatusIds, setSelectedStatusIds] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize selected statuses from settings
  useEffect(() => {
    if (settings?.conversion_status_ids) {
      setSelectedStatusIds(settings.conversion_status_ids);
      setHasChanges(false);
    }
  }, [settings]);

  const handleToggleStatus = (statusId: string) => {
    setSelectedStatusIds(prev => {
      const newSelection = prev.includes(statusId)
        ? prev.filter(id => id !== statusId)
        : [...prev, statusId];
      
      // Check if there are changes
      const original = settings?.conversion_status_ids || [];
      const hasChanged = 
        newSelection.length !== original.length ||
        newSelection.some(id => !original.includes(id));
      setHasChanges(hasChanged);
      
      return newSelection;
    });
  };

  const handleSave = async () => {
    if (selectedStatusIds.length === 0) {
      toast.error('Selecione pelo menos um status de conversão');
      return;
    }

    try {
      await updateSettings.mutateAsync({
        conversion_status_ids: selectedStatusIds,
      });
      toast.success('Métrica de conversão atualizada com sucesso!');
      setHasChanges(false);
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    }
  };

  const isLoading = loadingStatuses || loadingSettings;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Sort statuses to show selected ones first
  const sortedStatuses = [...leadStatuses].sort((a, b) => {
    const aSelected = selectedStatusIds.includes(a.id);
    const bSelected = selectedStatusIds.includes(b.id);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return a.order_position - b.order_position;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Métrica de Conversão
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Defina quais status de lead são considerados como conversão no dashboard
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-5 w-5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>
                Leads que passarem por qualquer um dos status selecionados serão 
                contabilizados como "conversão" nas métricas do dashboard.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Selected Status Summary */}
      <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            Status de Conversão Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {selectedStatusIds.length === 0 ? (
              <span className="text-sm text-muted-foreground italic">
                Nenhum status selecionado
              </span>
            ) : (
              selectedStatusIds.map(statusId => {
                const status = leadStatuses.find(s => s.id === statusId);
                if (!status) return null;
                return (
                  <Badge 
                    key={statusId}
                    variant="secondary"
                    className="px-3 py-1"
                    style={{ 
                      backgroundColor: `${status.color}20`,
                      color: status.color || undefined,
                      borderColor: status.color || undefined,
                    }}
                  >
                    {status.name}
                  </Badge>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Selection List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Selecione os Status</CardTitle>
          <CardDescription>
            Marque os status que indicam uma conversão bem-sucedida
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedStatuses.map(status => (
              <StatusCheckbox
                key={status.id}
                status={status}
                isSelected={selectedStatusIds.includes(status.id)}
                onToggle={() => handleToggleStatus(status.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateSettings.isPending}
          className="min-w-32"
        >
          {updateSettings.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar Alterações'
          )}
        </Button>
      </div>
    </div>
  );
}

// Sub-component for each status checkbox
interface StatusCheckboxProps {
  status: LeadStatus;
  isSelected: boolean;
  onToggle: () => void;
}

function StatusCheckbox({ status, isSelected, onToggle }: StatusCheckboxProps) {
  return (
    <label
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected 
          ? 'border-primary/50 bg-primary/5' 
          : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
      }`}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggle}
        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
      />
      <div className="flex items-center gap-2 flex-1">
        <div 
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: status.color || '#8B5CF6' }}
        />
        <span className={`font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
          {status.name}
        </span>
      </div>
      {isSelected && (
        <Badge variant="outline" className="text-xs text-primary border-primary/30">
          Conversão
        </Badge>
      )}
    </label>
  );
}
