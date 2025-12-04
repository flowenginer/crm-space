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

export function cleanBrazilianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  
  // If already has country code
  if (digits.startsWith('55') && digits.length === 13) {
    return digits;
  }
  
  // Add country code
  return `55${digits}`;
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
