import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCreateRescueTemplate,
  useUpdateRescueTemplate,
  type RescueTemplate,
  type RescueStep,
} from '@/hooks/useRescueTemplates';
import { useCloseReasons } from '@/hooks/useCloseReasons';
import { useDepartments } from '@/hooks/useDepartments';

interface RescueTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: RescueTemplate | null;
}

export function RescueTemplateModal({
  open,
  onOpenChange,
  template,
}: RescueTemplateModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<RescueStep[]>([
    { message: '', timer_minutes: 10 },
  ]);
  const [finalAction, setFinalAction] = useState<'close' | 'transfer' | 'none'>('close');
  const [closeReasonId, setCloseReasonId] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');

  const { data: closeReasons = [] } = useCloseReasons();
  const { data: departments = [] } = useDepartments();
  const createTemplate = useCreateRescueTemplate();
  const updateTemplate = useUpdateRescueTemplate();

  const isEditing = !!template;
  const isSaving = createTemplate.isPending || updateTemplate.isPending;

  useEffect(() => {
    if (template) {
      setTitle(template.title);
      setDescription(template.description || '');
      setSteps(template.steps.length > 0 ? template.steps : [{ message: '', timer_minutes: 10 }]);
      setFinalAction(template.final_action);
      setCloseReasonId(template.final_action_config?.close_reason_id || '');
      setDepartmentId(template.final_action_config?.department_id || '');
    } else {
      setTitle('');
      setDescription('');
      setSteps([{ message: '', timer_minutes: 10 }]);
      setFinalAction('close');
      setCloseReasonId('');
      setDepartmentId('');
    }
  }, [template, open]);

  const handleAddStep = () => {
    setSteps([...steps, { message: '', timer_minutes: 60 }]);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleStepChange = (index: number, field: keyof RescueStep, value: string | number) => {
    setSteps(steps.map((step, i) => 
      i === index ? { ...step, [field]: value } : step
    ));
  };

  const formatTimerLabel = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Informe o título do template');
      return;
    }

    const validSteps = steps.filter(s => s.message.trim());
    if (validSteps.length === 0) {
      toast.error('Adicione pelo menos uma mensagem');
      return;
    }

    const finalActionConfig: { close_reason_id?: string; department_id?: string } = {};
    if (finalAction === 'close' && closeReasonId) {
      finalActionConfig.close_reason_id = closeReasonId;
    } else if (finalAction === 'transfer' && departmentId) {
      finalActionConfig.department_id = departmentId;
    }

    try {
      if (isEditing && template) {
        await updateTemplate.mutateAsync({
          id: template.id,
          title,
          description,
          steps: validSteps,
          final_action: finalAction,
          final_action_config: finalActionConfig,
        });
        toast.success('Template atualizado!');
      } else {
        await createTemplate.mutateAsync({
          title,
          description,
          steps: validSteps,
          final_action: finalAction,
          final_action_config: finalActionConfig,
        });
        toast.success('Template criado!');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao salvar template');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Template de Resgate' : 'Novo Template de Resgate'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Título do Template</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Resgate Padrão"
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Sequência de 3 mensagens para leads inativos"
                />
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Mensagens do Resgate</Label>
                <Button variant="outline" size="sm" onClick={handleAddStep}>
                  <Plus size={14} className="mr-1" />
                  Adicionar Mensagem
                </Button>
              </div>

              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={index} className="relative p-4 border border-border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-muted-foreground">
                        Mensagem {index + 1}
                      </span>
                      {steps.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveStep(index)}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Textarea
                        value={step.message}
                        onChange={(e) => handleStepChange(index, 'message', e.target.value)}
                        placeholder="Digite a mensagem..."
                        rows={3}
                        className="resize-none"
                      />

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock size={14} />
                          <span>Timer para próxima mensagem:</span>
                        </div>
                        <Select
                          value={step.timer_minutes.toString()}
                          onValueChange={(value) => handleStepChange(index, 'timer_minutes', parseInt(value))}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5 min</SelectItem>
                            <SelectItem value="10">10 min</SelectItem>
                            <SelectItem value="15">15 min</SelectItem>
                            <SelectItem value="30">30 min</SelectItem>
                            <SelectItem value="60">1 hora</SelectItem>
                            <SelectItem value="120">2 horas</SelectItem>
                            <SelectItem value="240">4 horas</SelectItem>
                            <SelectItem value="480">8 horas</SelectItem>
                            <SelectItem value="720">12 horas</SelectItem>
                            <SelectItem value="1440">24 horas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cancellation Info */}
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  O resgate será automaticamente cancelado se o lead responder a qualquer momento.
                </p>
              </div>
            </div>

            {/* Final Action */}
            <div className="space-y-4 pt-4 border-t border-border">
              <Label className="text-base font-semibold">
                Ação Final (se o lead não responder)
              </Label>

              <Select
                value={finalAction}
                onValueChange={(value: 'close' | 'transfer' | 'none') => setFinalAction(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma ação</SelectItem>
                  <SelectItem value="close">Fechar conversa</SelectItem>
                  <SelectItem value="transfer">Transferir para departamento</SelectItem>
                </SelectContent>
              </Select>

              {finalAction === 'close' && (
                <div>
                  <Label>Motivo de fechamento</Label>
                  <Select value={closeReasonId} onValueChange={setCloseReasonId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {closeReasons.filter(r => r.is_active).map((reason) => (
                        <SelectItem key={reason.id} value={reason.id}>
                          {reason.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {finalAction === 'transfer' && (
                <div>
                  <Label>Departamento destino</Label>
                  <Select value={departmentId} onValueChange={setDepartmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.filter(d => d.is_active).map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 size={14} className="mr-2 animate-spin" />}
            {isEditing ? 'Salvar' : 'Criar Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
