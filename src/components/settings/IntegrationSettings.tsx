import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CreditCard, Truck, Facebook, MessageCircle, Package, Phone, Instagram } from 'lucide-react';
import { usePaymentGatewayConfig } from '@/hooks/usePaymentLinks';
import { useShippingConfig } from '@/hooks/useShippingConfig';
import { useBlingConfig } from '@/hooks/useBlingIntegration';
import { useCloudAPIConfig } from '@/hooks/useCloudAPIConfig';
import { useInstagramConfig } from '@/hooks/useInstagramConfig';
import { toast } from 'sonner';
import {
  IntegrationCard,
  IntegrationModal,
  RedePaymentForm,
  MelhorEnvioForm,
  MetaAdsForm,
  WhatsAppProviderForm,
  BlingIntegrationForm,
  CloudAPIConfigForm,
  InstagramConfigForm,
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

type IntegrationType = 'rede' | 'melhor-envio' | 'meta-ads' | 'bling' | 'cloudapi' | 'instagram' | string | null;

export function IntegrationSettings() {
  const [searchParams] = useSearchParams();
  const [openModal, setOpenModal] = useState<IntegrationType>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderWithConfig | null>(null);

  // Fetch Bling config
  const { data: blingConfig } = useBlingConfig();

  // Fetch Cloud API config
  const { data: cloudAPIConfig } = useCloudAPIConfig();
  const { data: instagramConfig } = useInstagramConfig();
  useEffect(() => {
    const blingParam = searchParams.get('bling');
    if (blingParam === 'callback') {
      const success = searchParams.get('success');
      if (success === 'true') {
        toast.success('Bling conectado com sucesso!');
        setOpenModal('bling');
      }
    }
  }, [searchParams]);

  // Fetch payment gateway config
  const { data: paymentConfig } = usePaymentGatewayConfig();
  
  // Fetch shipping config
  const { config: shippingConfig } = useShippingConfig();

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
    <div className="space-y-4">
      {/* Single unified grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
        {/* Pagamentos */}
        <IntegrationCard
          icon={CreditCard}
          name="Rede"
          description="Cartão e PIX"
          category="Pagamento"
          isConfigured={!!paymentConfig?.is_configured}
          color="#FF6600"
          onClick={() => setOpenModal('rede')}
        />

        {/* Frete */}
        <IntegrationCard
          icon={Truck}
          name="Melhor Envio"
          description={shippingConfig?.is_configured ? (shippingConfig?.environment === 'production' ? 'Produção' : 'Sandbox') : 'Múltiplas transportadoras'}
          category="Frete"
          isConfigured={!!shippingConfig?.is_configured}
          color="#00a650"
          onClick={() => setOpenModal('melhor-envio')}
        />

        {/* Marketing */}
        <IntegrationCard
          icon={Facebook}
          name="Meta Ads"
          description={metaAccounts.length > 0 
            ? `${metaAccounts.length} conta(s)` 
            : "Campanhas"}
          category="Marketing"
          isConfigured={metaAccounts.length > 0}
          color="#1877F2"
          onClick={() => setOpenModal('meta-ads')}
        />

        {/* ERP - Bling */}
        <IntegrationCard
          icon={Package}
          name="Bling ERP"
          description={blingConfig?.is_configured ? 'Conectado' : 'ERP completo'}
          category="ERP"
          isConfigured={!!blingConfig?.is_configured}
          color="#0066CC"
          onClick={() => setOpenModal('bling')}
        />

        {/* Cloud API - API Oficial WhatsApp */}
        <IntegrationCard
          icon={Phone}
          name="Cloud API"
          description={cloudAPIConfig ? 'Conectado' : 'API Oficial'}
          category="WhatsApp"
          isConfigured={!!cloudAPIConfig}
          color="#25D366"
          onClick={() => setOpenModal('cloudapi')}
        />

        {/* WhatsApp Providers */}
        {providers?.map((provider) => (
          <IntegrationCard
            key={provider.id}
            icon={MessageCircle}
            name={provider.name}
            description={provider.code.toUpperCase()}
            category="WhatsApp"
            isConfigured={!!provider.is_configured}
            color={getProviderColor(provider.code)}
            onClick={() => handleOpenProvider(provider)}
          />
        ))}
      </div>

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

      <IntegrationModal
        open={openModal === 'bling'}
        onOpenChange={(open) => !open && setOpenModal(null)}
        icon={Package}
        name="Bling ERP"
        color="#0066CC"
      >
        <BlingIntegrationForm onSuccess={handleCloseModal} />
      </IntegrationModal>

      <IntegrationModal
        open={openModal === 'cloudapi'}
        onOpenChange={(open) => !open && setOpenModal(null)}
        icon={Phone}
        name="Cloud API (API Oficial)"
        color="#25D366"
      >
        <CloudAPIConfigForm onSuccess={handleCloseModal} />
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
