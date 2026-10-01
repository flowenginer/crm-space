import { describe, it, expect } from 'vitest';
import { LOGOUT_PAUSE_REASON, pauseOnLogout, resumeAfterLogoutPause } from '../logoutPause';

type Call = [string, ...unknown[]];

function fakeClient(error: { message: string } | null = null) {
  const calls: Call[] = [];
  const builder = {
    update: (v: unknown) => (calls.push(['update', v]), builder),
    eq: (c: string, v: unknown) => (calls.push(['eq', c, v]), builder),
    is: (c: string, v: unknown) => (calls.push(['is', c, v]), builder),
    then: (resolve: (r: { error: typeof error }) => void) => resolve({ error }),
  };
  const client = { from: (t: string) => (calls.push(['from', t]), builder) };
  return { client: client as unknown as Parameters<typeof pauseOnLogout>[0], calls };
}

describe('pauseOnLogout', () => {
  it('pausa com o motivo de logout só quem estava disponível', async () => {
    const { client, calls } = fakeClient();
    await pauseOnLogout(client, 'u1');
    expect(calls).toEqual([
      ['from', 'profiles'],
      ['update', { is_available: false, unavailability_reason: LOGOUT_PAUSE_REASON }],
      ['eq', 'id', 'u1'],
      ['eq', 'is_available', true],
    ]);
  });

  it('propaga erro do banco', async () => {
    const { client } = fakeClient({ message: 'boom' });
    await expect(pauseOnLogout(client, 'u1')).rejects.toEqual({ message: 'boom' });
  });
});

describe('resumeAfterLogoutPause', () => {
  it('só retoma pausa de logout sem trava de admin', async () => {
    const { client, calls } = fakeClient();
    await resumeAfterLogoutPause(client, 'u1');
    expect(calls).toEqual([
      ['from', 'profiles'],
      ['update', { is_available: true, unavailability_reason: null, unavailable_until: null }],
      ['eq', 'id', 'u1'],
      ['eq', 'is_available', false],
      ['eq', 'unavailability_reason', LOGOUT_PAUSE_REASON],
      ['is', 'availability_locked_by', null],
    ]);
  });

  it('propaga erro do banco', async () => {
    const { client } = fakeClient({ message: 'boom' });
    await expect(resumeAfterLogoutPause(client, 'u1')).rejects.toEqual({ message: 'boom' });
  });
});
