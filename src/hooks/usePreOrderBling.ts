import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { syncContactToBling, createPreOrderInBling, getBlingConfig, blingApi } from '@/lib/blingSync';
import { toast } from 'sonner';

interface PreOrderData {
  contactId: string;
  contactData: {
    full_name: string;
    phone: string;
    email?: string | null;
    cpf_cnpj?: string | null;
    person_type?: string | null;
    birth_date?: string | null;
    street?: string | null;
    number?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    zip_code?: string | null;
    city?: string | null;
    state?: string | null;
  };
  endereco?: {
    nome: string;
    endereco: string;
    numero: string;
    complemento?: string;
    municipio: string;
    uf: string;
    cep: string;
    bairro: string;
  };
  observacoes: string;
  observacoesInternas?: string;
}

export function useCreatePreOrderBling() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PreOrderData) => {
      // 1. Update contact locally with latest data
      const updateFields: Record<string, unknown> = {
        full_name: data.contactData.full_name,
        phone: data.contactData.phone,
      };
      if (data.contactData.email) updateFields.email = data.contactData.email;
      if (data.contactData.cpf_cnpj) updateFields.cpf_cnpj = data.contactData.cpf_cnpj;
      if (data.contactData.person_type) updateFields.person_type = data.contactData.person_type;
      if (data.contactData.birth_date) updateFields.birth_date = data.contactData.birth_date;
      if (data.contactData.street) updateFields.street = data.contactData.street;
      if (data.contactData.number) updateFields.number = data.contactData.number;
      if (data.contactData.complement) updateFields.complement = data.contactData.complement;
      if (data.contactData.neighborhood) updateFields.neighborhood = data.contactData.neighborhood;
      if (data.contactData.zip_code) updateFields.zip_code = data.contactData.zip_code;
      if (data.contactData.city) updateFields.city = data.contactData.city;
      if (data.contactData.state) updateFields.state = data.contactData.state;

      await supabase
        .from('contacts')
        .update(updateFields)
        .eq('id', data.contactId);

      // 2. Sync contact to Bling (create or update)
      const syncResult = await syncContactToBling(data.contactId, data.contactData);

      let contactBlingId: number;
      if (syncResult.bling_id) {
        contactBlingId = parseInt(syncResult.bling_id);
      } else {
        // Try to get existing mapping
        const config = await getBlingConfig();
        if (!config?.access_token || !config?.tenant_id) throw new Error('Bling não configurado');

        const { data: mapping } = await supabase
          .from('bling_id_mappings')
          .select('bling_id')
          .eq('tenant_id', config.tenant_id)
          .eq('entity_type', 'contact')
          .eq('local_id', data.contactId)
          .maybeSingle();

        if (mapping?.bling_id) {
          contactBlingId = parseInt(mapping.bling_id);
        } else {
          // Force-create contact in Bling (even if sync_contacts is disabled)
          const cpfCnpjClean = data.contactData.cpf_cnpj?.replace(/\D/g, '') || undefined;
          const celularClean = data.contactData.phone?.replace(/\D/g, '') || undefined;
          const blingData: Record<string, unknown> = {
            nome: data.contactData.full_name,
            tipo: data.contactData.person_type === 'company' ? 'J' : 'F',
            contribuinte: 9,
          };
          if (cpfCnpjClean) blingData.numeroDocumento = cpfCnpjClean;
          if (data.contactData.email) blingData.email = data.contactData.email;
          if (celularClean) blingData.celular = celularClean;

          const response = await blingApi('/contatos', config.access_token, 'POST', blingData);
          const newBlingId = response.data?.id;

          if (!newBlingId) {
            throw new Error('Não foi possível criar contato no Bling');
          }

          // Save mapping
          await supabase
            .from('bling_id_mappings')
            .insert({
              tenant_id: config.tenant_id,
              entity_type: 'contact',
              local_id: data.contactId,
              bling_id: String(newBlingId),
              sync_direction: 'local_to_bling',
            });

          contactBlingId = newBlingId;
        }
      }

      // 3. Create pre-order in Bling
      const { blingId, blingNumero } = await createPreOrderInBling({
        contactBlingId,
        endereco: data.endereco,
        observacoes: data.observacoes,
        observacoesInternas: data.observacoesInternas,
      });

      // 4. Save order number to contact's custom_fields (accumulate)
      const { data: currentContact } = await supabase
        .from('contacts')
        .select('custom_fields')
        .eq('id', data.contactId)
        .single();

      const currentFields = (currentContact?.custom_fields as Record<string, unknown>) || {};
      const pedidosBling = (currentFields.pedidos_bling as Array<{ numero: string; data: string; valor: number | null }>) || [];

      pedidosBling.push({
        numero: blingNumero,
        data: new Date().toISOString(),
        valor: null,
      });

      await supabase
        .from('contacts')
        .update({
          custom_fields: { ...currentFields, pedidos_bling: pedidosBling },
        })
        .eq('id', data.contactId);

      return { blingId, blingNumero };
    },
    onSuccess: (result) => {
      toast.success(`Pré-pedido #${result.blingNumero} criado no Bling!`);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-history'] });
    },
    onError: (error: Error) => {
      console.error('[PreOrder] Error:', error);
      toast.error(`Erro ao criar pré-pedido: ${error.message}`);
    },
  });
}
