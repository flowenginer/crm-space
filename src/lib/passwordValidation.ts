import { z } from 'zod';

export interface PasswordCriterion {
  key: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_CRITERIA: ReadonlyArray<PasswordCriterion> = [
  { key: 'minLength', label: 'Mínimo 8 caracteres', test: (p) => p.length >= 8 },
  { key: 'uppercase', label: 'Pelo menos 1 letra maiúscula', test: (p) => /[A-Z]/.test(p) },
  { key: 'lowercase', label: 'Pelo menos 1 letra minúscula', test: (p) => /[a-z]/.test(p) },
  { key: 'number', label: 'Pelo menos 1 número', test: (p) => /[0-9]/.test(p) },
  { key: 'symbol', label: 'Pelo menos 1 símbolo', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export const passwordSchema = z
  .string()
  .min(8, 'A senha precisa ter no mínimo 8 caracteres')
  .regex(/[A-Z]/, 'A senha precisa de pelo menos 1 letra maiúscula')
  .regex(/[a-z]/, 'A senha precisa de pelo menos 1 letra minúscula')
  .regex(/[0-9]/, 'A senha precisa de pelo menos 1 número')
  .regex(/[^A-Za-z0-9]/, 'A senha precisa de pelo menos 1 símbolo');

export const changePasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export interface EvaluatedCriterion extends PasswordCriterion {
  met: boolean;
}

export function evaluatePassword(password: string): EvaluatedCriterion[] {
  return PASSWORD_CRITERIA.map((c) => ({ ...c, met: c.test(password) }));
}

export function translateSupabaseAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (
    lower.includes('different from the old password') ||
    lower.includes('new password should be different')
  ) {
    return 'A nova senha precisa ser diferente da atual';
  }

  if (lower.includes('password should be at least') || lower.includes('password is too short')) {
    return 'A senha não atende ao tamanho mínimo';
  }

  if (lower.includes('weak password') || lower.includes('password is too weak')) {
    return 'A senha é muito fraca. Atenda os critérios listados acima';
  }

  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente';
  }

  if (lower.includes('jwt') || lower.includes('not authenticated') || lower.includes('unauthorized')) {
    return 'Sessão expirada. Faça login novamente';
  }

  return message;
}
