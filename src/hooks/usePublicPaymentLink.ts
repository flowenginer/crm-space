import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PublicPaymentLink {
  id: string;
  amount: number;
  description: string | null;
  customer_name: string | null;
  expires_at: string | null;
  status: string;
  payment_methods: string[] | null;
  max_installments: number | null;
  created_at: string;
  company_name: string | null;
  logo_url: string | null;
}

export function usePublicPaymentLink(paymentLinkId?: string) {
  return useQuery({
    queryKey: ["public-payment-link", paymentLinkId],
    queryFn: async (): Promise<PublicPaymentLink | null> => {
      if (!paymentLinkId) return null;

      const { data, error } = await supabase
        .rpc("get_public_payment_link", { link_id: paymentLinkId });

      if (error) {
        console.error("Error fetching public payment link:", error);
        throw error;
      }

      // The RPC returns an array, get the first item
      const link = Array.isArray(data) ? data[0] : data;
      
      if (!link) return null;

      return {
        id: link.id,
        amount: Number(link.amount),
        description: link.description,
        customer_name: link.customer_name,
        expires_at: link.expires_at,
        status: link.status,
        payment_methods: link.payment_methods,
        max_installments: link.max_installments,
        created_at: link.created_at,
        company_name: link.company_name,
        logo_url: link.logo_url,
      };
    },
    enabled: !!paymentLinkId,
    staleTime: 30000, // 30 seconds
  });
}
