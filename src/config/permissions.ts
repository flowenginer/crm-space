/**
 * SISTEMA CENTRALIZADO DE PERMISSÕES
 * ===================================
 * 
 * Este arquivo é a ÚNICA FONTE DE VERDADE para todas as permissões do sistema.
 * 
 * REGRAS PARA DESENVOLVEDORES:
 * 1. Toda nova funcionalidade deve ter sua permissão registrada aqui PRIMEIRO
 * 2. Use o padrão: categoria.acao (ex: contacts.create, reports.export)
 * 3. Após adicionar aqui, a permissão aparecerá automaticamente no painel de Gerenciamento de Perfis
 * 4. Use hasPermission('categoria', 'acao') nos componentes para verificar acesso
 * 
 * NOMENCLATURA:
 * - view: visualizar/acessar
 * - create: criar novo
 * - update: editar existente
 * - delete: remover
 * - export: exportar dados
 * - import: importar dados
 * - manage: gerenciar (acesso completo)
 */

import {
  LayoutDashboard,
  MessageSquare,
  Radio,
  FileText,
  CalendarClock,
  Workflow,
  TrendingUp,
  Smartphone,
  Users,
  Megaphone,
  BarChart3,
  Settings,
  Link2,
  Tags,
  Shield,
  LucideIcon,
} from 'lucide-react';

export interface PermissionDefinition {
  key: string; // formato: categoria.acao
  name: string;
  description: string;
}

export interface PermissionCategory {
  key: string;
  label: string;
  icon: LucideIcon;
  order: number;
  permissions: PermissionDefinition[];
}

/**
 * REGISTRO CENTRAL DE PERMISSÕES
 * Adicione novas categorias e permissões aqui
 */
