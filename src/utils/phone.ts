export function formatBrazilianPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  
  if (digits.length <= 2) {
    return digits;
  } else if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  } else {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
}

/**
 * Normaliza o telefone para o formato padrão de armazenamento no banco
 * Retorna apenas dígitos com código do país (55)
 * Este formato é o mesmo usado pelo webhook do WhatsApp
 */
export function normalizePhoneForStorage(phone: string): string {
  // Remove tudo que não for dígito
  let digits = phone.replace(/\D/g, '');
  
  // Remove zeros iniciais extras
  digits = digits.replace(/^0+/, '');
  
  // Se começar com 55 e tiver 12-13 dígitos, está correto
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }
  
  // Se tiver 10-11 dígitos (sem código do país), adiciona 55
  if (digits.length >= 10 && digits.length <= 11) {
    return `55${digits}`;
  }
  
  // Se tiver mais de 13 dígitos e começar com 55, pode ter zeros extras
  if (digits.length > 13 && digits.startsWith('55')) {
    // Tentar extrair os últimos 11 dígitos (número sem código do país)
    const localNumber = digits.slice(-11);
    if (localNumber.length >= 10) {
      return `55${localNumber}`;
    }
  }
  
  return digits;
}

/**
 * @deprecated Use normalizePhoneForStorage instead
 * Mantido para compatibilidade com código legado
 */
export function cleanBrazilianPhone(phone: string): string {
  return normalizePhoneForStorage(phone);
}

/**
 * Gera variações do telefone para busca no banco
 * Útil para encontrar contatos com formatos diferentes
 */
export function getPhoneSearchVariations(phone: string): string[] {
  const normalized = normalizePhoneForStorage(phone);
  const variations: string[] = [normalized];
  
  // Versão sem código do país
  if (normalized.startsWith('55')) {
    variations.push(normalized.slice(2));
  }
  
  // Versão com código do país se não tiver
  if (!normalized.startsWith('55') && normalized.length >= 10) {
    variations.push(`55${normalized}`);
  }
  
  return [...new Set(variations)]; // Remove duplicatas
}

export function isValidBrazilianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  
  // Brazilian mobile: 11 digits (with 9th digit)
  // Brazilian landline: 10 digits
  return digits.length >= 10 && digits.length <= 11;
}

export function formatPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  
  // Remove country code if present
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  } else if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  
  return phone;
}
