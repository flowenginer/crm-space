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
  background_image_url: string | null;
  background_image_opacity: number | null;
  background_image_position: string | null;
  // Campos de rastreamento/pixels
  facebook_pixel_id: string | null;
  gtm_container_id: string | null;
  google_analytics_id: string | null;
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

  // Gerar visitor_id único para rastrear visualizações (persistente via localStorage)
  const generateVisitorId = () => {
    const stored = localStorage.getItem('redirect_visitor_id');
    if (stored) return stored;
    
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem('redirect_visitor_id', id);
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

        // Registrar visualização única (visitante único por dispositivo)
        const visitorId = generateVisitorId();
        const { error: viewError } = await supabase
          .from('redirect_campaign_views')
          .upsert(
            { 
              campaign_id: data.id, 
              visitor_id: visitorId,
              tenant_id: data.tenant_id,
              utm_source: utms.utm_source,
              utm_medium: utms.utm_medium,
              utm_campaign: utms.utm_campaign,
              utm_term: utms.utm_term,
              utm_content: utms.utm_content,
              referrer: document.referrer || null,
              user_agent: navigator.userAgent || null,
            },
            { onConflict: 'campaign_id,visitor_id', ignoreDuplicates: true }
          );

        if (viewError) {
          console.error('[RedirectLanding] Erro ao registrar view única:', viewError);
        }

        // Registrar pageview (cada acesso conta)
        const { error: pageviewError } = await supabase
          .from('redirect_campaign_pageviews')
          .insert({
            campaign_id: data.id,
            visitor_id: visitorId,
            tenant_id: data.tenant_id,
            utm_source: utms.utm_source,
            utm_medium: utms.utm_medium,
            utm_campaign: utms.utm_campaign,
            utm_term: utms.utm_term,
            utm_content: utms.utm_content,
            referrer: document.referrer || null,
            user_agent: navigator.userAgent || null,
          });

        if (pageviewError) {
          console.error('[RedirectLanding] Erro ao registrar pageview:', pageviewError);
        }
      } catch (err) {
        console.error('Erro ao carregar campanha:', err);
        setError('Erro ao carregar a página');
      } finally {
        setLoading(false);
      }
    };

    loadCampaign();
  }, [slug]);

  // Injetar scripts de rastreamento (Facebook Pixel, GTM, GA4)
  useEffect(() => {
    if (!campaign) return;

    // Facebook Pixel
    if (campaign.facebook_pixel_id) {
      const fbScript = document.createElement('script');
      fbScript.innerHTML = `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${campaign.facebook_pixel_id}');
        fbq('track', 'PageView');
      `;
      document.head.appendChild(fbScript);
    }

    // Google Tag Manager
    if (campaign.gtm_container_id) {
      const gtmScript = document.createElement('script');
      gtmScript.innerHTML = `
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${campaign.gtm_container_id}');
      `;
      document.head.appendChild(gtmScript);

      // noscript fallback
      const noscript = document.createElement('noscript');
      noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${campaign.gtm_container_id}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
      document.body.insertBefore(noscript, document.body.firstChild);
    }

    // Google Analytics 4
    if (campaign.google_analytics_id) {
      const gaScript = document.createElement('script');
      gaScript.async = true;
      gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${campaign.google_analytics_id}`;
      document.head.appendChild(gaScript);

      const gaConfigScript = document.createElement('script');
      gaConfigScript.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${campaign.google_analytics_id}');
      `;
      document.head.appendChild(gaConfigScript);
    }
  }, [campaign]);

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

      // Disparar eventos de conversão
      // Facebook Pixel - Lead event
      if (campaign.facebook_pixel_id && (window as any).fbq) {
        (window as any).fbq('track', 'Lead', {
          content_name: campaign.name,
          content_category: 'redirect_campaign',
        });
      }

      // Google Analytics 4 - generate_lead event
      if (campaign.google_analytics_id && (window as any).gtag) {
        (window as any).gtag('event', 'generate_lead', {
          campaign_name: campaign.name,
          campaign_id: campaign.id,
        });
      }

      // GTM DataLayer - lead_captured event
      if (campaign.gtm_container_id && (window as any).dataLayer) {
        (window as any).dataLayer.push({
          event: 'lead_captured',
          campaign_name: campaign.name,
          campaign_id: campaign.id,
        });
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
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{ backgroundColor: campaign.background_color }}
    >
      {/* Imagem de fundo como marca d'água */}
      {campaign.background_image_url && (
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${campaign.background_image_url})`,
            backgroundSize: campaign.background_image_position === 'repeat' ? 'auto' : 
                            campaign.background_image_position === 'contain' ? 'contain' : 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: campaign.background_image_position === 'repeat' ? 'repeat' : 'no-repeat',
            opacity: campaign.background_image_opacity || 0.3,
          }}
        />
      )}
      <div className="w-full max-w-md relative z-10">
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