export const SYSTEM_PERMISSIONS: PermissionCategory[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    order: 1,
    permissions: [
      { key: 'dashboard.view', name: 'Ver Dashboard', description: 'Acessar painel principal com métricas' },
      { key: 'dashboard.view_all', name: 'Ver Métricas Globais', description: 'Ver métricas de todos os atendentes' },
    ],
  },
  {
    key: 'conversations',
    label: 'Conversas',
    icon: MessageSquare,
    order: 2,
    permissions: [
      { key: 'conversations.view', name: 'Ver Conversas', description: 'Visualizar suas conversas' },
      { key: 'conversations.view_all', name: 'Ver Todas as Conversas', description: 'Ver conversas de todos os atendentes' },
      { key: 'conversations.view_unassigned', name: 'Ver Não Atribuídas', description: 'Visualizar conversas não atribuídas' },
      { key: 'conversations.view_pending', name: 'Ver Pendentes do Departamento', description: 'Visualizar conversas pendentes de atribuição no departamento' },
      { key: 'conversations.create', name: 'Iniciar Conversa', description: 'Iniciar nova conversa com contato' },
      { key: 'conversations.respond', name: 'Responder Mensagens', description: 'Enviar mensagens nas conversas' },
      { key: 'conversations.transfer', name: 'Transferir Conversa', description: 'Transferir para outro atendente/departamento' },
      { key: 'conversations.close', name: 'Fechar Conversa', description: 'Fechar atendimentos' },
      { key: 'conversations.requests', name: 'Gerenciar Requisições', description: 'Visualizar e gerenciar requisições de contato' },
    ],
  },
  {
    key: 'live',
    label: 'Monitor Ao Vivo',
    icon: Radio,
    order: 3,
    permissions: [
      { key: 'live.view', name: 'Acessar Monitor', description: 'Visualizar monitor em tempo real' },
      { key: 'live.intervene', name: 'Intervir em Conversas', description: 'Entrar em conversas de outros atendentes' },
      { key: 'live.toggle_availability', name: 'Controlar Disponibilidade', description: 'Ativar/desativar recebimento de leads de outros agentes' },
    ],
  },
  {
    key: 'templates',
    label: 'Mensagens Rápidas',
    icon: FileText,
    order: 4,
    permissions: [
      { key: 'templates.view', name: 'Ver Templates', description: 'Visualizar mensagens rápidas' },
      { key: 'templates.create', name: 'Criar Template', description: 'Adicionar novas mensagens rápidas' },
      { key: 'templates.update', name: 'Editar Template', description: 'Modificar mensagens existentes' },
      { key: 'templates.delete', name: 'Excluir Template', description: 'Remover mensagens rápidas' },
    ],
  },
  {
    key: 'schedules',
    label: 'Agendamentos',
    icon: CalendarClock,
    order: 5,
    permissions: [
      { key: 'schedules.view', name: 'Ver Agendamentos', description: 'Visualizar mensagens agendadas' },
      { key: 'schedules.create', name: 'Criar Agendamento', description: 'Agendar novas mensagens' },
      { key: 'schedules.update', name: 'Editar Agendamento', description: 'Modificar agendamentos' },
      { key: 'schedules.delete', name: 'Cancelar Agendamento', description: 'Cancelar mensagens agendadas' },
    ],
  },
  {
    key: 'automations',
    label: 'Automações',
    icon: Workflow,
    order: 6,
    permissions: [
      { key: 'automations.view', name: 'Ver Automações', description: 'Visualizar fluxos de automação' },
      { key: 'automations.create', name: 'Criar Automação', description: 'Criar novos fluxos' },
      { key: 'automations.update', name: 'Editar Automação', description: 'Modificar fluxos existentes' },
      { key: 'automations.delete', name: 'Excluir Automação', description: 'Remover fluxos' },
      { key: 'automations.publish', name: 'Publicar/Ativar', description: 'Ativar ou desativar fluxos' },
    ],
  },
  {
    key: 'deals',
    label: 'CRM / Negócios',
    icon: TrendingUp,
    order: 7,
    permissions: [
      { key: 'deals.view', name: 'Ver Negócios', description: 'Visualizar seus negócios no CRM' },
      { key: 'deals.view_all', name: 'Ver Todos os Negócios', description: 'Ver negócios de todos os atendentes' },
      { key: 'deals.create', name: 'Criar Negócio', description: 'Adicionar novos negócios' },
      { key: 'deals.update', name: 'Editar Negócio', description: 'Modificar negócios existentes' },
      { key: 'deals.delete', name: 'Excluir Negócio', description: 'Remover negócios' },
    ],
  },
  {
    key: 'channels',
    label: 'Canais WhatsApp',
    icon: Smartphone,
    order: 8,
    permissions: [
      { key: 'channels.view', name: 'Ver Canais', description: 'Visualizar canais WhatsApp conectados' },
      { key: 'channels.create', name: 'Criar Canal', description: 'Adicionar novos canais' },
      { key: 'channels.update', name: 'Configurar Canal', description: 'Editar configurações de canais' },
      { key: 'channels.delete', name: 'Excluir Canal', description: 'Remover canais' },
      { key: 'channels.connect', name: 'Conectar QR Code', description: 'Conectar instâncias via QR Code' },
    ],
  },
  {
    key: 'contacts',
    label: 'Contatos',
    icon: Users,
    order: 9,
    permissions: [
      { key: 'contacts.view', name: 'Ver Contatos', description: 'Visualizar lista de contatos' },
      { key: 'contacts.create', name: 'Criar Contato', description: 'Adicionar novos contatos' },
      { key: 'contacts.update', name: 'Editar Contato', description: 'Modificar dados de contatos' },
      { key: 'contacts.delete', name: 'Excluir Contato', description: 'Remover contatos' },
      { key: 'contacts.import', name: 'Importar Contatos', description: 'Importar via planilha' },
      { key: 'contacts.export', name: 'Exportar Contatos', description: 'Exportar para planilha' },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    order: 10,
    permissions: [
      { key: 'marketing.view', name: 'Ver Meta Ads', description: 'Acessar gerenciador de anúncios' },
      { key: 'marketing.view_campaigns', name: 'Ver Campanhas', description: 'Visualizar relatórios de campanhas' },
      { key: 'marketing.manage', name: 'Gerenciar Anúncios', description: 'Criar e editar campanhas' },
    ],
  },
  {
    key: 'reports',
    label: 'Relatórios',
    icon: BarChart3,
    order: 11,
    permissions: [
      { key: 'reports.view', name: 'Ver Relatórios', description: 'Acessar relatórios e métricas' },
      { key: 'reports.view_all', name: 'Ver Relatórios Globais', description: 'Ver relatórios de toda a equipe' },
      { key: 'reports.export', name: 'Exportar Relatórios', description: 'Exportar dados para planilha' },
    ],
  },
  {
    key: 'tags',
    label: 'Tags e Etiquetas',
    icon: Tags,
    order: 12,
    permissions: [
      { key: 'tags.view', name: 'Ver Tags', description: 'Visualizar tags do sistema' },
      { key: 'tags.create', name: 'Criar Tag', description: 'Adicionar novas tags' },
      { key: 'tags.update', name: 'Editar Tag', description: 'Modificar tags existentes' },
      { key: 'tags.delete', name: 'Excluir Tag', description: 'Remover tags' },
    ],
  },
  {
    key: 'webhooks',
    label: 'Webhooks e Integrações',
    icon: Link2,
    order: 13,
    permissions: [
      { key: 'webhooks.view', name: 'Ver Webhooks', description: 'Visualizar webhooks configurados' },
      { key: 'webhooks.create', name: 'Criar Webhook', description: 'Adicionar novos webhooks' },
      { key: 'webhooks.update', name: 'Editar Webhook', description: 'Modificar webhooks' },
      { key: 'webhooks.delete', name: 'Excluir Webhook', description: 'Remover webhooks' },
    ],
  },
  {
    key: 'settings',
    label: 'Configurações',
    icon: Settings,
    order: 14,
    permissions: [
      { key: 'settings.view', name: 'Ver Configurações', description: 'Acessar configurações do sistema' },
      { key: 'settings.update', name: 'Editar Configurações Gerais', description: 'Modificar configurações gerais da empresa' },
      { key: 'settings.users', name: 'Gerenciar Equipe', description: 'Visualizar e gerenciar membros da equipe' },
      { key: 'settings.departments', name: 'Gerenciar Departamentos', description: 'Criar e editar departamentos' },
      { key: 'settings.channels', name: 'Gerenciar Canais', description: 'Configurar canais de atendimento' },
      { key: 'settings.fields', name: 'Gerenciar Campos', description: 'Criar campos personalizados' },
      { key: 'settings.tags', name: 'Gerenciar Etiquetas', description: 'Criar e editar tags do sistema' },
      { key: 'settings.close_reasons', name: 'Motivos de Fechamento', description: 'Configurar motivos de encerramento' },
      { key: 'settings.integrations', name: 'Integrações', description: 'Configurar integrações externas' },
    ],
  },
  {
    key: 'users',
    label: 'Gestão de Usuários',
    icon: Shield,
    order: 15,
    permissions: [
      { key: 'users.view', name: 'Ver Usuários', description: 'Visualizar lista de usuários' },
      { key: 'users.create', name: 'Criar Usuário', description: 'Convidar novos usuários' },
      { key: 'users.update', name: 'Editar Usuário', description: 'Modificar dados de usuários' },
      { key: 'users.delete', name: 'Desativar Usuário', description: 'Desativar ou remover usuários' },
      { key: 'users.manage_roles', name: 'Gerenciar Perfis', description: 'Criar e editar perfis de acesso' },
    ],
  },
  {
    key: 'queues',
    label: 'Filas de Atendimento',
    icon: Users,
    order: 16,
    permissions: [
      { key: 'queues.view', name: 'Ver Filas', description: 'Visualizar filas de atendimento' },
      { key: 'queues.manage', name: 'Gerenciar Filas', description: 'Criar e configurar filas' },
      { key: 'queues.manage_agents', name: 'Gerenciar Agentes', description: 'Adicionar/remover agentes das filas' },
    ],
  },
];

/**
 * Helper: Obter categoria por chave
 */
export function getPermissionCategory(categoryKey: string): PermissionCategory | undefined {
  return SYSTEM_PERMISSIONS.find(c => c.key === categoryKey);
}

/**
 * Helper: Obter todas as permissões como array flat
 */
export function getAllPermissions(): PermissionDefinition[] {
  return SYSTEM_PERMISSIONS.flatMap(category => category.permissions);
}

/**
 * Helper: Obter mapa de categorias para uso em UI
 */
export function getCategoryConfig(): Record<string, { label: string; icon: LucideIcon; order: number }> {
  return SYSTEM_PERMISSIONS.reduce((acc, category) => {
    acc[category.key] = {
      label: category.label,
      icon: category.icon,
      order: category.order,
    };
    return acc;
  }, {} as Record<string, { label: string; icon: LucideIcon; order: number }>);
}

/**
 * Helper: Verificar se uma permissão existe no sistema
 */
export function isValidPermission(permissionKey: string): boolean {
  return getAllPermissions().some(p => p.key === permissionKey);
}
