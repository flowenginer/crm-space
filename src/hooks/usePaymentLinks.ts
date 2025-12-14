import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PaymentLink {
  id: string;
  order_id?: string | null;
  quote_id?: string | null;
  conversation_id?: string | null;
  contact_id?: string | null;
  provider: string;
  external_id?: string | null;
  payment_url?: string | null;
  amount: number;
  description?: string | null;
  payment_methods?: string[] | null;
  max_installments?: number | null;
  expires_at?: string | null;
  customer_name?: string | null;
  customer_document?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  status: string;
  paid_at?: string | null;
  paid_amount?: number | null;
  payment_method_used?: string | null;
  installments_used?: number | null;
  created_at: string;
  created_by?: string | null;
}

interface CreatePaymentLinkParams {
  orderId?: string;
  quoteId?: string;
  conversationId: string;
  contactId: string;
  amount: number;
  description?: string;
  paymentMethods: string[];
  maxInstallments: number;
  expirationDays: number;
  customerName: string;
  customerDocument?: string;
  customerEmail?: string;
  customerPhone?: string;
}

interface PaymentGatewayConfig {
  provider?: string;
  is_configured?: boolean;
  environment?: 'sandbox' | 'production';
  default_expiration_days?: number;
  enabled_methods?: string[];
  max_installments?: number;
  client_id?: string;
  client_secret?: string;
}

// Fetch payment links for an order
export const usePaymentLinks = (orderId?: string | null) => {
  return useQuery({
    queryKey: ['payment-links', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      
      const { data, error } = await supabase
        .from('payment_links')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as PaymentLink[];
    },
    enabled: !!orderId,
  });
};

// Fetch all payment links for a conversation
export const useConversationPaymentLinks = (conversationId?: string | null) => {
  return useQuery({
    queryKey: ['conversation-payment-links', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      const { data, error } = await supabase
        .from('payment_links')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as PaymentLink[];
    },
    enabled: !!conversationId,
  });
};

// Create payment link
export const useCreatePaymentLink = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreatePaymentLinkParams) => {
      const { data, error } = await supabase.functions.invoke('create-rede-payment', {
        body: params,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payment-links', variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ['conversation-payment-links', variables.conversationId] });
      toast.success('Link de pagamento criado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error creating payment link:', error);
      toast.error(`Erro ao criar link: ${error.message}`);
    },
  });
};

// Fetch payment gateway config
export const usePaymentGatewayConfig = () => {
  return useQuery({
    queryKey: ['payment-gateway-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('payment_gateway_config')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return (data?.payment_gateway_config as PaymentGatewayConfig) || {};
    },
  });
};

// Update payment gateway config
export const useUpdatePaymentGatewayConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: PaymentGatewayConfig) => {
      // Check if company_settings exists
      const { data: existing } = await supabase
        .from('company_settings')
        .select('id')
        .single();

      // Cast config to any to satisfy the Json type constraint
      const configJson = config as unknown as Record<string, unknown>;

      if (existing) {
        const { error } = await supabase
          .from('company_settings')
          .update({ 
            payment_gateway_config: configJson,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_settings')
          .insert({ payment_gateway_config: configJson } as any);
        
        if (error) throw error;
      }

      return config;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-gateway-config'] });
      queryClient.invalidateQueries({ queryKey: ['company_settings'] });
      toast.success('Configuração salva com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error saving payment gateway config:', error);
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });
};

// Check if gateway is configured
export const useIsPaymentGatewayConfigured = () => {
  const { data: config, isLoading } = usePaymentGatewayConfig();
  
  return {
    isConfigured: !!config?.is_configured,
    isLoading,
    config,
  };
};
