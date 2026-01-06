import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to verify their identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the requesting user
    const { data: { user: requestingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !requestingUser) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get requesting user's profile and role
    const { data: requesterProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('id', requestingUser.id)
      .single();

    if (profileError || !requesterProfile) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if requester is admin
    const { data: requesterRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single();

    if (!requesterRole || requesterRole.role !== 'admin') {
      console.error('Permission denied: user is not admin');
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem excluir usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { userId } = await req.json();
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Deleting user:', userId, 'requested by:', requestingUser.id);

    // Prevent self-deletion
    if (userId === requestingUser.id) {
      return new Response(
        JSON.stringify({ error: 'Você não pode excluir a si mesmo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get target user's profile to verify tenant
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id, full_name')
      .eq('id', userId)
      .single();

    if (targetError || !targetProfile) {
      console.error('Target user not found:', targetError);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify same tenant
    if (targetProfile.tenant_id !== requesterProfile.tenant_id) {
      console.error('Tenant mismatch');
      return new Response(
        JSON.stringify({ error: 'Você não tem permissão para excluir este usuário' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if target user is admin (cannot delete admins)
    const { data: targetRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (targetRole?.role === 'admin') {
      return new Response(
        JSON.stringify({ error: 'Não é possível excluir um administrador' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete related records first (cascade should handle most, but let's be explicit)
    console.log('Deleting user_departments...');
    await supabaseAdmin
      .from('user_departments')
      .delete()
      .eq('user_id', userId);

    console.log('Deleting user_roles...');
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    console.log('Deleting profile...');
    const { error: deleteProfileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (deleteProfileError) {
      console.error('Error deleting profile:', deleteProfileError);
      return new Response(
        JSON.stringify({ error: 'Erro ao excluir perfil do usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete from auth.users
    console.log('Deleting auth user...');
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      return new Response(
        JSON.stringify({ error: 'Erro ao excluir usuário da autenticação' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User deleted successfully:', userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Usuário ${targetProfile.full_name} excluído permanentemente` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
