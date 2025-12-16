import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShippingProduct {
  weight: number;
  height: number;
  width: number;
  length: number;
  quantity: number;
  insurance_value?: number;
}

interface ShippingRequest {
  from_postal_code: string;
  to_postal_code: string;
  products: ShippingProduct[];
  services?: string;
  _test_token?: string;
  _test_environment?: 'sandbox' | 'production';
}

interface ShippingOption {
  id: number;
  name: string;
  company: {
    id: number;
    name: string;
    picture: string;
  };
  price: string;
  custom_price: string;
  discount: string;
  currency: string;
  delivery_time: number;
  delivery_range: {
    min: number;
    max: number;
  };
  custom_delivery_time: number;
  custom_delivery_range: {
    min: number;
    max: number;
  };
  packages: Array<{
    price: string;
    discount: string;
    format: string;
    dimensions: {
      height: number;
      width: number;
      length: number;
    };
    weight: string;
    insurance_value: string;
  }>;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ShippingRequest = await req.json();
    console.log('Shipping request:', JSON.stringify(body, null, 2));

    const { from_postal_code, to_postal_code, products, services, _test_token, _test_environment } = body;

    // Get token - priority: test token > database > env variable
    let token = _test_token;
    let environment: 'sandbox' | 'production' = _test_environment || 'production';

    if (!token) {
      // Try to get from database
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: settings } = await supabase
        .from('company_settings')
        .select('shipping_config')
        .maybeSingle();

      if (settings?.shipping_config) {
        const config = settings.shipping_config as { token?: string; environment?: 'sandbox' | 'production' };
        token = config.token;
        environment = config.environment || 'production';
      }
    }

    // Fallback to env variable
    if (!token) {
      token = Deno.env.get('MELHOR_ENVIO_TOKEN');
    }
    
    if (!token) {
      console.error('Melhor Envio token not configured');
      return new Response(
        JSON.stringify({ 
          error: 'Token do Melhor Envio não configurado. Configure na página de Integrações.',
          code: 'TOKEN_NOT_CONFIGURED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    // Validate required fields
    if (!from_postal_code || !to_postal_code) {
      return new Response(
        JSON.stringify({ error: 'CEP de origem e destino são obrigatórios', code: 'MISSING_POSTAL_CODES' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Pelo menos um produto é obrigatório', code: 'MISSING_PRODUCTS' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    const cleanFromPostal = from_postal_code.replace(/\D/g, '');
    const cleanToPostal = to_postal_code.replace(/\D/g, '');

    if (cleanFromPostal.length !== 8 || cleanToPostal.length !== 8) {
      return new Response(
        JSON.stringify({ error: 'CEP inválido. O CEP deve ter 8 dígitos.', code: 'INVALID_POSTAL_CODE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    // Calculate package dimensions with stacking logic
    // Height is SUMMED (stacking products on top of each other)
    // Width and Length take the MAXIMUM value (base dimensions)
    let totalWeight = 0;
    let totalInsuranceValue = 0;
    let totalHeight = 0;  // Heights are summed (stacking)
    let maxWidth = 0;     // Width is the maximum value
    let maxLength = 0;    // Length is the maximum value

    for (const product of products) {
      const qty = product.quantity || 1;
      totalWeight += (product.weight || 0.3) * qty;
      totalInsuranceValue += (product.insurance_value || 0) * qty;
      totalHeight += (product.height || 2) * qty;  // Stack heights
      maxWidth = Math.max(maxWidth, product.width || 20);
      maxLength = Math.max(maxLength, product.length || 20);
    }

    // Apply minimum dimensions required by carriers and limit insurance
    const finalHeight = Math.max(totalHeight, 2);
    const finalWidth = Math.max(maxWidth, 11);
    const finalLength = Math.max(maxLength, 16);
    const finalWeight = Math.max(totalWeight, 0.3);
    
    // Limit insurance value to carrier maximum (Correios SEDEX limit)
    const maxInsuranceValue = 38000;
    totalInsuranceValue = Math.min(totalInsuranceValue, maxInsuranceValue);

    const apiBody: Record<string, unknown> = {
      from: { postal_code: cleanFromPostal },
      to: { postal_code: cleanToPostal },
      products: [{
        id: 'package',
        width: Math.round(finalWidth),
        height: Math.round(finalHeight),
        length: Math.round(finalLength),
        weight: Number(finalWeight.toFixed(2)),
        insurance_value: totalInsuranceValue,
        quantity: 1,
      }],
    };

    if (services) {
      apiBody.services = services;
    }

    // Use correct API URL based on environment
    const apiUrl = environment === 'sandbox'
      ? 'https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate'
      : 'https://melhorenvio.com.br/api/v2/me/shipment/calculate';

    console.log(`Calling Melhor Envio API (${environment}):`, JSON.stringify(apiBody, null, 2));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'CRM Application (contato@empresa.com)',
      },
      body: JSON.stringify(apiBody),
    });

    const responseText = await response.text();
    console.log('Melhor Envio response status:', response.status);
    console.log('Melhor Envio response:', responseText);

    if (!response.ok) {
      let errorMessage = 'Erro ao consultar frete';
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.errors) {
          errorMessage = Object.values(errorData.errors).flat().join(', ');
        }
      } catch {
        errorMessage = responseText || 'Erro desconhecido';
      }

      return new Response(
        JSON.stringify({ error: errorMessage, code: 'API_ERROR', status: response.status }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    const data: ShippingOption[] = JSON.parse(responseText);

    const validOptions = data
      .filter(option => !option.error)
      .map(option => ({
        id: option.id,
        name: option.name,
        company: option.company?.name || 'Desconhecido',
        companyLogo: option.company?.picture || '',
        price: parseFloat(option.custom_price || option.price),
        originalPrice: parseFloat(option.price),
        discount: parseFloat(option.discount || '0'),
        deliveryDays: option.custom_delivery_time || option.delivery_time,
        deliveryRange: option.custom_delivery_range || option.delivery_range,
        currency: option.currency || 'BRL',
      }))
      .sort((a, b) => a.price - b.price);

    const errorOptions = data
      .filter(option => option.error)
      .map(option => ({ id: option.id, name: option.name, error: option.error }));

    console.log(`Found ${validOptions.length} valid options, ${errorOptions.length} with errors`);

    return new Response(
      JSON.stringify({
        success: true,
        options: validOptions,
        errors: errorOptions,
        package: {
          weight: finalWeight,
          height: finalHeight,
          width: finalWidth,
          length: finalLength,
          insurance_value: totalInsuranceValue,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    );

  } catch (error: unknown) {
    console.error('Error calculating shipping:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno ao calcular frete';
    return new Response(
      JSON.stringify({ error: errorMessage, code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    );
  }
});
