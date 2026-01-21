import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { useEvaluationTargets, useUpdateEvaluationTargets, EvaluationTargets } from '@/hooks/useEvaluationTargets';

interface TargetsConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TargetsConfigModal({ open, onOpenChange }: TargetsConfigModalProps) {
  const { data: targets, isLoading } = useEvaluationTargets();
  const updateTargets = useUpdateEvaluationTargets();
  const [formData, setFormData] = useState<EvaluationTargets | null>(null);

  useEffect(() => {
    if (targets && open) {
      setFormData(targets);
    }
  }, [targets, open]);

  const handleSave = () => {
    if (!formData) return;
    updateTargets.mutate(formData, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const updateField = (field: keyof EvaluationTargets, value: string) => {
    if (!formData) return;
    setFormData({ ...formData, [field]: parseFloat(value) || 0 });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Metas de Avaliação</DialogTitle>
        </DialogHeader>

        {isLoading || !formData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="kpis" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="kpis">KPIs Principais</TabsTrigger>
              <TabsTrigger value="comunicacao">Comunicação</TabsTrigger>
              <TabsTrigger value="criterios">Critérios</TabsTrigger>
            </TabsList>

            <TabsContent value="kpis" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetOverallScore">Score Geral (0-10)</Label>
                  <Input
                    id="targetOverallScore"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formData.targetOverallScore}
                    onChange={(e) => updateField('targetOverallScore', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetTaxaFechamento">Taxa Fechamento (%)</Label>
                  <Input
                    id="targetTaxaFechamento"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={formData.targetTaxaFechamento}
                    onChange={(e) => updateField('targetTaxaFechamento', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetEficienciaObjecoes">Eficiência Objeções (%)</Label>
                  <Input
                    id="targetEficienciaObjecoes"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={formData.targetEficienciaObjecoes}
                    onChange={(e) => updateField('targetEficienciaObjecoes', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetNotaObjecoes">Nota Objeções (0-10)</Label>
                  <Input
                    id="targetNotaObjecoes"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formData.targetNotaObjecoes}
                    onChange={(e) => updateField('targetNotaObjecoes', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetConducao">Condução (0-10)</Label>
                  <Input
                    id="targetConducao"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formData.targetConducao}
                    onChange={(e) => updateField('targetConducao', e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="comunicacao" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetComunicacaoClareza">Clareza (0-10)</Label>
                  <Input
                    id="targetComunicacaoClareza"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formData.targetComunicacaoClareza}
                    onChange={(e) => updateField('targetComunicacaoClareza', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetComunicacaoCordialidade">Cordialidade (0-10)</Label>
                  <Input
                    id="targetComunicacaoCordialidade"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formData.targetComunicacaoCordialidade}
                    onChange={(e) => updateField('targetComunicacaoCordialidade', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetComunicacaoProatividade">Proatividade (0-10)</Label>
                  <Input
                    id="targetComunicacaoProatividade"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formData.targetComunicacaoProatividade}
                    onChange={(e) => updateField('targetComunicacaoProatividade', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetComunicacaoConhecimento">Conhecimento Produto (0-10)</Label>
                  <Input
                    id="targetComunicacaoConhecimento"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formData.targetComunicacaoConhecimento}
                    onChange={(e) => updateField('targetComunicacaoConhecimento', e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="criterios" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetTempoResposta">Tempo Resposta (0-10)</Label>
                  <Input
                    id="targetTempoResposta"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formData.targetTempoResposta}
                    onChange={(e) => updateField('targetTempoResposta', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetPersonalizacao">Personalização (0-10)</Label>
                  <Input
                    id="targetPersonalizacao"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formData.targetPersonalizacao}
                    onChange={(e) => updateField('targetPersonalizacao', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetSensoUrgencia">Senso de Urgência (0-10)</Label>
                  <Input
                    id="targetSensoUrgencia"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formData.targetSensoUrgencia}
                    onChange={(e) => updateField('targetSensoUrgencia', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetRecuperacaoFinal">Recuperação Final (0-10)</Label>
                  <Input
                    id="targetRecuperacaoFinal"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formData.targetRecuperacaoFinal}
                    onChange={(e) => updateField('targetRecuperacaoFinal', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetQualificacaoLead">Qualificação Lead (0-10)</Label>
                  <Input
                    id="targetQualificacaoLead"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formData.targetQualificacaoLead}
                    onChange={(e) => updateField('targetQualificacaoLead', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetFollowupEstruturado">Follow-up Estruturado (0-10)</Label>
                  <Input
                    id="targetFollowupEstruturado"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formData.targetFollowupEstruturado}
                    onChange={(e) => updateField('targetFollowupEstruturado', e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateTargets.isPending}>
            {updateTargets.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
