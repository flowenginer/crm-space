import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PackagingType = 'stack' | 'box' | 'side_by_side' | 'layered' | 'custom';

interface ShippingProduct {
  weight: number;
  height: number;
  width: number;
  length: number;
  quantity: number;
  insurance_value?: number;
  packaging_type?: PackagingType;
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

/**
 * Calculate package dimensions based on packaging type
 * Each type has a different strategy for combining multiple items
 */
function calculateDimensions(products: ShippingProduct[]): {
  height: number;
  width: number;
  length: number;
  weight: number;
  insuranceValue: number;
  packagingType: string;
} {
  let totalWeight = 0;
  let totalInsuranceValue = 0;
  
  // Group products by packaging type
  const productsByType: Record<PackagingType, ShippingProduct[]> = {
    stack: [],
    box: [],
    side_by_side: [],
    layered: [],
    custom: []
  };
  
  for (const product of products) {
    const type = product.packaging_type || 'stack';
    productsByType[type].push(product);
    totalWeight += (product.weight || 0.3) * (product.quantity || 1);
    totalInsuranceValue += (product.insurance_value || 0) * (product.quantity || 1);
  }
  
  // Calculate dimensions for each packaging type
  let finalHeight = 0;
  let finalWidth = 0;
  let finalLength = 0;
  let dominantType = 'stack';
  
  // STACK: Heights are summed, width/length take maximum
  // Ideal for: shirts, books, plates, towels, documents
  if (productsByType.stack.length > 0) {
    dominantType = 'stack';
    let stackHeight = 0;
    let stackMaxWidth = 0;
    let stackMaxLength = 0;
    
    for (const p of productsByType.stack) {
      const qty = p.quantity || 1;
      stackHeight += (p.height || 2) * qty;
      stackMaxWidth = Math.max(stackMaxWidth, p.width || 20);
      stackMaxLength = Math.max(stackMaxLength, p.length || 20);
    }
    
    finalHeight = Math.max(finalHeight, stackHeight);
    finalWidth = Math.max(finalWidth, stackMaxWidth);
    finalLength = Math.max(finalLength, stackMaxLength);
    
    console.log(`STACK calculation: ${stackHeight}h x ${stackMaxWidth}w x ${stackMaxLength}l`);
  }
  
  // BOX: Total volume distributed in cubic format
  // Ideal for: electronics, appliances, fragile items in boxes
  if (productsByType.box.length > 0) {
    dominantType = 'box';
    let totalVolume = 0;
    
    for (const p of productsByType.box) {
      const qty = p.quantity || 1;
      const h = p.height || 10;
      const w = p.width || 10;
      const l = p.length || 10;
      totalVolume += (h * w * l) * qty;
    }
    
    // Distribute volume in cubic format (cube root)
    const cubicDimension = Math.cbrt(totalVolume);
    const boxDim = Math.ceil(cubicDimension);
    
    finalHeight = Math.max(finalHeight, boxDim);
    finalWidth = Math.max(finalWidth, boxDim);
    finalLength = Math.max(finalLength, boxDim);
    
    console.log(`BOX calculation: volume=${totalVolume}, cubic=${boxDim}cm each side`);
  }
  
  // SIDE_BY_SIDE: Widths are summed, height/length take maximum
  // Ideal for: bottles, vases, lamps, trophies
  if (productsByType.side_by_side.length > 0) {
    dominantType = 'side_by_side';
    let sideMaxHeight = 0;
    let sideTotalWidth = 0;
    let sideMaxLength = 0;
    
    for (const p of productsByType.side_by_side) {
      const qty = p.quantity || 1;
      sideMaxHeight = Math.max(sideMaxHeight, p.height || 10);
      sideTotalWidth += (p.width || 10) * qty;
      sideMaxLength = Math.max(sideMaxLength, p.length || 10);
    }
    
    finalHeight = Math.max(finalHeight, sideMaxHeight);
    finalWidth = Math.max(finalWidth, sideTotalWidth);
    finalLength = Math.max(finalLength, sideMaxLength);
    
    console.log(`SIDE_BY_SIDE calculation: ${sideMaxHeight}h x ${sideTotalWidth}w x ${sideMaxLength}l`);
  }
  
  // LAYERED: Products organized in optimized grid layers
  // Ideal for: cosmetics, chocolates, jewelry, accessories
  if (productsByType.layered.length > 0) {
    dominantType = 'layered';
    
    for (const p of productsByType.layered) {
      const qty = p.quantity || 1;
      const h = p.height || 5;
      const w = p.width || 5;
      const l = p.length || 5;
      
      // Calculate optimal grid layout
      const itemsPerLayer = Math.ceil(Math.sqrt(qty));
      const layers = Math.ceil(qty / (itemsPerLayer * itemsPerLayer));
      
      const layerHeight = h * layers;
      const layerWidth = w * itemsPerLayer;
      const layerLength = l * itemsPerLayer;
      
      finalHeight = Math.max(finalHeight, layerHeight);
      finalWidth = Math.max(finalWidth, layerWidth);
      finalLength = Math.max(finalLength, layerLength);
      
      console.log(`LAYERED calculation: ${itemsPerLayer}x${itemsPerLayer} grid, ${layers} layers = ${layerHeight}h x ${layerWidth}w x ${layerLength}l`);
    }
  }
  
  // CUSTOM: Exact dimensions × quantity (for pre-packaged items)
  // Ideal for: ready kits, combos, master boxes
  if (productsByType.custom.length > 0) {
    dominantType = 'custom';
    
    for (const p of productsByType.custom) {
      const qty = p.quantity || 1;
      const h = (p.height || 10) * qty;
      const w = p.width || 10;
      const l = p.length || 10;
      
      finalHeight = Math.max(finalHeight, h);
      finalWidth = Math.max(finalWidth, w);
      finalLength = Math.max(finalLength, l);
      
      console.log(`CUSTOM calculation: ${h}h x ${w}w x ${l}l (qty=${qty})`);
    }
  }
  
  // Limit insurance value to carrier maximum (Correios SEDEX limit)
  const maxInsuranceValue = 38000;
  totalInsuranceValue = Math.min(totalInsuranceValue, maxInsuranceValue);
  
  return {
    height: finalHeight,
    width: finalWidth,
    length: finalLength,
    weight: totalWeight,
    insuranceValue: totalInsuranceValue,
    packagingType: dominantType
  };
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

    // Calculate package dimensions based on packaging types
    const dimensions = calculateDimensions(products);
    
    console.log('Calculated dimensions:', dimensions);

    // Apply minimum dimensions required by carriers
    const finalHeight = Math.max(dimensions.height, 2);
    const finalWidth = Math.max(dimensions.width, 11);
    const finalLength = Math.max(dimensions.length, 16);
    const finalWeight = Math.max(dimensions.weight, 0.3);

    const apiBody: Record<string, unknown> = {
      from: { postal_code: cleanFromPostal },
      to: { postal_code: cleanToPostal },
      products: [{
        id: 'package',
        width: Math.round(finalWidth),
        height: Math.round(finalHeight),
        length: Math.round(finalLength),
        weight: Number(finalWeight.toFixed(2)),
        insurance_value: dimensions.insuranceValue,
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
          insurance_value: dimensions.insuranceValue,
          packaging_type: dimensions.packagingType,
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