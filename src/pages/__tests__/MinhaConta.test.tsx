import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const mockUpdateUser = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { name: 'Vendas' }, error: null }),
        }),
      }),
    }),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    profile: {
      id: 'user-1',
      full_name: 'Diego Vendedor',
      role: 'vendedor',
      department_id: 'dep-1',
      tenant_id: 'tenant-1',
    },
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { id: 'user-1', email: 'diego@empresa.com' },
  }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import MinhaConta from '../MinhaConta';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MinhaConta />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockUpdateUser.mockReset();
  mockNavigate.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  vi.useRealTimers();
});

describe('MinhaConta — render', () => {
  it('mostra dados pessoais do usuário', async () => {
    renderPage();
    expect(screen.getByText('Diego Vendedor')).toBeInTheDocument();
    expect(screen.getByText('diego@empresa.com')).toBeInTheDocument();
    expect(screen.getByText('vendedor')).toBeInTheDocument();
  });

  it('renderiza os 5 critérios de senha como pendentes inicialmente', () => {
    renderPage();
    expect(screen.getByTestId('criterion-minLength')).toHaveAttribute('data-met', 'false');
    expect(screen.getByTestId('criterion-uppercase')).toHaveAttribute('data-met', 'false');
    expect(screen.getByTestId('criterion-lowercase')).toHaveAttribute('data-met', 'false');
    expect(screen.getByTestId('criterion-number')).toHaveAttribute('data-met', 'false');
    expect(screen.getByTestId('criterion-symbol')).toHaveAttribute('data-met', 'false');
  });

  it('botão de salvar começa desabilitado', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /salvar nova senha/i })).toBeDisabled();
  });
});

describe('MinhaConta — validação em tempo real', () => {
  it('marca critérios como atendidos conforme o user digita uma senha forte', async () => {
    const user = userEvent.setup();
    renderPage();

    const newInput = screen.getByLabelText(/^nova senha$/i);
    await user.type(newInput, 'Senha@123');

    await waitFor(() => {
      expect(screen.getByTestId('criterion-minLength')).toHaveAttribute('data-met', 'true');
      expect(screen.getByTestId('criterion-uppercase')).toHaveAttribute('data-met', 'true');
      expect(screen.getByTestId('criterion-lowercase')).toHaveAttribute('data-met', 'true');
      expect(screen.getByTestId('criterion-number')).toHaveAttribute('data-met', 'true');
      expect(screen.getByTestId('criterion-symbol')).toHaveAttribute('data-met', 'true');
    });
  });

  it('botão fica habilitado quando senha é forte e confirmação bate', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^nova senha$/i), 'Senha@123');
    await user.type(screen.getByLabelText(/confirmar nova senha/i), 'Senha@123');

    expect(screen.getByRole('button', { name: /salvar nova senha/i })).toBeEnabled();
  });

  it('botão continua desabilitado quando confirmação não bate', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^nova senha$/i), 'Senha@123');
    await user.type(screen.getByLabelText(/confirmar nova senha/i), 'Outra@456');

    expect(screen.getByRole('button', { name: /salvar nova senha/i })).toBeDisabled();
    expect(screen.getByText(/as senhas não conferem/i)).toBeInTheDocument();
  });

  it('botão continua desabilitado quando senha é fraca mesmo com confirm igual', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^nova senha$/i), 'fraca');
    await user.type(screen.getByLabelText(/confirmar nova senha/i), 'fraca');

    expect(screen.getByRole('button', { name: /salvar nova senha/i })).toBeDisabled();
  });

  it('toggle do olho alterna o tipo do input de password para text', async () => {
    const user = userEvent.setup();
    renderPage();

    const newInput = screen.getByLabelText(/^nova senha$/i) as HTMLInputElement;
    expect(newInput.type).toBe('password');

    const toggles = screen.getAllByRole('button', { name: /mostrar senha/i });
    await user.click(toggles[0]);
    expect(newInput.type).toBe('text');
  });
});

describe('MinhaConta — submit', () => {
  it('chama supabase.auth.updateUser e redireciona após sucesso', async () => {
    const user = userEvent.setup();
    mockUpdateUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null });

    renderPage();
    await user.type(screen.getByLabelText(/^nova senha$/i), 'Senha@123');
    await user.type(screen.getByLabelText(/confirmar nova senha/i), 'Senha@123');
    await user.click(screen.getByRole('button', { name: /salvar nova senha/i }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'Senha@123' });
      expect(toastSuccess).toHaveBeenCalledWith('Senha alterada com sucesso!');
    });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'), { timeout: 2500 });
  });

  it('mostra mensagem traduzida quando Supabase retorna "different from the old"', async () => {
    const user = userEvent.setup();
    mockUpdateUser.mockResolvedValueOnce({
      data: null,
      error: { message: 'New password should be different from the old password.' },
    });

    renderPage();
    await user.type(screen.getByLabelText(/^nova senha$/i), 'Senha@123');
    await user.type(screen.getByLabelText(/confirmar nova senha/i), 'Senha@123');
    await user.click(screen.getByRole('button', { name: /salvar nova senha/i }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('A nova senha precisa ser diferente da atual')
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('mantém form preenchido após erro pra usuário tentar de novo', async () => {
    const user = userEvent.setup();
    mockUpdateUser.mockResolvedValueOnce({
      data: null,
      error: { message: 'Network error' },
    });

    renderPage();
    await user.type(screen.getByLabelText(/^nova senha$/i), 'Senha@123');
    await user.type(screen.getByLabelText(/confirmar nova senha/i), 'Senha@123');
    await user.click(screen.getByRole('button', { name: /salvar nova senha/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());

    expect((screen.getByLabelText(/^nova senha$/i) as HTMLInputElement).value).toBe('Senha@123');
    expect((screen.getByLabelText(/confirmar nova senha/i) as HTMLInputElement).value).toBe(
      'Senha@123'
    );
    expect(screen.getByRole('button', { name: /salvar nova senha/i })).toBeEnabled();
  });
});
