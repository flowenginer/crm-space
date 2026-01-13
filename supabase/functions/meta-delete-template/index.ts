import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_URL = 'https://graph.facebook.com';

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

    const { templateId, templateName } = await req.json();

    if (!templateId && !templateName) {
      throw new Error('templateId or templateName is required');
    }

    // Get Cloud API config
    const { data: config, error: configError } = await supabase
      .from('cloudapi_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      throw new Error('No Cloud API configuration found');
    }

    if (!config.waba_id) {
      throw new Error('WABA ID not configured');
    }

    console.log('[Meta Delete Template] Deleting template:', templateName || templateId);

    // Delete from Meta Graph API
    const deleteUrl = templateName
      ? `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${config.waba_id}/message_templates?name=${encodeURIComponent(templateName)}`
      : `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${config.waba_id}/message_templates?hsm_id=${templateId}`;

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[Meta Delete Template] Error:', result);
      throw new Error(result.error?.message || 'Failed to delete template');
    }

    // Delete from local database
    if (templateName) {
      await supabase
        .from('meta_message_templates')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('name', templateName);
    } else if (templateId) {
      await supabase
        .from('meta_message_templates')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('meta_template_id', templateId);
    }

    console.log('[Meta Delete Template] Template deleted successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Template deleted successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[Meta Delete Template] Error:', error);
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
