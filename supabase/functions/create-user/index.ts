import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Create user function called');
    
    // Get the authorization header to verify the requester is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header provided');
      throw new Error('No authorization header')
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Create regular client to verify the requester
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Verify the requester is authenticated
    const { data: { user: requester }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !requester) {
      console.error('Auth error:', authError);
      throw new Error('Unauthorized')
    }

    console.log('Requester ID:', requester.id);

    // Check if requester is admin
    const { data: requesterProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', requester.id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      throw new Error('Could not verify admin status')
    }

    console.log('Requester role:', requesterProfile?.role);

    if (requesterProfile?.role !== 'admin') {
      throw new Error('Only admins can create users')
    }

    // Get request body
    const { 
      email, 
      password, 
      full_name, 
      role, 
      department_id,
      phone
    } = await req.json()

    console.log('Creating user with email:', email, 'role:', role);

    // Validate required fields
    if (!email || !password || !full_name || !role) {
      throw new Error('Missing required fields: email, password, full_name, role')
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format')
    }

    // Validate password strength
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters')
    }

    // Check if email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const emailExists = existingUsers?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase())
    
    if (emailExists) {
      throw new Error('Email already registered')
    }

    // Create the user using admin API (bypasses email confirmation)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name,
        role
      }
    })

    if (createError) {
      console.error('User creation error:', createError);
      throw createError
    }

    console.log('User created with ID:', newUser.user.id);

    // Update the profile that was created by the trigger
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name,
        role,
        department_id: department_id || null,
        phone: phone || null,
        is_active: true,
        is_online: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', newUser.user.id)

    if (profileUpdateError) {
      console.error('Profile update error:', profileUpdateError);
    }

    // Map role to app_role enum and update user_roles table
    const roleMapping: Record<string, string> = {
      'admin': 'admin',
      'supervisor': 'supervisor',
      'manager': 'manager',
      'vendedor': 'seller',
      'seller': 'seller',
      'designer': 'user',
      'user': 'user'
    };
    
    const appRole = roleMapping[role] || 'user';
    
    // Update the user_roles table (upsert to handle the trigger-created default)
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: newUser.user.id,
        role: appRole
      }, {
        onConflict: 'user_id'
      })

    if (roleError) {
      console.error('Role update error:', roleError);
    }

    console.log('User profile and role updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          full_name
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in create-user function:', errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
