import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PreOrderBlingModal } from '../PreOrderBlingModal';

// Mock dependencies
vi.mock('@/hooks/usePreOrderBling', () => ({
  useCreatePreOrderBling: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/lib/viaCep', () => ({
  fetchAddressByCep: vi.fn(),
}));

vi.mock('@/lib/parseWhatsAppResponse', () => ({
  parseWhatsAppResponse: vi.fn(() => ({})),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const baseContact = {
  id: 'contact-1',
  full_name: 'João Silva',
  phone: '11999999999',
  email: 'joao@test.com',
  cpf_cnpj: null,
  person_type: 'individual',
  birth_date: null,
  street: null,
  number: null,
  complement: null,
  neighborhood: null,
  zip_code: null,
  city: null,
  state: null,
  custom_fields: null,
};

describe('PreOrderBlingModal', () => {
  it('should enable submit button when only name is filled (address is optional)', () => {
    render(
      <PreOrderBlingModal
        open={true}
        onOpenChange={vi.fn()}
        contact={baseContact}
        conversationId="conv-1"
      />,
    );

    const submitButton = screen.getByText('Criar no Bling').closest('button');
    // Name is pre-filled from contact, so button should be enabled
    expect(submitButton).not.toBeDisabled();
  });

  it('should disable submit button when name is empty', () => {
    const contactNoName = { ...baseContact, full_name: '' };

    render(
      <PreOrderBlingModal
        open={true}
        onOpenChange={vi.fn()}
        contact={contactNoName}
        conversationId="conv-1"
      />,
    );

    const submitButton = screen.getByText('Criar no Bling').closest('button');
    expect(submitButton).toBeDisabled();
  });

  it('should display previous orders badges', () => {
    const contactWithOrders = {
      ...baseContact,
      custom_fields: {
        pedidos_bling: [
          { numero: '1001', data: '2024-01-01' },
          { numero: '1002', data: '2024-02-01' },
        ],
      },
    };

    render(
      <PreOrderBlingModal
        open={true}
        onOpenChange={vi.fn()}
        contact={contactWithOrders}
        conversationId="conv-1"
      />,
    );

    expect(screen.getByText('#1001')).toBeInTheDocument();
    expect(screen.getByText('#1002')).toBeInTheDocument();
  });

  it('should show address fields section', () => {
    render(
      <PreOrderBlingModal
        open={true}
        onOpenChange={vi.fn()}
        contact={baseContact}
        conversationId="conv-1"
      />,
    );

    expect(screen.getByText('Endereço')).toBeInTheDocument();
    expect(screen.getByText('CEP')).toBeInTheDocument();
    expect(screen.getByText('Rua')).toBeInTheDocument();
  });
});
