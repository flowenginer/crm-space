import { describe, it, expect } from 'vitest';
import {
  shouldRestrictByAllowedChannels,
  type AssignmentFilterExtended,
} from '../usePaginatedConversations';

const NON_EMPTY_CHANNELS = ['ch-1', 'ch-2'];

describe('shouldRestrictByAllowedChannels', () => {
  // --- Caso principal do bug ---
  it('retorna false quando assignment === "mine" (não restringe por canal)', () => {
    expect(shouldRestrictByAllowedChannels('mine', NON_EMPTY_CHANNELS)).toBe(false);
  });

  // --- Outros valores de assignment COM canais permitidos → deve restringir ---
  it('retorna true quando assignment === "all"', () => {
    expect(shouldRestrictByAllowedChannels('all', NON_EMPTY_CHANNELS)).toBe(true);
  });

  it('retorna true quando assignment === "unassigned"', () => {
    expect(shouldRestrictByAllowedChannels('unassigned', NON_EMPTY_CHANNELS)).toBe(true);
  });

  it('retorna true quando assignment === "pending"', () => {
    expect(shouldRestrictByAllowedChannels('pending', NON_EMPTY_CHANNELS)).toBe(true);
  });

  it('retorna true quando assignment é undefined (não declarado)', () => {
    const assignment: AssignmentFilterExtended | undefined = undefined;
    expect(shouldRestrictByAllowedChannels(assignment, NON_EMPTY_CHANNELS)).toBe(true);
  });

  // --- Edge cases: allowedChannelIds inválido → nunca restringe ---
  it('retorna false quando allowedChannelIds é undefined', () => {
    expect(shouldRestrictByAllowedChannels('all', undefined)).toBe(false);
  });

  it('retorna false quando allowedChannelIds é array vazio', () => {
    expect(shouldRestrictByAllowedChannels('all', [])).toBe(false);
  });

  it('retorna false quando assignment === "mine" E allowedChannelIds é array vazio', () => {
    expect(shouldRestrictByAllowedChannels('mine', [])).toBe(false);
  });

  it('retorna false quando assignment === "mine" E allowedChannelIds é undefined', () => {
    expect(shouldRestrictByAllowedChannels('mine', undefined)).toBe(false);
  });
});
