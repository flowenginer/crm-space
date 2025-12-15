import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CreditCard, Truck, Facebook, MessageCircle } from 'lucide-react';
import { usePaymentGatewayConfig } from '@/hooks/usePaymentLinks';
import {
  IntegrationCard,
  IntegrationModal,
  RedePaymentForm,
  MelhorEnvioForm,
  MetaAdsForm,
  WhatsAppProviderForm,
} from './integrations';

interface ProviderWithConfig {
  id: string;
  name: string;
  code: string;
  base_url: string;
  is_active: boolean;
  admin_token?: string | null;
  client_token?: string | null;
  is_configured?: boolean;
}

type IntegrationType = 'rede' | 'melhor-envio' | 'meta-ads' | string | null;

export function IntegrationSettings() {
  const [openModal, setOpenModal] = useState<IntegrationType>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderWithConfig | null>(null);

  // Fetch payment gateway config
  const { data: paymentConfig } = usePaymentGatewayConfig();

  // Fetch Meta accounts count
  const { data: metaAccounts = [] } = useQuery({
    queryKey: ['meta-accounts-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_ad_accounts')
        .select('id')
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch WhatsApp providers
  const { data: providers, isLoading } = useQuery({
    queryKey: ['providers-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_providers')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as ProviderWithConfig[];
    },
  });

  const handleOpenProvider = (provider: ProviderWithConfig) => {
    setSelectedProvider(provider);
    setOpenModal(provider.id);
  };

  const handleCloseModal = () => {
    setOpenModal(null);
    setSelectedProvider(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getProviderColor = (code: string) => {
    switch (code) {
      case 'zapi':
        return '#25D366';
      case 'uazapi':
        return '#0088cc';
      case 'evolution':
        return '#7c3aed';
      default:
        return '#25D366';
    }
  };

  return (
    <div className="space-y-8">
      {/* Pagamentos Section */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Pagamentos
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <IntegrationCard
            icon={CreditCard}
            name="Rede"
            description="Gateway para cartão e PIX"
            isConfigured={!!paymentConfig?.is_configured}
            color="#FF6600"
            onClick={() => setOpenModal('rede')}
          />
        </div>
      </section>

      {/* Frete Section */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Frete
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <IntegrationCard
            icon={Truck}
            name="Melhor Envio"
            description="Cotação com múltiplas transportadoras"
            isConfigured={false}
            color="#00a650"
            onClick={() => setOpenModal('melhor-envio')}
          />
        </div>
      </section>

      {/* Marketing Section */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Marketing
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <IntegrationCard
            icon={Facebook}
            name="Meta Ads"
            description={metaAccounts.length > 0 
              ? `${metaAccounts.length} conta(s) conectada(s)` 
              : "Sincronize suas campanhas"}
            isConfigured={metaAccounts.length > 0}
            color="#1877F2"
            onClick={() => setOpenModal('meta-ads')}
          />
        </div>
      </section>

      {/* WhatsApp Section */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          WhatsApp
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {providers?.map((provider) => (
            <IntegrationCard
              key={provider.id}
              icon={MessageCircle}
              name={provider.name}
              description={`Provedor ${provider.code.toUpperCase()}`}
              isConfigured={!!provider.is_configured}
              color={getProviderColor(provider.code)}
              onClick={() => handleOpenProvider(provider)}
            />
          ))}
        </div>
      </section>

      {/* Modals */}
      <IntegrationModal
        open={openModal === 'rede'}
        onOpenChange={(open) => !open && setOpenModal(null)}
        icon={CreditCard}
        name="Rede"
        color="#FF6600"
      >
        <RedePaymentForm onSuccess={handleCloseModal} />
      </IntegrationModal>

      <IntegrationModal
        open={openModal === 'melhor-envio'}
        onOpenChange={(open) => !open && setOpenModal(null)}
        icon={Truck}
        name="Melhor Envio"
        color="#00a650"
      >
        <MelhorEnvioForm />
      </IntegrationModal>

      <IntegrationModal
        open={openModal === 'meta-ads'}
        onOpenChange={(open) => !open && setOpenModal(null)}
        icon={Facebook}
        name="Meta Ads"
        color="#1877F2"
      >
        <MetaAdsForm />
      </IntegrationModal>

      {selectedProvider && (
        <IntegrationModal
          open={openModal === selectedProvider.id}
          onOpenChange={(open) => !open && handleCloseModal()}
          icon={MessageCircle}
          name={selectedProvider.name}
          color={getProviderColor(selectedProvider.code)}
        >
          <WhatsAppProviderForm 
            provider={selectedProvider} 
            onSuccess={handleCloseModal}
          />
        </IntegrationModal>
      )}
    </div>
  );
}
