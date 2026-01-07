import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DistributionAgent {
  user_id: string;
  percentage: number;
  order_position: number;
  is_active: boolean;
  leads_received?: number;
}

interface AgentProfile {
  id: string;
  full_name: string;
  is_active: boolean;
  is_available: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { contact_id } = await req.json();

    if (!contact_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'contact_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[distribute-lead] Starting distribution for contact: ${contact_id}`);

    // FIRST: Get contact to determine tenant_id
    const { data: contact, error: contactFetchError } = await supabase
      .from('contacts')
      .select('id, tenant_id, assigned_to')
      .eq('id', contact_id)
      .single();

    if (contactFetchError || !contact) {
      console.error('[distribute-lead] Error fetching contact:', contactFetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Contact not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = contact.tenant_id;
    console.log(`[distribute-lead] Contact tenant_id: ${tenantId}`);

    // CHECK 1: Verify if there's a recent manual transfer (last 60 seconds) - don't overwrite
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, assigned_to')
      .eq('contact_id', contact_id)
      .in('status', ['open', 'pending']);

    if (conversations && conversations.length > 0) {
      const conversationIds = conversations.map(c => c.id);
      
      // Check for recent transfer events
      const sixtySecondsAgo = new Date(Date.now() - 60000).toISOString();
      const { data: recentTransfers } = await supabase
        .from('conversation_events')
        .select('id, conversation_id, created_at')
        .eq('event_type', 'transfer')
        .in('conversation_id', conversationIds)
        .gte('created_at', sixtySecondsAgo);

      if (recentTransfers && recentTransfers.length > 0) {
        console.log(`[distribute-lead] Skipping - recent manual transfer detected (${recentTransfers.length} transfers in last 60s)`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Skipped - recent manual transfer detected',
            reason: 'manual_transfer_protection'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // CHECK 2: If conversation already has an assigned agent, skip distribution
      const assignedConversation = conversations.find(c => c.assigned_to);
      if (assignedConversation) {
        console.log(`[distribute-lead] Skipping - conversation already assigned to ${assignedConversation.assigned_to}`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Skipped - conversation already assigned',
            reason: 'already_assigned',
            assigned_to: assignedConversation.assigned_to
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 1. Get distribution configuration from company_settings BY TENANT
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (settingsError) {
      console.error(`[distribute-lead] Error fetching settings for tenant ${tenantId}:`, settingsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch distribution settings for tenant' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[distribute-lead] Using company_settings id=${settings.id}, tenant=${tenantId}, enabled=${settings.lead_distribution_enabled}`);

    // Check if distribution is enabled
    if (!settings.lead_distribution_enabled) {
      console.log(`[distribute-lead] Distribution is disabled for tenant ${tenantId}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Lead distribution is disabled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const departmentId = settings.lead_distribution_department_id;
    const distributionType = settings.lead_distribution_type || 'sequential';
    const includeOffline = settings.lead_distribution_include_offline || false;
    let currentPosition = settings.lead_distribution_position || 0;
    const configuredAgents: DistributionAgent[] = settings.lead_distribution_agents || [];

    if (!departmentId) {
      console.log('[distribute-lead] No department configured for distribution');
      return new Response(
        JSON.stringify({ success: false, error: 'No department configured for distribution' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get agents from the configured department
    const { data: departmentAgents, error: agentsError } = await supabase
      .from('user_departments')
      .select(`
        user_id,
        profiles:user_id (
          id,
          full_name,
          is_active,
          is_available,
          role
        )
      `)
      .eq('department_id', departmentId);

    if (agentsError) {
      console.error('[distribute-lead] Error fetching agents:', agentsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch department agents' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter to only active and available sellers
    const availableAgents = departmentAgents
      .filter(da => {
        const profile = da.profiles as unknown as AgentProfile;
        return profile && 
               profile.is_active === true && 
               profile.is_available === true;
      })
      .map(da => {
        const profile = da.profiles as unknown as AgentProfile;
        return {
          id: profile.id,
          full_name: profile.full_name
        };
      });

    // Filter to only active sellers (for offline fallback)
    const activeAgents = departmentAgents
      .filter(da => {
        const profile = da.profiles as unknown as AgentProfile;
        return profile && profile.is_active === true;
      })
      .map(da => {
        const profile = da.profiles as unknown as AgentProfile;
        return {
          id: profile.id,
          full_name: profile.full_name,
          is_available: profile.is_available
        };
      });

    // Determine which pool to use and whether to mark as pending
    let agentPool: { id: string; full_name: string }[] = availableAgents;
    let assignAsPending = false;

    if (availableAgents.length === 0) {
      if (includeOffline && activeAgents.length > 0) {
        console.log('[distribute-lead] No available agents, falling back to offline distribution');
        agentPool = activeAgents;
        assignAsPending = true;
      } else {
        console.log('[distribute-lead] No available agents found');
        return new Response(
          JSON.stringify({ success: false, error: 'No available agents in the configured department' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`[distribute-lead] Found ${agentPool.length} agents (assignAsPending: ${assignAsPending})`);

    // 3. Select the next agent based on distribution type
    let selectedAgent: { id: string; full_name: string };

    if (distributionType === 'percentage' && configuredAgents.length > 0) {
      // Percentage-based distribution
      // Filter configured agents that are currently in the pool
      const activeConfiguredAgents = configuredAgents.filter(ca => {
        return ca.is_active && agentPool.some(aa => aa.id === ca.user_id);
      });

      if (activeConfiguredAgents.length === 0) {
        // Fallback to sequential if no configured agents are in pool
        console.log('[distribute-lead] No configured agents in pool, falling back to sequential');
        const agentIndex = currentPosition % agentPool.length;
        selectedAgent = agentPool[agentIndex];
        currentPosition = (currentPosition + 1) % agentPool.length;
      } else {
        // Calculate who should receive based on percentage distribution
        // Find agent with lowest percentage fulfillment
        const totalLeads = activeConfiguredAgents.reduce((sum, a) => sum + (a.leads_received || 0), 0) || 1;
        
        let bestAgent: DistributionAgent | null = null;
        let lowestRatio = Infinity;

        for (const agent of activeConfiguredAgents) {
          const currentRatio = ((agent.leads_received || 0) / totalLeads) * 100;
          const targetRatio = agent.percentage;
          const deficit = targetRatio - currentRatio;
          
          if (deficit > lowestRatio * -1 || !bestAgent) {
            if (deficit > 0 || bestAgent === null) {
              bestAgent = agent;
              lowestRatio = currentRatio - targetRatio;
            }
          }
        }

        if (bestAgent) {
          const agentData = agentPool.find(a => a.id === bestAgent!.user_id);
          if (agentData) {
            selectedAgent = agentData;
            
            // Update leads_received counter
            const updatedAgents = configuredAgents.map(a => {
              if (a.user_id === bestAgent!.user_id) {
                return { ...a, leads_received: (a.leads_received || 0) + 1 };
              }
              return a;
            });
            
            await supabase
              .from('company_settings')
              .update({ lead_distribution_agents: updatedAgents })
              .eq('id', settings.id);
          } else {
            // Fallback
            selectedAgent = agentPool[0];
          }
        } else {
          selectedAgent = agentPool[0];
        }
      }
    } else {
      // Sequential (round-robin) distribution
      // If we have configured agents with order, use that order
      if (configuredAgents.length > 0) {
        const orderedAgents = configuredAgents
          .filter(ca => ca.is_active && agentPool.some(aa => aa.id === ca.user_id))
          .sort((a, b) => a.order_position - b.order_position);
        
        if (orderedAgents.length > 0) {
          const agentIndex = currentPosition % orderedAgents.length;
          const selectedConfig = orderedAgents[agentIndex];
          const agentData = agentPool.find(a => a.id === selectedConfig.user_id);
          
          if (agentData) {
            selectedAgent = agentData;
            currentPosition = (agentIndex + 1) % orderedAgents.length;
          } else {
            selectedAgent = agentPool[currentPosition % agentPool.length];
            currentPosition = (currentPosition + 1) % agentPool.length;
          }
        } else {
          // All configured agents are unavailable, use all in pool
          const agentIndex = currentPosition % agentPool.length;
          selectedAgent = agentPool[agentIndex];
          currentPosition = (currentPosition + 1) % agentPool.length;
        }
      } else {
        // No configured agents, use all in pool
        const agentIndex = currentPosition % agentPool.length;
        selectedAgent = agentPool[agentIndex];
        currentPosition = (currentPosition + 1) % agentPool.length;
      }

      // Update position in settings
      await supabase
        .from('company_settings')
        .update({ lead_distribution_position: currentPosition })
        .eq('id', settings.id);
    }

    console.log(`[distribute-lead] Selected agent: ${selectedAgent.full_name} (${selectedAgent.id}) - pending: ${assignAsPending}`);

    // 4. Update contact assignment
    const { error: contactError } = await supabase
      .from('contacts')
      .update({
        assigned_to: selectedAgent.id,
        department_id: departmentId,
        updated_at: new Date().toISOString()
      })
      .eq('id', contact_id);

    if (contactError) {
      console.error('[distribute-lead] Error updating contact:', contactError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update contact assignment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Update active conversations for this contact
    const conversationStatus = assignAsPending ? 'pending' : 'open';
    const { error: conversationError } = await supabase
      .from('conversations')
      .update({
        assigned_to: selectedAgent.id,
        department_id: departmentId,
        status: conversationStatus,
        updated_at: new Date().toISOString()
      })
      .eq('contact_id', contact_id)
      .in('status', ['open', 'pending']);

    if (conversationError) {
      console.error('[distribute-lead] Error updating conversations:', conversationError);
      // Don't fail the whole operation, contact was already updated
    }

    // 6. Record assignment history
    const assignmentType = assignAsPending ? 'auto_distribution_offline' : 'auto_distribution';
    const { error: historyError } = await supabase
      .from('lead_assignment_history')
      .insert({
        contact_id: contact_id,
        assigned_to: selectedAgent.id,
        assignment_type: assignmentType,
        assigned_at: new Date().toISOString()
      });

    if (historyError) {
      console.error('[distribute-lead] Error recording history:', historyError);
      // Don't fail the whole operation
    }

    console.log(`[distribute-lead] Successfully distributed contact ${contact_id} to ${selectedAgent.full_name} (status: ${conversationStatus})`);

    return new Response(
      JSON.stringify({
        success: true,
        contact_id: contact_id,
        assigned_to: {
          id: selectedAgent.id,
          name: selectedAgent.full_name
        },
        department_id: departmentId,
        distribution_type: distributionType,
        assigned_as_pending: assignAsPending
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[distribute-lead] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});