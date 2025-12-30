import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PhoneInputWithCountry } from '@/components/redirect/PhoneInputWithCountry';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface CampaignData {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  logo_size: number | null;
  title: string;
  subtitle: string | null;
  button_text: string;
  button_color: string;
  background_color: string;
  thank_you_message: string | null;
  is_active: boolean;
  tenant_id: string;
}

interface CaptureResult {
  success: boolean;
  contact_id?: string;
  thank_you_message?: string;
}

export default function RedirectLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();

  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('55');
  const [showThankYou, setShowThankYou] = useState(false);
  const [thankYouMessage, setThankYouMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Extrair UTMs
  const utms = {
    utm_source: searchParams.get('utm_source'),
    utm_medium: searchParams.get('utm_medium'),
    utm_campaign: searchParams.get('utm_campaign'),
    utm_term: searchParams.get('utm_term'),
    utm_content: searchParams.get('utm_content'),
  };

  // Gerar visitor_id único para rastrear visualizações
  const generateVisitorId = () => {
    const stored = sessionStorage.getItem('visitor_id');
    if (stored) return stored;
    
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem('visitor_id', id);
    return id;
  };

  useEffect(() => {
    const loadCampaign = async () => {
      if (!slug) {
        setError('Campanha não encontrada');
        setLoading(false);
        return;
      }

      try {
        // Buscar campanha pública (sem RLS para landing pública)
        const { data, error: fetchError } = await supabase
          .from('redirect_campaigns')
          .select('*')
          .eq('slug', slug)
          .eq('is_active', true)
          .single();

        if (fetchError || !data) {
          setError('Campanha não encontrada ou inativa');
          return;
        }

        setCampaign(data);

        // Registrar visualização única
        const visitorId = generateVisitorId();
        await supabase
          .from('redirect_campaign_views')
          .upsert(
            { 
              campaign_id: data.id, 
              visitor_id: visitorId,
              tenant_id: data.tenant_id
            },
            { onConflict: 'campaign_id,visitor_id', ignoreDuplicates: true }
          );
      } catch (err) {
        console.error('Erro ao carregar campanha:', err);
        setError('Erro ao carregar a página');
      } finally {
        setLoading(false);
      }
    };

    loadCampaign();
  }, [slug]);

  const handlePhoneChange = (fullPhone: string, code: string) => {
    setPhone(fullPhone);
    setCountryCode(code);
  };

  const handleSubmit = async () => {
    if (!campaign || !phone) return;

    setSubmitting(true);

    try {
      const { data, error: captureError } = await supabase.functions.invoke('redirect-capture', {
        body: {
          campaign_id: campaign.id,
          tenant_id: campaign.tenant_id,
          phone,
          country_code: countryCode,
          utms,
          referrer: document.referrer,
          user_agent: navigator.userAgent,
        },
      });

      if (captureError) throw captureError;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao processar');
      }

      // Mostrar mensagem de obrigado
      setThankYouMessage(data.thank_you_message || campaign.thank_you_message || 'Obrigado! Entraremos em contato em breve.');
      setShowThankYou(true);
    } catch (err: any) {
      console.error('Erro ao capturar lead:', err);
      toast.error('Erro ao processar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Página não encontrada</h1>
          <p className="text-gray-600">{error || 'Esta campanha não existe ou foi desativada.'}</p>
        </div>
      </div>
    );
  }

  const logoHeight = campaign.logo_size || 64;

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: campaign.background_color }}
    >
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          {/* Logo com tamanho dinâmico */}
          {campaign.logo_url ? (
            <div 
              className="flex justify-center items-center w-full"
              style={{ height: `${logoHeight}px` }}
            >
              <img 
                src={campaign.logo_url} 
                alt="Logo" 
                style={{ 
                  height: '100%', 
                  width: 'auto',
                  maxWidth: '100%',
                  display: 'block'
                }}
                className="object-contain"
              />
            </div>
          ) : (
            <div className="flex justify-center">
              <div 
                className="rounded-full bg-gray-100 flex items-center justify-center"
                style={{ height: `${logoHeight}px`, width: `${logoHeight}px` }}
              >
                <span 
                  className="font-bold text-gray-400"
                  style={{ fontSize: `${logoHeight / 3}px` }}
                >
                  S
                </span>
              </div>
            </div>
          )}

          {showThankYou ? (
            // Tela de Obrigado
            <div className="text-center space-y-4 py-6">
              <div className="flex justify-center">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Obrigado!</h2>
              <p className="text-gray-600 text-lg">
                {thankYouMessage}
              </p>
            </div>
          ) : (
            <>
              {/* Título */}
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  {campaign.title}
                </h1>
                {campaign.subtitle && (
                  <p className="text-gray-600">{campaign.subtitle}</p>
                )}
              </div>

              {/* Formulário */}
              <PhoneInputWithCountry
                value={phone}
                onChange={handlePhoneChange}
                buttonText={campaign.button_text}
                buttonColor={campaign.button_color}
                onSubmit={handleSubmit}
                disabled={submitting}
              />

              {submitting && (
                <div className="text-center">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                  <p className="text-sm text-gray-500 mt-1">Processando...</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Seus dados estão seguros conosco
        </p>
      </div>
    </div>
  );
}
