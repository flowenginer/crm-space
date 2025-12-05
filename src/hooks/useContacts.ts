import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhoneForStorage, getPhoneSearchVariations } from '@/utils/phone';
import { toast } from 'sonner';

export interface Contact {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  state: string | null;
  city: string | null;
  lead_status: string | null;
  first_contact_at: string | null;
  last_interaction_at: string | null;
  assigned_to: string | null;
  department_id: string | null;
  avatar_url: string | null;
  is_online: boolean | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
  cpf_cnpj: string | null;
  birth_date: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  zip_code: string | null;
  country: string | null;
  person_type: string | null;
  origin: string | null;
  custom_fields: Record<string, unknown> | null;
  assignee?: { id: string; full_name: string | null } | null;
  department?: { id: string; name: string } | null;
  tags?: { id: string; name: string; color: string | null }[];
}

export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          assignee:profiles!contacts_assigned_to_fkey(id, full_name),
          department:departments(id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch tags for contacts
      const contactIds = data?.map(c => c.id) || [];
      if (contactIds.length > 0) {
        const { data: contactTags } = await supabase
          .from('contact_tags')
          .select('contact_id, tag:tags(id, name, color)')
          .in('contact_id', contactIds);

        const tagMap: Record<string, { id: string; name: string; color: string | null }[]> = {};
        contactTags?.forEach(ct => {
          if (!tagMap[ct.contact_id]) tagMap[ct.contact_id] = [];
          if (ct.tag) tagMap[ct.contact_id].push(ct.tag as { id: string; name: string; color: string | null });
        });

        return data?.map(contact => ({
          ...contact,
          tags: tagMap[contact.id] || []
        })) as Contact[];
      }

      return data as Contact[];
    },
  });
}

/**
 * Busca contato existente pelo telefone (verifica múltiplas variações do formato)
 */
export async function findContactByPhone(phone: string): Promise<Contact | null> {
  const variations = getPhoneSearchVariations(phone);
  
  // Build OR query for all variations
  const orConditions = variations.map(v => `phone.eq.${v}`).join(',');
  
  const { data } = await supabase
    .from('contacts')
    .select('*')
    .or(orConditions)
    .limit(1)
    .maybeSingle();
  
  return data as Contact | null;
}

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contact: Partial<Contact>) => {
      if (!contact.phone) {
        throw new Error('Telefone é obrigatório');
      }

      // Normalizar telefone para formato padrão
      const normalizedPhone = normalizePhoneForStorage(contact.phone);
      
      // Verificar se já existe um contato com esse telefone
      const existingContact = await findContactByPhone(normalizedPhone);
      
      if (existingContact) {
        toast.error(`Já existe um contato com este telefone: ${existingContact.full_name}`);
        throw new Error(`Contato já existe: ${existingContact.full_name} (${existingContact.phone})`);
      }

      // Criar o contato com telefone normalizado
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          full_name: contact.full_name!,
          phone: normalizedPhone,
          email: contact.email,
          state: contact.state,
          city: contact.city,
          lead_status: contact.lead_status || 'new',
          assigned_to: contact.assigned_to,
          department_id: contact.department_id,
          notes: contact.notes,
          cpf_cnpj: contact.cpf_cnpj,
          birth_date: contact.birth_date,
          street: contact.street,
          number: contact.number,
          complement: contact.complement,
          neighborhood: contact.neighborhood,
          zip_code: contact.zip_code,
          country: contact.country || 'Brasil',
          person_type: contact.person_type || 'individual',
          origin: contact.origin || 'manual',
        })
        .select()
        .single();

      if (error) {
        // Se for erro de duplicata (constraint), tentar buscar o existente
        if (error.code === '23505') {
          const existing = await findContactByPhone(normalizedPhone);
          if (existing) {
            toast.error(`Contato já existe: ${existing.full_name}`);
            throw new Error(`Contato duplicado: ${existing.full_name}`);
          }
        }
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, tags, assignee, department, custom_fields, phone, ...contact }: Partial<Contact> & { id: string }) => {
      const updateData: Record<string, unknown> = { ...contact };
      
      // Se estiver atualizando o telefone, normalizar e verificar duplicatas
      if (phone) {
        const normalizedPhone = normalizePhoneForStorage(phone);
        
        // Verificar se já existe outro contato com esse telefone
        const existingContact = await findContactByPhone(normalizedPhone);
        if (existingContact && existingContact.id !== id) {
          toast.error(`Já existe outro contato com este telefone: ${existingContact.full_name}`);
          throw new Error(`Telefone já em uso por: ${existingContact.full_name}`);
        }
        
        updateData.phone = normalizedPhone;
      }
      
      if (custom_fields !== undefined) {
        updateData.custom_fields = custom_fields;
      }
      
      const { error } = await supabase
        .from('contacts')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}
