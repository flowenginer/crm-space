import { ERPContact } from './useContactsForERP';

export interface ContactValidation {
  isComplete: boolean;
  missingFields: string[];
}

const REQUIRED_FIELDS: { key: keyof ERPContact; label: string }[] = [
  { key: 'full_name', label: 'Nome' },
  { key: 'cpf_cnpj', label: 'CPF/CNPJ' },
  { key: 'zip_code', label: 'CEP' },
  { key: 'street', label: 'Rua' },
  { key: 'number', label: 'Número' },
  { key: 'neighborhood', label: 'Bairro' },
  { key: 'city', label: 'Cidade' },
  { key: 'state', label: 'Estado' },
];

export function validateContactForShipping(contact: ERPContact | null): ContactValidation {
  if (!contact) {
    return {
      isComplete: false,
      missingFields: REQUIRED_FIELDS.map(f => f.label),
    };
  }

  const missingFields: string[] = [];
  
  for (const field of REQUIRED_FIELDS) {
    const value = contact[field.key];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missingFields.push(field.label);
    }
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}

export function isContactCompleteForShipping(contact: ERPContact | null): boolean {
  return validateContactForShipping(contact).isComplete;
}
