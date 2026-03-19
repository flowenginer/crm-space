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
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
      throw new Error('Tenant not found');
    }

    // Get Cloud API config (need access_token and app_id)
    const { data: config } = await supabase
      .from('cloudapi_configs')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true)
      .single();

    if (!config) {
      throw new Error('No Cloud API configuration found.');
    }

    // Parse the multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('No file provided');
    }

    const fileBytes = await file.arrayBuffer();
    const fileLength = fileBytes.byteLength;
    const fileType = file.type;

    console.log(`[Meta Upload Media] Uploading file: ${file.name}, size: ${fileLength}, type: ${fileType}`);

    // We need the app_id for the upload endpoint.
    // The app_id can be extracted from the access_token or stored in config.
    // Meta's Resumable Upload API uses the app-id from the business account.
    // We'll use the WABA approach: upload via the app associated with the access token.
    
    // Step 1: Create upload session
    // POST /{app-id}/uploads — but we can also use the generic endpoint
    // For simplicity, we use the /uploads endpoint with the access token
    const createSessionResponse = await fetch(
      `${GRAPH_API_URL}/${GRAPH_API_VERSION}/app/uploads`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_length: fileLength,
          file_type: fileType,
          access_token: config.access_token,
        }),
      }
    );

    const sessionResult = await createSessionResponse.json();

    if (!createSessionResponse.ok) {
      console.error('[Meta Upload Media] Error creating upload session:', sessionResult);
      throw new Error(sessionResult.error?.message || 'Failed to create upload session');
    }

    const uploadSessionId = sessionResult.id;
    console.log(`[Meta Upload Media] Upload session created: ${uploadSessionId}`);

    // Step 2: Upload the file binary
    const uploadResponse = await fetch(
      `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${uploadSessionId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `OAuth ${config.access_token}`,
          'file_offset': '0',
          'Content-Type': fileType,
        },
        body: fileBytes,
      }
    );

    const uploadResult = await uploadResponse.json();

    if (!uploadResponse.ok) {
      console.error('[Meta Upload Media] Error uploading file:', uploadResult);
      throw new Error(uploadResult.error?.message || 'Failed to upload file');
    }

    const handle = uploadResult.h;
    console.log(`[Meta Upload Media] Upload complete, handle: ${handle}`);

    return new Response(
      JSON.stringify({
        success: true,
        handle,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[Meta Upload Media] Error:', error);
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
