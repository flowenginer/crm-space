import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_URL = 'https://graph.facebook.com';

interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: any[];
  quality_score?: {
    score: string;
    date: number;
  };
  rejected_reason?: string;
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

    console.log('[Meta Templates] Fetching templates for WABA:', config.waba_id);

    // Fetch templates from Meta Graph API
    const response = await fetch(
      `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${config.waba_id}/message_templates?fields=id,name,status,category,language,components,quality_score,rejected_reason&limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('[Meta Templates] Error fetching templates:', result);
      throw new Error(result.error?.message || 'Failed to fetch templates from Meta');
    }

    console.log('[Meta Templates] Fetched templates count:', result.data?.length || 0);

    const templates: MetaTemplate[] = result.data || [];

    // Sync templates to local database
    for (const template of templates) {
      const templateData = {
        tenant_id: tenantId,
        cloudapi_config_id: config.id,
        meta_template_id: template.id,
        name: template.name,
        language: template.language,
        category: template.category,
        status: template.status,
        components: template.components,
        quality_score: template.quality_score?.score || null,
        rejection_reason: template.rejected_reason || null,
        last_synced_at: new Date().toISOString(),
      };

      // Upsert template
      const { error: upsertError } = await supabase
        .from('meta_message_templates')
        .upsert(templateData, {
          onConflict: 'tenant_id,name,language',
        });

      if (upsertError) {
        console.error('[Meta Templates] Error upserting template:', template.name, upsertError);
      }
    }

    // Mark templates as DELETED if they no longer exist in Meta
    const metaTemplateKeys = templates.map(t => `${t.name}_${t.language}`);
    
    const { data: localTemplates } = await supabase
      .from('meta_message_templates')
      .select('id, name, language, status')
      .eq('tenant_id', tenantId)
      .eq('cloudapi_config_id', config.id);

    let deletedCount = 0;
    for (const local of localTemplates || []) {
      const key = `${local.name}_${local.language}`;
      
      // If not returned from Meta and not already DELETED
      if (!metaTemplateKeys.includes(key) && 
          local.status !== 'DELETED') {
        
        const { error: deleteError } = await supabase
          .from('meta_message_templates')
          .update({ 
            status: 'DELETED',
            last_synced_at: new Date().toISOString()
          })
          .eq('id', local.id);

        if (!deleteError) {
          deletedCount++;
          console.log('[Meta Templates] Marked as deleted:', local.name);
        }
      }
    }

    console.log('[Meta Templates] Marked as deleted count:', deletedCount);

    // Get synced templates from database
    const { data: syncedTemplates, error: fetchError } = await supabase
      .from('meta_message_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        templates: syncedTemplates,
        meta_count: templates.length,
        synced_count: syncedTemplates?.length || 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[Meta Templates] Error:', error);
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
