import { useState, useEffect, useRef } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Plus, 
  Trash2, 
  Clock, 
  Loader2,
  Bold,
  Italic,
  Strikethrough,
  Mic,
  Square,
  Upload,
  Paperclip,
  X,
  Play,
  Pause,
  FileText,
  Image as ImageIcon,
  Video,
  MessageSquareReply,
  Timer,
  ChevronDown,
  ChevronUp,
  Reply,
  Clock4,
} from 'lucide-react';
import { toast } from 'sonner';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ActionBuilder } from './ActionBuilder';
import { 
  useCreateMarketingCampaign,
  useUpdateMarketingCampaign,
  useChatbotFlows,
} from '@/hooks/useMarketingCampaigns';
import { useMarketingCampaigns } from '@/hooks/useMarketingCampaigns';
import { useRescueTemplates } from '@/hooks/useRescueTemplates';
import { useCloseReasons } from '@/hooks/useCloseReasons';
import { useDepartments } from '@/hooks/useDepartments';
import { useTeam } from '@/hooks/useTeam';
import { useTags } from '@/hooks/useTags';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { useSegments } from '@/hooks/useSegments';
import { supabase } from '@/integrations/supabase/client';
import type { MarketingCampaign, MarketingStep, MarketingAction } from '@/types/marketing';

interface MarketingCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: MarketingCampaign | null;
}

const VARIABLES = [
  { key: '{{nome}}', label: 'Nome' },
  { key: '{{telefone}}', label: 'Telefone' },
  { key: '{{email}}', label: 'Email' },
];

const DEFAULT_STEP: MarketingStep = {
  message: '',
  timer_minutes: 1440, // 24 hours default
  on_reply_actions: [],
  on_no_reply_actions: [],
};

