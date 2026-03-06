import { useState } from 'react';
import { Loader2, Megaphone, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useRescueTemplates, type RescueTemplate } from '@/hooks/useRescueTemplates';
import { useMarketingCampaigns } from '@/hooks/useMarketingCampaigns';
import { supabase } from '@/integrations/supabase/client';
import type { MarketingCampaign } from '@/types/marketing';

interface BulkRescueModalProps {
  open: boolean;
  onClose: () => void;
  conversationIds: string[];
  onSuccess?: () => void;
}

type RescueMode = 'rescue' | 'marketing';

export function BulkRescueModal({
  open,
  onClose,
  conversationIds,
  onSuccess,
}: BulkRescueModalProps) {
  const [mode, setMode] = useState<RescueMode>('rescue');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0, errors: 0 });

  const { data: rescueTemplates = [], isLoading: loadingTemplates } = useRescueTemplates();
  const { data: marketingCampaigns = [], isLoading: loadingCampaigns } = useMarketingCampaigns();

  const formatTimer = (minutes: number): string => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins}min`;
  };

  const handleActivateBulkRescue = async (template: RescueTemplate) => {
    setIsProcessing(true);
    setProgress({ processed: 0, total: conversationIds.length, errors: 0 });

    const { data: { user } } = await supabase.auth.getUser();
    let errors = 0;

    for (let i = 0; i < conversationIds.length; i++) {
      const conversationId = conversationIds[i];

      try {
        // Get conversation data
        const { data: conv } = await supabase
          .from('conversations')
          .select('contact_id, contact:contacts(full_name, phone), channel_id')
          .eq('id', conversationId)
          .single();

        if (!conv?.contact_id || !conv?.channel_id) {
          errors++;
          continue;
        }

        const contactName = (conv.contact as any)?.full_name || '';

        // Replace {{nome}} in steps
        const stepsWithName = template.steps.map(step => ({
          ...step,
          message: step.message.replace(/\{\{nome\}\}/gi, contactName),
        }));

        const now = new Date();

        // Check if there's already an active rescue
        const { data: existingRescue } = await supabase
          .from('active_rescues')
          .select('id')
          .eq('conversation_id', conversationId)
          .eq('status', 'active')
          .maybeSingle();

        if (existingRescue) {
          // Skip - already has active rescue
          errors++;
          setProgress(p => ({ ...p, processed: i + 1, errors }));
          continue;
        }

        // Create active rescue
        const { data: rescue, error: rescueError } = await supabase
          .from('active_rescues')
          .insert({
            conversation_id: conversationId,
            contact_id: conv.contact_id,
            template_id: template.id,
            current_step: 0,
            next_send_at: now.toISOString(),
            status: 'active',
            activated_by: user?.id,
          } as any)
          .select()
          .single();

        if (rescueError) {
          errors++;
          setProgress(p => ({ ...p, processed: i + 1, errors }));
          continue;
        }

        // Schedule all messages (first as sent, rest as pending)
        let accumulatedMinutes = stepsWithName[0]?.timer_minutes || 5;
        const scheduledMessages = [{
          rescue_id: rescue.id,
          step_number: 0,
          content: stepsWithName[0]?.message || '',
          scheduled_for: now.toISOString(),
          status: 'pending' as const,
          audio_url: stepsWithName[0]?.audio_url || null,
          attachment_url: stepsWithName[0]?.attachment_url || null,
          attachment_type: stepsWithName[0]?.attachment_type || null,
          attachment_name: stepsWithName[0]?.attachment_name || null,
        }];

        for (let j = 1; j < stepsWithName.length; j++) {
          const scheduledTime = new Date(now.getTime() + accumulatedMinutes * 60 * 1000);
          scheduledMessages.push({
            rescue_id: rescue.id,
            step_number: j,
            content: stepsWithName[j].message,
            scheduled_for: scheduledTime.toISOString(),
            status: 'pending' as const,
            audio_url: stepsWithName[j].audio_url || null,
            attachment_url: stepsWithName[j].attachment_url || null,
            attachment_type: stepsWithName[j].attachment_type || null,
            attachment_name: stepsWithName[j].attachment_name || null,
          });
          accumulatedMinutes += stepsWithName[j].timer_minutes;
        }

        await supabase.from('rescue_scheduled_messages').insert(scheduledMessages.map(m => ({ ...m, tenant_id: conv.tenant_id })) as any);
      } catch (err) {
        console.error(`Error activating rescue for ${conversationId}:`, err);
        errors++;
      }

      setProgress(p => ({ ...p, processed: i + 1, errors }));

      // Small delay between operations
      if (i < conversationIds.length - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    setIsProcessing(false);
    const successCount = conversationIds.length - errors;
    toast.success(`Resgate ativado para ${successCount} conversa(s)`, {
      description: errors > 0 ? `${errors} erro(s) ou já possuíam resgate ativo` : undefined,
    });
    onSuccess?.();
    onClose();
  };

  const handleActivateBulkMarketing = async (campaign: MarketingCampaign) => {
    setIsProcessing(true);
    setProgress({ processed: 0, total: conversationIds.length, errors: 0 });

    const { data: { user } } = await supabase.auth.getUser();
    let errors = 0;

    for (let i = 0; i < conversationIds.length; i++) {
      const conversationId = conversationIds[i];

      try {
        const { data: conv } = await supabase
          .from('conversations')
          .select('contact_id, contact:contacts(full_name, phone), channel_id')
          .eq('id', conversationId)
          .single();

        if (!conv?.contact_id || !conv?.channel_id) {
          errors++;
          setProgress(p => ({ ...p, processed: i + 1, errors }));
          continue;
        }

        // Check existing active campaign for this contact
        const { data: existing } = await supabase
          .from('active_marketing_campaigns')
          .select('id')
          .eq('contact_id', conv.contact_id)
          .eq('campaign_id', campaign.id)
          .eq('status', 'active')
          .maybeSingle();

        if (existing) {
          errors++;
          setProgress(p => ({ ...p, processed: i + 1, errors }));
          continue;
        }

        const now = new Date();

        // Create active marketing campaign
        const { data: activeCampaign, error: campaignError } = await supabase
          .from('active_marketing_campaigns')
          .insert({
            campaign_id: campaign.id,
            contact_id: conv.contact_id,
            conversation_id: conversationId,
            channel_id: conv.channel_id,
            current_step: 0,
            status: 'active',
            created_by: user?.id,
          } as any)
          .select()
          .single();

        if (campaignError) {
          errors++;
          setProgress(p => ({ ...p, processed: i + 1, errors }));
          continue;
        }

        // Schedule first message
        const firstStep = campaign.steps[0];
        if (firstStep) {
          const contactName = (conv.contact as any)?.full_name || '';
          const content = firstStep.message.replace(/\{\{nome\}\}/gi, contactName);

          await supabase.from('marketing_scheduled_messages').insert({
            active_campaign_id: activeCampaign.id,
            step_number: 0,
            scheduled_for: now.toISOString(),
            status: 'pending',
            content,
            audio_url: firstStep.audio_url || null,
            attachment_url: firstStep.attachment_url || null,
            attachment_type: firstStep.attachment_type || null,
          } as any);
        }
      } catch (err) {
        console.error(`Error activating marketing for ${conversationId}:`, err);
        errors++;
      }

      setProgress(p => ({ ...p, processed: i + 1, errors }));

      if (i < conversationIds.length - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    setIsProcessing(false);
    const successCount = conversationIds.length - errors;
    toast.success(`Campanha ativada para ${successCount} conversa(s)`, {
      description: errors > 0 ? `${errors} erro(s) ou já possuíam campanha ativa` : undefined,
    });
    onSuccess?.();
    onClose();
  };

  const handleConfirm = () => {
    if (mode === 'rescue') {
      const template = rescueTemplates.find(t => t.id === selectedTemplateId);
      if (template) handleActivateBulkRescue(template);
    } else {
      const campaign = marketingCampaigns.find(c => c.id === selectedCampaignId);
      if (campaign) handleActivateBulkMarketing(campaign);
    }
  };

  const isLoading = loadingTemplates || loadingCampaigns;
  const hasSelection = mode === 'rescue' ? !!selectedTemplateId : !!selectedCampaignId;

  return (
    <Dialog open={open} onOpenChange={(v) => !isProcessing && !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone size={18} className="text-primary" />
            Resgate em massa
          </DialogTitle>
          <DialogDescription>
            Enviar mensagens de resgate para {conversationIds.length} conversa(s) selecionada(s)
          </DialogDescription>
        </DialogHeader>

        {isProcessing ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <Loader2 className="animate-spin text-primary" size={20} />
              <span className="text-sm">
                Processando {progress.processed} de {progress.total}...
              </span>
            </div>
            <Progress value={(progress.processed / progress.total) * 100} />
            {progress.errors > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-600">
                <AlertTriangle size={14} />
                {progress.errors} erro(s) ou já possuíam resgate/campanha ativo(a)
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Mode Toggle */}
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <button
                type="button"
                onClick={() => setMode('rescue')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  mode === 'rescue'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Templates de Resgate
              </button>
              <button
                type="button"
                onClick={() => setMode('marketing')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  mode === 'marketing'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Campanhas Marketing
              </button>
            </div>

            <ScrollArea className="max-h-64">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin" size={24} />
                </div>
              ) : mode === 'rescue' ? (
                rescueTemplates.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Nenhum template de resgate cadastrado
                  </div>
                ) : (
                  <div className="space-y-1 p-1">
                    {rescueTemplates.map(template => (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={`w-full p-3 text-left rounded-lg transition-colors ${
                          selectedTemplateId === template.id
                            ? 'bg-primary/10 border border-primary/30'
                            : 'hover:bg-muted border border-transparent'
                        }`}
                      >
                        <div className="font-medium text-sm">{template.title}</div>
                        {template.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {template.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                          <span>{template.steps.length} mensagens</span>
                          <span>·</span>
                          <span>
                            Timers: {template.steps.map(s => formatTimer(s.timer_minutes)).join(' → ')}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                marketingCampaigns.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Nenhuma campanha de marketing ativa
                  </div>
                ) : (
                  <div className="space-y-1 p-1">
                    {marketingCampaigns.map(campaign => (
                      <button
                        key={campaign.id}
                        onClick={() => setSelectedCampaignId(campaign.id)}
                        className={`w-full p-3 text-left rounded-lg transition-colors ${
                          selectedCampaignId === campaign.id
                            ? 'bg-primary/10 border border-primary/30'
                            : 'hover:bg-muted border border-transparent'
                        }`}
                      >
                        <div className="font-medium text-sm">{campaign.title}</div>
                        {campaign.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {campaign.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                          <span>{campaign.steps.length} etapas</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              )}
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!hasSelection || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 size={14} className="mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Megaphone size={14} className="mr-2" />
                Ativar resgate ({conversationIds.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
