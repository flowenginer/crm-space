// Support Tickets Types

export type TicketCategory = 'bug' | 'feature' | 'question' | 'improvement' | 'performance' | 'security';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketStatus = 'open' | 'in_progress' | 'waiting_response' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  ticket_number: number;
  tenant_id: string | null;
  requester_id: string;
  assigned_to: string | null;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  affected_module: string | null;
  browser_info: string | null;
  screenshot_url: string | null;
  requester_role: string | null;
  created_at: string;
  updated_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  // Joined data
  requester?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  assignee?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  tenant?: {
    id: string;
    name: string;
  };
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  author?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface SupportTechnician {
  id: string;
  user_id: string;
  is_active: boolean;
  specialties: string[] | null;
  created_at: string;
  profile?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface SupportDashboardMetrics {
  total_tickets: number;
  open_tickets: number;
  in_progress: number;
  waiting_response: number;
  resolved: number;
  closed: number;
  by_priority: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  by_category: {
    bug: number;
    feature: number;
    question: number;
    improvement: number;
    performance: number;
    security: number;
  };
  avg_resolution_hours: number;
  avg_first_response_hours: number;
}

export interface TechnicianRanking {
  technician_id: string;
  technician_name: string;
  tickets_assigned: number;
  tickets_resolved: number;
  avg_resolution_hours: number;
  avg_first_response_hours: number;
}

export interface TicketsByTenant {
  tenant_id: string;
  tenant_name: string;
  total_tickets: number;
  open_tickets: number;
}

export interface TicketsEvolution {
  month: string;
  created: number;
  resolved: number;
}

export interface CreateTicketData {
  title: string;
  description: string;
  category: TicketCategory;
  priority?: TicketPriority;
  affected_module?: string;
  screenshot_url?: string;
}

export interface UpdateTicketData {
  status?: TicketStatus;
  priority?: TicketPriority;
  assigned_to?: string | null;
}

// Category and priority labels/colors
export const CATEGORY_CONFIG: Record<TicketCategory, { label: string; color: string }> = {
  bug: { label: 'Bug', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  feature: { label: 'Nova Funcionalidade', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  question: { label: 'Dúvida', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  improvement: { label: 'Melhoria', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  performance: { label: 'Performance', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  security: { label: 'Segurança', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400' },
};

export const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string }> = {
  low: { label: 'Baixa', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
  medium: { label: 'Média', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  high: { label: 'Alta', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  critical: { label: 'Crítica', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

export const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string }> = {
  open: { label: 'Aberto', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  in_progress: { label: 'Em Andamento', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  waiting_response: { label: 'Aguardando Resposta', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  resolved: { label: 'Resolvido', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  closed: { label: 'Fechado', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
};

export const MODULE_OPTIONS = [
  { value: 'conversations', label: 'Conversas' },
  { value: 'contacts', label: 'Contatos' },
  { value: 'reports', label: 'Relatórios' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'kanban', label: 'Kanban' },
  { value: 'automation', label: 'Automação' },
  { value: 'integrations', label: 'Integrações' },
  { value: 'settings', label: 'Configurações' },
  { value: 'other', label: 'Outro' },
];
