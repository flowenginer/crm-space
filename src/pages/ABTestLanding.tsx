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
  // New fields
  status: 'running' | 'paused' | 'completed';
  goal_type: 'visits' | 'leads' | 'time' | null;
  goal_value: number | null;
  goal_reached: boolean;
  end_date: string | null;
  winner_variant_id: string | null;
  auto_winner: boolean;
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
        // Fetch A/B test by slug
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

        const testData = abTest as ABTestData;

        // Check if test is paused
        if (testData.status === 'paused') {
          setError('Este teste A/B está pausado');
          setLoading(false);
          return;
        }

        // Fetch variants with campaign data
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

        const typedVariants = variants as VariantData[];
        let chosenVariant: VariantData | null = null;

        // Check if test is completed and has a winner with auto_winner enabled
        if (testData.status === 'completed' && testData.winner_variant_id && testData.auto_winner) {
          // Redirect 100% to the winner
          chosenVariant = typedVariants.find(v => v.id === testData.winner_variant_id) || null;
        } else {
          // Normal distribution
          chosenVariant = selectVariant(typedVariants, testData.distribution_type);
        }

        if (!chosenVariant?.campaign?.slug) {
          setError('Campanha não encontrada');
          setLoading(false);
          return;
        }

        // Increment views for test and variant
        await Promise.all([
          supabase
            .from('redirect_ab_tests')
            .update({ total_views: (testData.total_views || 0) + 1 })
            .eq('id', testData.id),
          supabase
            .from('redirect_ab_test_variants')
            .update({ views_count: (chosenVariant.views_count || 0) + 1 })
            .eq('id', chosenVariant.id)
        ]);

        // Check if goal was reached after this view
        if (testData.goal_type === 'visits' && testData.goal_value && !testData.goal_reached) {
          const totalViews = typedVariants.reduce((sum, v) => sum + (v.views_count || 0), 0) + 1;
          if (totalViews >= testData.goal_value) {
            // Goal reached - determine winner and update test
            const winner = findBestVariant(typedVariants);
            if (winner) {
              await supabase
                .from('redirect_ab_tests')
                .update({ 
                  goal_reached: true, 
                  status: testData.auto_winner ? 'completed' : testData.status,
                  winner_variant_id: testData.auto_winner ? winner.id : null
                })
                .eq('id', testData.id);
            }
          }
        }

        // Check if time-based goal has expired
        if (testData.goal_type === 'time' && testData.end_date && !testData.goal_reached) {
          const endDate = new Date(testData.end_date);
          if (new Date() >= endDate) {
            const winner = findBestVariant(typedVariants);
            if (winner) {
              await supabase
                .from('redirect_ab_tests')
                .update({ 
                  goal_reached: true, 
                  status: testData.auto_winner ? 'completed' : testData.status,
                  winner_variant_id: testData.auto_winner ? winner.id : null
                })
                .eq('id', testData.id);
            }
          }
        }

        // Preserve UTM params
        const utmParams = new URLSearchParams();
        searchParams.forEach((value, key) => {
          utmParams.set(key, value);
        });
        
        // Add A/B test tracking params
        utmParams.set('ab_test_id', testData.id);
        utmParams.set('ab_variant_id', chosenVariant.id);

        const campaignUrl = `/r/${chosenVariant.campaign.slug}${utmParams.toString() ? '?' + utmParams.toString() : ''}`;
        
        // Use replace to not create history entry
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

// Function to select variant based on weights
function selectVariant(variants: VariantData[], distributionType: string): VariantData | null {
  if (variants.length === 0) return null;
  if (variants.length === 1) return variants[0];

  if (distributionType === 'equal') {
    // Equal distribution: random selection
    const randomIndex = Math.floor(Math.random() * variants.length);
    return variants[randomIndex];
  }

  // Weighted distribution
  const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 0), 0);
  if (totalWeight === 0) {
    // Fallback to equal distribution if all weights are 0
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

  // Fallback: return last variant
  return variants[variants.length - 1];
}

// Function to find best performing variant (highest conversion rate)
function findBestVariant(variants: VariantData[]): VariantData | null {
  if (variants.length === 0) return null;
  
  return variants.reduce((best, current) => {
    const currentRate = current.views_count > 0 ? (current.leads_count / current.views_count) : 0;
    const bestRate = best.views_count > 0 ? (best.leads_count / best.views_count) : 0;
    return currentRate > bestRate ? current : best;
  }, variants[0]);
}
