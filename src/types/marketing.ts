// Marketing Campaign Types

export type MarketingActionType = 
  // Messages
  | 'none'
  | 'send_next_message'
  | 'cancel_campaign'  // Cancelar próximos envios para este contato
  
  // Transfers
  | 'transfer_agent'
  | 'transfer_department'
  | 'transfer_owner'  // Transfer to contact owner
  
  // Organizational
  | 'add_tag'
  | 'change_lead_status'  // Uses lead_statuses table
  | 'add_segment'
  | 'close'
  
  // Chaining
  | 'start_followup'      // Start another Follow-up template
  | 'start_marketing'     // Start another Marketing Campaign
  | 'start_automation';   // Activate a Chatbot Flow

export interface MarketingActionConfig {
  // Transfers
  agent_id?: string;
  department_id?: string;
  
  // Organizational
  tag_id?: string;
  lead_status_id?: string;
  segment_id?: string;
  close_reason_id?: string;
  
  // Chaining
  followup_template_id?: string;
  marketing_campaign_id?: string;
  automation_id?: string;
}

export interface MarketingAction {
  type: MarketingActionType;
  config: MarketingActionConfig;
}

export interface MarketingStep {
  message: string;
  timer_minutes: number;
  audio_url?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  on_reply_actions: MarketingAction[];
  on_no_reply_actions: MarketingAction[];
}

export interface MarketingCampaign {
  id: string;
  title: string;
  description: string | null;
  steps: MarketingStep[];
  is_active: boolean;
  initial_department_id: string | null;
  created_by: string | null;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface ActiveMarketingCampaign {
  id: string;
  campaign_id: string;
  contact_id: string;
  conversation_id: string | null;
  current_step: number;
  status: 'active' | 'responded' | 'completed' | 'cancelled';
  next_send_at: string | null;
  dispatch_id: string | null;
  tenant_id: string;
  created_at: string;
  responded_at: string | null;
}

export interface MarketingScheduledMessage {
  id: string;
  active_campaign_id: string;
  step_number: number;
  content: string;
  audio_url: string | null;
  attachment_url: string | null;
  scheduled_for: string;
  sent_at: string | null;
  status: 'pending' | 'sent' | 'cancelled';
  tenant_id: string;
  created_at: string;
}

// Action labels for UI
export const MARKETING_ACTION_LABELS: Record<MarketingActionType, string> = {
  none: 'Nenhuma ação',
  send_next_message: 'Enviar próxima mensagem',
  cancel_campaign: 'Cancelar próximos envios',
  transfer_agent: 'Transferir para vendedor',
  transfer_department: 'Transferir para departamento',
  transfer_owner: 'Transferir para dono do contato',
  add_tag: 'Adicionar etiqueta',
  change_lead_status: 'Mudar status do lead',
  add_segment: 'Anexar segmento',
  close: 'Fechar conversa',
  start_followup: 'Iniciar Follow-up',
  start_marketing: 'Iniciar Campanha de Marketing',
  start_automation: 'Ativar automação',
};

// Action categories for grouping in dropdown
export const MARKETING_ACTION_CATEGORIES = [
  {
    label: 'Mensagens',
    actions: ['send_next_message', 'cancel_campaign'] as MarketingActionType[],
  },
  {
    label: 'Transferências',
    actions: ['transfer_agent', 'transfer_department', 'transfer_owner'] as MarketingActionType[],
  },
  {
    label: 'Organização',
    actions: ['add_tag', 'change_lead_status', 'add_segment', 'close'] as MarketingActionType[],
  },
  {
    label: 'Encadeamento',
    actions: ['start_followup', 'start_marketing', 'start_automation'] as MarketingActionType[],
  },
];
