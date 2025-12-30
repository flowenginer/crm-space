import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface ABTestData {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  distribution_type: 'equal' | 'weighted';
  total_views: number;
  tenant_id: string;
}

interface VariantData {
  id: string;
  ab_test_id: string;
  campaign_id: string;
  weight: number;
  views_count: number;
  leads_count: number;
  campaign: {
    id: string;
    slug: string;
    name: string;
  };
}

export default function ABTestLanding() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processABTest = async () => {
      if (!slug) {
        setError('Teste A/B não encontrado');
        setLoading(false);
        return;
      }

      try {
        // Buscar teste A/B pelo slug
        const { data: abTest, error: abTestError } = await supabase
          .from('redirect_ab_tests')
          .select('*')
          .eq('slug', slug)
          .eq('is_active', true)
          .single();

        if (abTestError || !abTest) {
          setError('Teste A/B não encontrado ou inativo');
          setLoading(false);
          return;
        }

        // Buscar variantes com dados da campanha
        const { data: variants, error: variantsError } = await supabase
          .from('redirect_ab_test_variants')
          .select(`
            *,
            campaign:redirect_campaigns(id, slug, name)
          `)
          .eq('ab_test_id', abTest.id);

        if (variantsError || !variants || variants.length === 0) {
          setError('Nenhuma variante configurada para este teste');
          setLoading(false);
          return;
        }

        // Escolher variante baseado nos pesos
        const chosenVariant = selectVariant(variants as VariantData[], abTest.distribution_type);

        if (!chosenVariant?.campaign?.slug) {
          setError('Campanha não encontrada');
          setLoading(false);
          return;
        }

        // Incrementar views do teste e da variante
        await Promise.all([
          supabase
            .from('redirect_ab_tests')
            .update({ total_views: (abTest.total_views || 0) + 1 })
            .eq('id', abTest.id),
          supabase
            .from('redirect_ab_test_variants')
            .update({ views_count: (chosenVariant.views_count || 0) + 1 })
            .eq('id', chosenVariant.id)
        ]);

        // Redirecionar para a landing page da campanha escolhida
        // Preservar UTMs
        const utmParams = new URLSearchParams();
        searchParams.forEach((value, key) => {
          utmParams.set(key, value);
        });
        
        // Adicionar parâmetro para rastrear que veio de um teste A/B
        utmParams.set('ab_test_id', abTest.id);
        utmParams.set('ab_variant_id', chosenVariant.id);

        const campaignUrl = `/r/${chosenVariant.campaign.slug}${utmParams.toString() ? '?' + utmParams.toString() : ''}`;
        
        // Usar replace para não criar entrada no histórico
        navigate(campaignUrl, { replace: true });

      } catch (err) {
        console.error('Erro ao processar teste A/B:', err);
        setError('Erro ao carregar a página');
        setLoading(false);
      }
    };

    processABTest();
  }, [slug, navigate, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Redirecionando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Página não encontrada</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return null;
}

// Função para selecionar variante baseado nos pesos
function selectVariant(variants: VariantData[], distributionType: string): VariantData | null {
  if (variants.length === 0) return null;
  if (variants.length === 1) return variants[0];

  if (distributionType === 'equal') {
    // Distribuição igual: escolhe aleatoriamente
    const randomIndex = Math.floor(Math.random() * variants.length);
    return variants[randomIndex];
  }

  // Distribuição por peso
  const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 0), 0);
  if (totalWeight === 0) {
    // Fallback para distribuição igual se todos os pesos forem 0
    const randomIndex = Math.floor(Math.random() * variants.length);
    return variants[randomIndex];
  }

  const random = Math.random() * totalWeight;
  let accumulated = 0;

  for (const variant of variants) {
    accumulated += variant.weight || 0;
    if (random <= accumulated) {
      return variant;
    }
  }

  // Fallback: retorna a última variante
  return variants[variants.length - 1];
}
