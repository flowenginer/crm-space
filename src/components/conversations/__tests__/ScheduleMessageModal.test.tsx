import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScheduleMessageModal } from '../ScheduleMessageModal';

// ---- mocks ----
const insertMock: (payload: any) => void = vi.fn();

let approvedTemplatesData: any[] = [];
let isLoadingTemplates = false;

vi.mock('@/hooks/useMetaTemplates', async () => {
  const actual = await vi.importActual<any>('@/hooks/useMetaTemplates');
  return {
    ...actual,
    useApprovedMetaTemplates: () => ({
      data: approvedTemplatesData,
      isLoading: isLoadingTemplates,
    }),
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => {
  const chain: any = {};
  const fromReturn = (table: string) => {
    const obj: any = {
      _table: table,
      select: vi.fn(() => obj),
      eq: vi.fn(() => obj),
      order: vi.fn(() => obj),
      limit: vi.fn(() => obj),
      single: vi.fn(() => {
        if (table === 'whatsapp_channels') {
          return Promise.resolve({ data: { type: 'cloudapi' }, error: null });
        }
        if (table === 'conversations') {
          return Promise.resolve({ data: { channel_id: 'chan-1' }, error: null });
        }
        if (table === 'profiles') {
          return Promise.resolve({
            data: { full_name: 'Agente', signature_name: null, signature_enabled: false },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      insert: (payload: any) => {
        insertMock(payload);
        return Promise.resolve({ error: null });
      },
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    };
    // Make default thenable (for queries that dont call .single())
    obj.then = (resolve: any) => resolve({ data: [], error: null });
    return obj;
  };
  return {
    supabase: {
      from: vi.fn((table: string) => fromReturn(table)),
      auth: {
        getUser: vi.fn(() =>
          Promise.resolve({ data: { user: { id: 'user-1' } } }),
        ),
      },
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(() => Promise.resolve({ data: {}, error: null })),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://pub/url' } })),
        })),
      },
    },
  };
});

// PointerEvent is missing in jsdom, but Radix Select uses it.
// Provide a no-op polyfill so userEvent clicks can trigger the Select menu.
beforeEach(() => {
  (insertMock as unknown as { mockClear: () => void }).mockClear();
  approvedTemplatesData = [];
  isLoadingTemplates = false;
});

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ScheduleMessageModal
        open={true}
        onClose={vi.fn()}
        contactId="contact-1"
        conversationId="conv-1"
        channelId="chan-1"
        contactName="Marcilene"
      />
    </QueryClientProvider>,
  );
}

function getToggleItem(label: RegExp) {
  // Radix ToggleGroupItem pode renderizar como role="radio" (single) ou "button" (multiple)
  const byRadio = screen.queryAllByRole('radio', { name: label });
  if (byRadio[0]) return byRadio[0];
  return screen.getByLabelText(label);
}

describe('ScheduleMessageModal — modo template', () => {
  it('renderiza toggle Mensagem Livre / Template Meta', () => {
    renderModal();
    expect(getToggleItem(/mensagem livre/i)).toBeInTheDocument();
    expect(getToggleItem(/template meta/i)).toBeInTheDocument();
  });

  it('comecando em modo livre, esconde UI de template', () => {
    renderModal();
    expect(screen.queryByText(/Template aprovado/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /agendar template/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agendar mensagem/i })).toBeInTheDocument();
  });

  it('clicando em Template Meta revela seletor, esconde fluxo livre', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(getToggleItem(/template meta/i));

    expect(screen.getByText(/Template aprovado/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agendar template/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /agendar mensagem/i })).not.toBeInTheDocument();
    // Textarea do modo livre sumiu
    expect(screen.queryByPlaceholderText(/Digite sua mensagem/i)).not.toBeInTheDocument();
  });

  it('vazio: select do template renderiza quando modo ativa', async () => {
    const user = userEvent.setup();
    approvedTemplatesData = [];
    renderModal();
    await user.click(getToggleItem(/template meta/i));
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('botao Agendar Template desabilitado ate selecionar template + data + hora', async () => {
    const user = userEvent.setup();
    approvedTemplatesData = [
      {
        id: 'tpl-1',
        name: 'oi_amigo',
        language: 'pt_BR',
        category: 'UTILITY',
        status: 'APPROVED',
        components: [{ type: 'BODY', text: 'Oi {{1}}' }],
        header_media_url: null,
      },
    ];
    renderModal();
    await user.click(getToggleItem(/template meta/i));

    const agendarBtn = screen.getByRole('button', { name: /agendar template/i });
    expect(agendarBtn).toBeDisabled();
  });
});

describe('ScheduleMessageModal — modo livre preservado', () => {
  it('fluxo livre mantem textarea e botao', () => {
    renderModal();
    expect(screen.getByPlaceholderText(/Digite sua mensagem/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agendar mensagem/i })).toBeInTheDocument();
  });

  it('botao Agendar Mensagem desabilitado sem conteudo', () => {
    renderModal();
    const btn = screen.getByRole('button', { name: /agendar mensagem/i });
    expect(btn).toBeDisabled();
  });
});
