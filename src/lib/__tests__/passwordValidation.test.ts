import { describe, it, expect } from 'vitest';
import {
  PASSWORD_CRITERIA,
  changePasswordSchema,
  evaluatePassword,
  passwordSchema,
  translateSupabaseAuthError,
} from '../passwordValidation';

describe('passwordSchema', () => {
  it('reprova senha com menos de 8 caracteres', () => {
    const result = passwordSchema.safeParse('Aa1!');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/no mínimo 8 caracteres/i);
    }
  });

  it('reprova senha sem letra maiúscula', () => {
    const result = passwordSchema.safeParse('aaaa1234!');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/letra maiúscula/i);
    }
  });

  it('reprova senha sem letra minúscula', () => {
    const result = passwordSchema.safeParse('AAAA1234!');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/letra minúscula/i);
    }
  });

  it('reprova senha sem número', () => {
    const result = passwordSchema.safeParse('Senhaforte!');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/número/i);
    }
  });

  it('reprova senha sem símbolo', () => {
    const result = passwordSchema.safeParse('Senha1234');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/símbolo/i);
    }
  });

  it('aprova senha forte completa', () => {
    expect(passwordSchema.safeParse('Senha@123').success).toBe(true);
    expect(passwordSchema.safeParse('Forte#456!').success).toBe(true);
  });
});

describe('changePasswordSchema', () => {
  it('reprova quando newPassword !== confirmPassword', () => {
    const result = changePasswordSchema.safeParse({
      newPassword: 'Senha@123',
      confirmPassword: 'Outra@456',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const confirmError = result.error.errors.find((e) => e.path.includes('confirmPassword'));
      expect(confirmError?.message).toMatch(/não conferem/i);
    }
  });

  it('reprova quando newPassword é fraca, mesmo com confirm igual', () => {
    const result = changePasswordSchema.safeParse({
      newPassword: 'fraca',
      confirmPassword: 'fraca',
    });
    expect(result.success).toBe(false);
  });

  it('aprova quando senhas conferem e nova é forte', () => {
    const result = changePasswordSchema.safeParse({
      newPassword: 'Senha@123',
      confirmPassword: 'Senha@123',
    });
    expect(result.success).toBe(true);
  });
});

describe('evaluatePassword', () => {
  it('retorna 5 critérios todos não atendidos para string vazia', () => {
    const result = evaluatePassword('');
    expect(result).toHaveLength(5);
    expect(result.every((c) => c.met === false)).toBe(true);
  });

  it('marca minLength=true quando senha tem 8+ chars', () => {
    const result = evaluatePassword('12345678');
    const min = result.find((c) => c.key === 'minLength');
    expect(min?.met).toBe(true);
  });

  it('marca uppercase=true apenas quando há maiúscula', () => {
    expect(evaluatePassword('senha').find((c) => c.key === 'uppercase')?.met).toBe(false);
    expect(evaluatePassword('Senha').find((c) => c.key === 'uppercase')?.met).toBe(true);
  });

  it('marca symbol=true para caracteres acentuados (não-ASCII)', () => {
    expect(evaluatePassword('senh@').find((c) => c.key === 'symbol')?.met).toBe(true);
    expect(evaluatePassword('senh1').find((c) => c.key === 'symbol')?.met).toBe(false);
  });

  it('marca todos os 5 como atendidos para senha forte', () => {
    const result = evaluatePassword('Senha@123');
    expect(result.every((c) => c.met)).toBe(true);
  });

  it('PASSWORD_CRITERIA tem 5 itens', () => {
    expect(PASSWORD_CRITERIA).toHaveLength(5);
  });
});

describe('translateSupabaseAuthError', () => {
  it('traduz erro de senha igual à atual (frase exata da Supabase)', () => {
    expect(
      translateSupabaseAuthError('New password should be different from the old password.')
    ).toBe('A nova senha precisa ser diferente da atual');
  });

  it('traduz variação "new password should be different"', () => {
    expect(translateSupabaseAuthError('New password should be different from the existing.')).toBe(
      'A nova senha precisa ser diferente da atual'
    );
  });

  it('traduz erro de tamanho mínimo', () => {
    expect(translateSupabaseAuthError('Password should be at least 6 characters.')).toBe(
      'A senha não atende ao tamanho mínimo'
    );
  });

  it('traduz weak password', () => {
    expect(translateSupabaseAuthError('Weak password: too easy')).toBe(
      'A senha é muito fraca. Atenda os critérios listados acima'
    );
  });

  it('traduz rate limit', () => {
    expect(translateSupabaseAuthError('Rate limit exceeded')).toBe(
      'Muitas tentativas. Aguarde alguns minutos e tente novamente'
    );
  });

  it('traduz JWT expirado', () => {
    expect(translateSupabaseAuthError('JWT expired')).toBe(
      'Sessão expirada. Faça login novamente'
    );
  });

  it('retorna mensagem original quando não há tradução conhecida', () => {
    const msg = 'Some unknown error from Supabase';
    expect(translateSupabaseAuthError(msg)).toBe(msg);
  });
});
