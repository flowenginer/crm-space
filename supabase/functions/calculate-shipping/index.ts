import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShippingProduct {
  weight: number; // kg
  height: number; // cm
  width: number;  // cm
  length: number; // cm
  quantity: number;
  insurance_value?: number;
}

interface ShippingRequest {
  from_postal_code: string;
  to_postal_code: string;
  products: ShippingProduct[];
  services?: string; // comma separated service IDs
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get('MELHOR_ENVIO_TOKEN');
    
    if (!token) {
      console.error('MELHOR_ENVIO_TOKEN not configured');
      return new Response(
        JSON.stringify({ 
          error: 'Token do Melhor Envio não configurado',
          code: 'TOKEN_NOT_CONFIGURED'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const body: ShippingRequest = await req.json();
    console.log('Shipping request:', JSON.stringify(body, null, 2));

    const { from_postal_code, to_postal_code, products, services } = body;

    // Validate required fields
    if (!from_postal_code || !to_postal_code) {
      return new Response(
        JSON.stringify({ 
          error: 'CEP de origem e destino são obrigatórios',
          code: 'MISSING_POSTAL_CODES'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Pelo menos um produto é obrigatório',
          code: 'MISSING_PRODUCTS'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Clean postal codes (remove non-numeric characters)
    const cleanFromPostal = from_postal_code.replace(/\D/g, '');
    const cleanToPostal = to_postal_code.replace(/\D/g, '');

    // Validate CEP format
    if (cleanFromPostal.length !== 8 || cleanToPostal.length !== 8) {
      return new Response(
        JSON.stringify({ 
          error: 'CEP inválido. O CEP deve ter 8 dígitos.',
          code: 'INVALID_POSTAL_CODE'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Calculate total dimensions for package
    // Using cubagem method for multiple items
    let totalWeight = 0;
    let totalInsuranceValue = 0;
    let maxHeight = 0;
    let maxWidth = 0;
    let totalLength = 0;

    for (const product of products) {
      const qty = product.quantity || 1;
      totalWeight += (product.weight || 0.3) * qty; // Default 300g per item
      totalInsuranceValue += (product.insurance_value || 0) * qty;
      
      // For dimensions, we stack items
      maxHeight = Math.max(maxHeight, product.height || 10);
      maxWidth = Math.max(maxWidth, product.width || 10);
      totalLength += (product.length || 10) * qty;
    }

    // Ensure minimum dimensions (Melhor Envio requirements)
    const finalHeight = Math.max(maxHeight, 2);
    const finalWidth = Math.max(maxWidth, 11);
    const finalLength = Math.max(totalLength, 16);
    const finalWeight = Math.max(totalWeight, 0.3);

    // Prepare request body for Melhor Envio API
    const apiBody: Record<string, unknown> = {
      from: {
        postal_code: cleanFromPostal,
      },
      to: {
        postal_code: cleanToPostal,
      },
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

    // Add services filter if specified
    if (services) {
      apiBody.services = services;
    }

    console.log('Calling Melhor Envio API with:', JSON.stringify(apiBody, null, 2));

    // Call Melhor Envio API
    const response = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/calculate', {
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
        JSON.stringify({ 
          error: errorMessage,
          code: 'API_ERROR',
          status: response.status
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const data: ShippingOption[] = JSON.parse(responseText);

    // Filter out options with errors and format response
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

    // Also include options with errors for debugging
    const errorOptions = data
      .filter(option => option.error)
      .map(option => ({
        id: option.id,
        name: option.name,
        error: option.error,
      }));

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
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: unknown) {
    console.error('Error calculating shipping:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno ao calcular frete';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: 'INTERNAL_ERROR'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
