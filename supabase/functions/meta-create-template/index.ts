import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_URL = 'https://graph.facebook.com';

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phone_number?: string;
  }>;
  example?: {
    header_text?: string[];
    body_text?: string[][];
    header_handle?: string[];
  };
}

interface CreateTemplatePayload {
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  components: TemplateComponent[];
  allow_category_change?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Validate authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's tenant
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      throw new Error('Tenant not found');
    }

    const tenantId = profile.tenant_id;

    // Get Cloud API config
    const { data: config, error: configError } = await supabase
      .from('cloudapi_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      throw new Error('No Cloud API configuration found. Please configure Cloud API first.');
    }

    if (!config.waba_id) {
      throw new Error('WABA ID not configured. Please update your Cloud API configuration.');
    }

    const payload: CreateTemplatePayload = await req.json();
    const { name, language, category, components, allow_category_change } = payload;

    // Validate required fields
    if (!name || !language || !category || !components?.length) {
      throw new Error('name, language, category, and components are required');
    }

    // Validate template name format (lowercase letters, numbers, underscores only)
    if (!/^[a-z0-9_]+$/.test(name)) {
      throw new Error('Template name must contain only lowercase letters, numbers, and underscores');
    }

    console.log('[Meta Create Template] Creating template:', name, 'for WABA:', config.waba_id);

    // Build request body
    const templatePayload: any = {
      name,
      language,
      category,
      components,
    };

    if (allow_category_change !== undefined) {
      templatePayload.allow_category_change = allow_category_change;
    }

    // Create template via Meta Graph API
    const response = await fetch(
      `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${config.waba_id}/message_templates`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templatePayload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('[Meta Create Template] Error creating template:', result);
      const errorMessage = result.error?.error_user_msg || result.error?.message || 'Failed to create template';
      throw new Error(errorMessage);
    }

    console.log('[Meta Create Template] Template created:', result);

    // Save template to local database with PENDING status
    const { data: savedTemplate, error: saveError } = await supabase
      .from('meta_message_templates')
      .insert({
        tenant_id: tenantId,
        cloudapi_config_id: config.id,
        meta_template_id: result.id,
        name,
        language,
        category,
        status: 'PENDING',
        components,
        last_synced_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (saveError) {
      console.error('[Meta Create Template] Error saving template locally:', saveError);
      // Don't throw - template was created on Meta, just log the error
    }

    return new Response(
      JSON.stringify({
        success: true,
        template: savedTemplate,
        meta_response: result,
        message: 'Template submitted for approval. Meta usually takes 24-48 hours to review.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[Meta Create Template] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