export function MarketingCampaignModal({
  open,
  onOpenChange,
  campaign,
}: MarketingCampaignModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<MarketingStep[]>([{ ...DEFAULT_STEP }]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Record<number, { reply: boolean; noReply: boolean }>>({});

  // Data hooks
  const { data: closeReasons = [] } = useCloseReasons();
  const { data: departments = [] } = useDepartments();
  const { data: team = [] } = useTeam();
  const { data: tags = [] } = useTags();
  const { data: leadStatuses = [] } = useLeadStatuses();
  const { data: segments = [] } = useSegments();
  const { data: rescueTemplates = [] } = useRescueTemplates();
  const { data: marketingCampaigns = [] } = useMarketingCampaigns();
  const { data: chatbotFlows = [] } = useChatbotFlows();

  const createCampaign = useCreateMarketingCampaign();
  const updateCampaign = useUpdateMarketingCampaign();

  const isEditing = !!campaign;
  const isSaving = createCampaign.isPending || updateCampaign.isPending;

  useEffect(() => {
    if (campaign) {
      setTitle(campaign.title);
      setDescription(campaign.description || '');
      setSteps(campaign.steps.length > 0 ? campaign.steps : [{ ...DEFAULT_STEP }]);
      // Initialize expanded sections
      const sections: Record<number, { reply: boolean; noReply: boolean }> = {};
      campaign.steps.forEach((_, i) => {
        sections[i] = { reply: true, noReply: true };
      });
      setExpandedSections(sections);
    } else {
      setTitle('');
      setDescription('');
      setSteps([{ ...DEFAULT_STEP }]);
      setExpandedSections({ 0: { reply: true, noReply: true } });
    }
    setActiveStepIndex(0);
  }, [campaign, open]);

  const handleAddStep = () => {
    const newIndex = steps.length;
    setSteps([...steps, { ...DEFAULT_STEP }]);
    setActiveStepIndex(newIndex);
    setExpandedSections(prev => ({
      ...prev,
      [newIndex]: { reply: true, noReply: true },
    }));
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== index));
    if (activeStepIndex >= steps.length - 1) {
      setActiveStepIndex(Math.max(0, steps.length - 2));
    }
    // Update expanded sections
    const newSections: Record<number, { reply: boolean; noReply: boolean }> = {};
    Object.entries(expandedSections).forEach(([key, value]) => {
      const keyNum = parseInt(key);
      if (keyNum < index) {
        newSections[keyNum] = value;
      } else if (keyNum > index) {
        newSections[keyNum - 1] = value;
      }
    });
    setExpandedSections(newSections);
  };

  const handleStepChange = (index: number, field: keyof MarketingStep, value: any) => {
    setSteps(prevSteps => prevSteps.map((step, i) => 
      i === index ? { ...step, [field]: value } : step
    ));
  };

  const toggleSection = (stepIndex: number, section: 'reply' | 'noReply') => {
    setExpandedSections(prev => ({
      ...prev,
      [stepIndex]: {
        ...prev[stepIndex],
        [section]: !prev[stepIndex]?.[section],
      },
    }));
  };

  const insertVariable = (variable: string) => {
    const step = steps[activeStepIndex];
    handleStepChange(activeStepIndex, 'message', step.message + variable);
  };

  const applyFormatting = (format: 'bold' | 'italic' | 'strike') => {
    const step = steps[activeStepIndex];
    const formatChars = { bold: '*', italic: '_', strike: '~' };
    const char = formatChars[format];
    handleStepChange(activeStepIndex, 'message', step.message + `${char}texto${char}`);
  };

  const formatTimerLabel = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  const renderWhatsAppPreview = (step: MarketingStep) => {
    const formatMessage = (text: string) => {
      return text
        .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
        .replace(/_([^_]+)_/g, '<em>$1</em>')
        .replace(/~([^~]+)~/g, '<del>$1</del>')
        .replace(/\n/g, '<br/>');
    };

    return (
      <div className="bg-[#0b141a] rounded-lg p-4 min-h-[150px]">
        <div className="flex flex-col gap-2">
          {step.audio_url && (
            <div className="self-end max-w-[85%] bg-[#005c4b] text-white rounded-lg p-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Play size={14} />
                </div>
                <div className="flex-1 h-1 bg-white/30 rounded-full" />
                <span className="text-xs opacity-70">0:00</span>
              </div>
            </div>
          )}
          
          {step.attachment_url && (
            <div className="self-end max-w-[85%] bg-[#005c4b] text-white rounded-lg overflow-hidden">
              {step.attachment_type === 'image' ? (
                <img 
                  src={step.attachment_url} 
                  alt="Preview" 
                  className="max-w-full max-h-32 object-cover"
                />
              ) : step.attachment_type === 'video' ? (
                <div className="w-full h-24 bg-black/50 flex items-center justify-center">
                  <Video size={24} className="opacity-70" />
                </div>
              ) : (
                <div className="p-3 flex items-center gap-2">
                  <FileText size={20} />
                  <span className="text-sm truncate">{step.attachment_name || 'Documento'}</span>
                </div>
              )}
            </div>
          )}

          {step.message && (
            <div className="self-end max-w-[85%] bg-[#005c4b] text-white rounded-lg px-3 py-2">
              <p 
                className="text-sm whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{ __html: formatMessage(step.message) }}
              />
              <div className="flex justify-end mt-1">
                <span className="text-[10px] opacity-60">12:00</span>
              </div>
            </div>
          )}

          {!step.message && !step.audio_url && !step.attachment_url && (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-sm">Preview aparecerá aqui</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Informe o título da campanha');
      return;
    }

    const validSteps = steps.filter(s => s.message.trim() || s.audio_url || s.attachment_url);
    if (validSteps.length === 0) {
      toast.error('Adicione pelo menos uma mensagem');
      return;
    }

    try {
      if (isEditing && campaign) {
        await updateCampaign.mutateAsync({
          id: campaign.id,
          title,
          description,
          steps: validSteps,
        });
        toast.success('Campanha atualizada!');
      } else {
        await createCampaign.mutateAsync({
          title,
          description,
          steps: validSteps,
        });
        toast.success('Campanha criada!');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao salvar campanha');
    }
  };

  const activeStep = steps[activeStepIndex];
  const isReplyExpanded = expandedSections[activeStepIndex]?.reply ?? true;
  const isNoReplyExpanded = expandedSections[activeStepIndex]?.noReply ?? true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Campanha de Marketing' : 'Nova Campanha de Marketing'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-4">
          {/* Left: Steps List */}
          <div className="w-48 flex-shrink-0 border-r border-border pr-4">
            <Label className="text-xs text-muted-foreground mb-2 block">MENSAGENS</Label>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <div
                    key={index}
                    className={`relative group p-3 rounded-lg border cursor-pointer transition-all ${
                      activeStepIndex === index
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                    onClick={() => setActiveStepIndex(index)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Mensagem {index + 1}</span>
                      {steps.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveStep(index);
                          }}
                        >
                          <Trash2 size={12} className="text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={10} />
                      {formatTimerLabel(step.timer_minutes)}
                    </div>
                    {step.message && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {step.message.substring(0, 30)}...
                      </p>
                    )}
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleAddStep}
                >
                  <Plus size={14} className="mr-1" />
                  Adicionar
                </Button>
              </div>
            </ScrollArea>
          </div>

          {/* Right: Step Editor */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-[450px] pr-4">
              <div className="space-y-4">
                {/* Title & Description (only show on first step) */}
                {activeStepIndex === 0 && (
                  <div className="space-y-3 pb-4 border-b border-border">
                    <div>
                      <Label>Título da Campanha *</Label>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ex: Promoção Black Friday"
                      />
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Descrição opcional..."
                      />
                    </div>
                  </div>
                )}

                {/* Message Editor */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Mensagem {activeStepIndex + 1}</Label>
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        {VARIABLES.map((v) => (
                          <Tooltip key={v.key}>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => insertVariable(v.key)}
                              >
                                {v.label}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{v.key}</TooltipContent>
                          </Tooltip>
                        ))}
                      </TooltipProvider>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 mb-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => applyFormatting('bold')}
                    >
                      <Bold size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => applyFormatting('italic')}
                    >
                      <Italic size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => applyFormatting('strike')}
                    >
                      <Strikethrough size={14} />
                    </Button>
                  </div>

                  <Textarea
                    value={activeStep?.message || ''}
                    onChange={(e) => handleStepChange(activeStepIndex, 'message', e.target.value)}
                    placeholder="Digite a mensagem..."
                    className="min-h-[100px] resize-none"
                  />
                </div>

                {/* Timer */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-2">
                      <Timer size={14} />
                      Timer: {formatTimerLabel(activeStep?.timer_minutes || 1440)}
                    </Label>
                  </div>
                  <Slider
                    value={[activeStep?.timer_minutes || 1440]}
                    onValueChange={([value]) => handleStepChange(activeStepIndex, 'timer_minutes', value)}
                    min={5}
                    max={10080} // 7 days
                    step={5}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>5 min</span>
                    <span>7 dias</span>
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <Label className="mb-2 block">Preview</Label>
                  {renderWhatsAppPreview(activeStep || DEFAULT_STEP)}
                </div>

                {/* Actions */}
                <div className="space-y-3 pt-4 border-t border-border">
                  {/* On Reply Actions */}
                  <Collapsible 
                    open={isReplyExpanded} 
                    onOpenChange={() => toggleSection(activeStepIndex, 'reply')}
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-green-500/10 rounded-lg hover:bg-green-500/20 transition-colors">
                      <div className="flex items-center gap-2 text-green-600">
                        <Reply size={16} />
                        <span className="text-sm font-medium">Se o cliente RESPONDER</span>
                      </div>
                      {isReplyExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <ActionBuilder
                        actions={activeStep?.on_reply_actions || []}
                        onChange={(actions) => handleStepChange(activeStepIndex, 'on_reply_actions', actions)}
                        label=""
                        closeReasons={closeReasons}
                        departments={departments}
                        agents={team}
                        tags={tags}
                        leadStatuses={leadStatuses}
                        segments={segments}
                        rescueTemplates={rescueTemplates}
                        marketingCampaigns={marketingCampaigns}
                        chatbotFlows={chatbotFlows}
                        currentCampaignId={campaign?.id}
                        hasMoreSteps={activeStepIndex < steps.length - 1}
                      />
                    </CollapsibleContent>
                  </Collapsible>

                  {/* On No Reply Actions */}
                  <Collapsible 
                    open={isNoReplyExpanded} 
                    onOpenChange={() => toggleSection(activeStepIndex, 'noReply')}
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-orange-500/10 rounded-lg hover:bg-orange-500/20 transition-colors">
                      <div className="flex items-center gap-2 text-orange-600">
                        <Clock4 size={16} />
                        <span className="text-sm font-medium">
                          Se NÃO responder (após {formatTimerLabel(activeStep?.timer_minutes || 1440)})
                        </span>
                      </div>
                      {isNoReplyExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <ActionBuilder
                        actions={activeStep?.on_no_reply_actions || []}
                        onChange={(actions) => handleStepChange(activeStepIndex, 'on_no_reply_actions', actions)}
                        label=""
                        closeReasons={closeReasons}
                        departments={departments}
                        agents={team}
                        tags={tags}
                        leadStatuses={leadStatuses}
                        segments={segments}
                        rescueTemplates={rescueTemplates}
                        marketingCampaigns={marketingCampaigns}
                        chatbotFlows={chatbotFlows}
                        currentCampaignId={campaign?.id}
                        hasMoreSteps={activeStepIndex < steps.length - 1}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? 'Salvar' : 'Criar Campanha'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
