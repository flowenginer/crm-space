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

    // Check if requester is admin AND get their tenant_id
    const { data: requesterProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', requester.id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      throw new Error('Could not verify admin status')
    }

    console.log('Requester role:', requesterProfile?.role, 'tenant_id:', requesterProfile?.tenant_id);

    if (requesterProfile?.role !== 'admin') {
      throw new Error('Only admins can create users')
    }

    // CRITICAL: Get tenant_id from requester - new users MUST belong to the same tenant
    const requesterTenantId = requesterProfile?.tenant_id;
    if (!requesterTenantId) {
      throw new Error('Requester does not have a tenant assigned')
    }

    // Get request body
    const { 
      email, 
      password, 
      full_name, 
      role, 
      department_id, // legacy single department support
      department_ids, // new: array of { id: string, is_primary: boolean }
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

    // Validate department for non-admin roles
    const hasDepartments = (department_ids && department_ids.length > 0) || department_id;
    if (role !== 'admin' && !hasDepartments) {
      throw new Error('At least one department is required for non-admin users')
    }

    // Check if email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const emailExists = existingUsers?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase())
    
    if (emailExists) {
      throw new Error('Email already registered')
    }

    // Create the user using admin API (bypasses email confirmation)
    // CRITICAL: Pass tenant_id and skip_auto_tenant to prevent trigger from creating a new tenant
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name,
        role,
        tenant_id: requesterTenantId,    // Inherit tenant from creator
        skip_auto_tenant: true           // Prevent handle_new_user from creating new tenant
      }
    })

    if (createError) {
      console.error('User creation error:', createError);
      throw createError
    }

    console.log('User created with ID:', newUser.user.id);

    // Determine primary department for backwards compatibility
    let primaryDepartmentId = null;
    if (department_ids && department_ids.length > 0) {
      const primary = department_ids.find((d: any) => d.is_primary);
      primaryDepartmentId = primary?.id || department_ids[0].id;
    } else if (department_id) {
      primaryDepartmentId = department_id;
    }

    // Update the profile that was created by the trigger
    // CRITICAL: Set tenant_id from the requester's tenant to ensure isolation
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name,
        role,
        department_id: primaryDepartmentId, // Keep for backwards compatibility
        phone: phone || null,
        is_active: true,
        is_online: false,
        tenant_id: requesterTenantId, // CRITICAL: Inherit tenant from creator
        updated_at: new Date().toISOString()
      })
      .eq('id', newUser.user.id)

    if (profileUpdateError) {
      console.error('Profile update error:', profileUpdateError);
      // This is critical - if tenant_id wasn't set, the user will see wrong data
      throw new Error('Failed to set user tenant: ' + profileUpdateError.message);
    }

    console.log('Profile updated with tenant_id:', requesterTenantId);

    // Insert into user_departments table
    if (department_ids && department_ids.length > 0) {
      console.log('Adding user to departments:', department_ids);
      
      for (const dept of department_ids) {
        const { error: deptError } = await supabaseAdmin
          .from('user_departments')
          .insert({
            user_id: newUser.user.id,
            department_id: dept.id,
            is_primary: dept.is_primary || false
          })
        
        if (deptError) {
          console.error('Error adding user to department:', deptError);
        }
      }
    } else if (department_id) {
      // Legacy support: single department_id
      console.log('Adding user to single department (legacy):', department_id);
      
      const { error: deptError } = await supabaseAdmin
        .from('user_departments')
        .insert({
          user_id: newUser.user.id,
          department_id: department_id,
          is_primary: true
        })
      
      if (deptError) {
        console.error('Error adding user to department:', deptError);
      }
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

    console.log('User profile, departments, and role updated successfully');

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