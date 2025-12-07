import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SessionRequest {
  userAgent: string;
}

interface GeoData {
  city?: string;
  region?: string;
  country?: string;
}

// Parse User-Agent to extract browser, OS, and device type
function parseUserAgent(userAgent: string) {
  let browser = 'Unknown';
  let os = 'Unknown';
  let deviceType = 'desktop';

  // Detect browser
  if (userAgent.includes('Edg/')) {
    browser = 'Edge';
  } else if (userAgent.includes('Chrome/')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Firefox/')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) {
    browser = 'Safari';
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR/')) {
    browser = 'Opera';
  }

  // Detect OS
  if (userAgent.includes('Windows')) {
    os = 'Windows';
  } else if (userAgent.includes('Mac OS')) {
    os = 'macOS';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
    deviceType = 'mobile';
  } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS';
    deviceType = userAgent.includes('iPad') ? 'tablet' : 'mobile';
  }

  // Detect device type from keywords
  if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
    if (!userAgent.includes('Tablet')) {
      deviceType = 'mobile';
    }
  }
  if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    deviceType = 'tablet';
  }

  return { browser, os, deviceType };
}

// Generate a unique session token
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const supabaseAuth = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { userAgent }: SessionRequest = await req.json();
    
    if (!userAgent) {
      return new Response(
        JSON.stringify({ error: 'Missing userAgent' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse user agent
    const { browser, os, deviceType } = parseUserAgent(userAgent);

    // Get IP address from request
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('cf-connecting-ip')
      || req.headers.get('x-real-ip')
      || 'unknown';

    // Try to get geolocation from IP (optional, don't fail if it doesn't work)
    let geoData: GeoData = {};
    try {
      // Using ipapi.co for geolocation (free tier allows 1000 requests/day)
      if (clientIp !== 'unknown' && clientIp !== '127.0.0.1' && clientIp !== '::1') {
        const geoResponse = await fetch(`https://ipapi.co/${clientIp}/json/`, {
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        if (geoResponse.ok) {
          const geo = await geoResponse.json();
          if (!geo.error) {
            geoData = {
              city: geo.city || undefined,
              region: geo.region || undefined,
              country: geo.country_name || undefined,
            };
          }
        }
      }
    } catch (geoError) {
      console.log('Geolocation lookup failed (non-critical):', geoError);
      // Continue without geolocation data
    }

    // Generate unique session token
    const sessionToken = generateSessionToken();

    // Mark all other sessions as not current
    await supabase
      .from('user_sessions')
      .update({ is_current: false })
      .eq('user_id', user.id)
      .is('ended_at', null);

    // Insert new session
    const { data: session, error: insertError } = await supabase
      .from('user_sessions')
      .insert({
        user_id: user.id,
        device_type: deviceType,
        browser,
        os,
        ip_address: clientIp !== 'unknown' ? clientIp : null,
        city: geoData.city || null,
        region: geoData.region || null,
        country: geoData.country || null,
        session_token: sessionToken,
        is_current: true,
        user_agent: userAgent,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to register session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Session registered:', {
      userId: user.id,
      browser,
      os,
      deviceType,
      city: geoData.city,
      country: geoData.country,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        sessionToken,
        session: {
          id: session.id,
          browser,
          os,
          deviceType,
          city: geoData.city,
          country: geoData.country,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error registering session:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
