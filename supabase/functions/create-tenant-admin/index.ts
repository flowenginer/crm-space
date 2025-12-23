import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateTenantRequest {
  tenantName: string;
  slug: string;
  planType: 'free' | 'pro' | 'enterprise';
  maxUsers: number;
  maxContacts: number;
  trialDays?: number;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
  enabledModules: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Cliente com token do usuário para verificar permissões
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verificar se o usuário é super_admin
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('Error getting user:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar role de super_admin
    const { data: roleData, error: roleError } = await supabaseUser
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .single();

    if (roleError || !roleData) {
      console.error('User is not super_admin:', roleError);
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas Super Admins podem criar tenants.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cliente com service_role para operações administrativas
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body: CreateTenantRequest = await req.json();
    console.log('Creating tenant:', body.tenantName);

    const {
      tenantName,
      slug,
      planType,
      maxUsers,
      maxContacts,
      trialDays,
      adminEmail,
      adminName,
      adminPassword,
      enabledModules
    } = body;

    // Validações
    if (!tenantName || !slug || !adminEmail || !adminName || !adminPassword) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios não preenchidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (adminPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Senha deve ter pelo menos 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se slug já existe
    const { data: existingTenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingTenant) {
      return new Response(
        JSON.stringify({ error: 'Já existe um tenant com este slug' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se email já está em uso
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUser?.users?.some(u => u.email === adminEmail);
    if (emailExists) {
      return new Response(
        JSON.stringify({ error: 'Email já está em uso' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Criar o tenant
    const trialEndsAt = trialDays 
      ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        name: tenantName,
        slug,
        plan_type: planType,
        max_users: maxUsers,
        max_contacts: maxContacts,
        trial_ends_at: trialEndsAt,
        is_active: true
      })
      .select()
      .single();

    if (tenantError) {
      console.error('Error creating tenant:', tenantError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar tenant: ' + tenantError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Tenant created:', tenant.id);

    // 2. Criar o usuário admin
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true, // Confirmar email automaticamente
      user_metadata: {
        full_name: adminName
      }
    });

    if (authError) {
      console.error('Error creating user:', authError);
      // Rollback: deletar o tenant
      await supabaseAdmin.from('tenants').delete().eq('id', tenant.id);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar usuário: ' + authError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User created:', authUser.user.id);

    // 3. Criar/atualizar o perfil do usuário (upsert para lidar com trigger existente)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authUser.user.id,
        full_name: adminName,
        email: adminEmail,
        tenant_id: tenant.id,
        is_active: true,
        is_available: true
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Rollback
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      await supabaseAdmin.from('tenants').delete().eq('id', tenant.id);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar perfil: ' + profileError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Primeiro remover o role 'user' criado automaticamente pelo trigger on_auth_user_created
    const { error: roleDeleteError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', authUser.user.id)
      .eq('role', 'user');

    if (roleDeleteError) {
      console.log('Note: Could not delete default user role (may not exist):', roleDeleteError.message);
    }

    // 4.1 Atribuir role de admin ao usuário dentro do tenant
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authUser.user.id,
        role: 'admin'
      });

    if (roleInsertError) {
      console.error('Error assigning admin role:', roleInsertError);
      // Não fazer rollback completo, apenas logar
    } else {
      console.log('Admin role assigned successfully');
    }

    // 5. Definir o owner do tenant
    const { error: ownerError } = await supabaseAdmin
      .from('tenants')
      .update({ owner_id: authUser.user.id })
      .eq('id', tenant.id);

    if (ownerError) {
      console.error('Error setting owner:', ownerError);
    }

    // 6. Criar configurações de módulos
    if (enabledModules && enabledModules.length > 0) {
      const moduleInserts = enabledModules.map(moduleKey => ({
        tenant_id: tenant.id,
        module_key: moduleKey,
        is_enabled: true
      }));

      const { error: modulesError } = await supabaseAdmin
        .from('tenant_modules')
        .insert(moduleInserts);

      if (modulesError) {
        console.error('Error creating modules:', modulesError);
      }
    }

    // 7. Criar company_settings para o novo tenant
    const { error: settingsError } = await supabaseAdmin
      .from('company_settings')
      .insert({
        tenant_id: tenant.id,
        company_name: tenantName
      });

    if (settingsError) {
      console.error('Error creating company settings:', settingsError);
    }

    // 8. Criar departamento padrão
    const { error: deptError } = await supabaseAdmin
      .from('departments')
      .insert({
        tenant_id: tenant.id,
        name: 'Geral',
        description: 'Departamento principal',
        is_active: true
      });

    if (deptError) {
      console.error('Error creating department:', deptError);
    }

    // 9. Criar role_definitions padrão para o novo tenant
    const defaultRoles = [
      { tenant_id: tenant.id, role_key: 'admin', role_name: 'Administrador', description: 'Acesso total ao sistema', color: '#EF4444', icon: 'Shield', order_position: 1 },
      { tenant_id: tenant.id, role_key: 'supervisor', role_name: 'Supervisor', description: 'Gerencia equipe de vendas', color: '#F59E0B', icon: 'UserCog', order_position: 2 },
      { tenant_id: tenant.id, role_key: 'vendedor', role_name: 'Vendedor', description: 'Atendimento e vendas', color: '#22C55E', icon: 'ShoppingCart', order_position: 3 },
      { tenant_id: tenant.id, role_key: 'designer', role_name: 'Designer', description: 'Criação de artes e templates', color: '#8B5CF6', icon: 'Palette', order_position: 4 },
      { tenant_id: tenant.id, role_key: 'sac', role_name: 'SAC', description: 'Suporte ao cliente', color: '#3B82F6', icon: 'Headphones', order_position: 5 }
    ];

    const { error: rolesDefError } = await supabaseAdmin
      .from('role_definitions')
      .insert(defaultRoles);

    if (rolesDefError) {
      console.error('Error creating default role definitions:', rolesDefError);
    } else {
      console.log('Default role definitions created');
    }

    console.log('Tenant setup complete:', tenant.id);

    return new Response(
      JSON.stringify({
        success: true,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug
        },
        admin: {
          id: authUser.user.id,
          email: adminEmail,
          name: adminName
        }
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
