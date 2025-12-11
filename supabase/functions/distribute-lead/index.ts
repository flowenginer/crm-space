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

    // 1. Get distribution configuration from company_settings
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .single();

    if (settingsError) {
      console.error('[distribute-lead] Error fetching settings:', settingsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch distribution settings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if distribution is enabled
    if (!settings.lead_distribution_enabled) {
      console.log('[distribute-lead] Distribution is disabled');
      return new Response(
        JSON.stringify({ success: false, error: 'Lead distribution is disabled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const departmentId = settings.lead_distribution_department_id;
    const distributionType = settings.lead_distribution_type || 'sequential';
    let currentPosition = settings.lead_distribution_position || 0;
    const configuredAgents: DistributionAgent[] = settings.lead_distribution_agents || [];

    if (!departmentId) {
      console.log('[distribute-lead] No department configured for distribution');
      return new Response(
        JSON.stringify({ success: false, error: 'No department configured for distribution' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get available agents from the configured department
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

    if (availableAgents.length === 0) {
      console.log('[distribute-lead] No available agents found');
      return new Response(
        JSON.stringify({ success: false, error: 'No available agents in the configured department' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[distribute-lead] Found ${availableAgents.length} available agents`);

    // 3. Select the next agent based on distribution type
    let selectedAgent: { id: string; full_name: string };

    if (distributionType === 'percentage' && configuredAgents.length > 0) {
      // Percentage-based distribution
      // Filter configured agents that are currently available
      const activeConfiguredAgents = configuredAgents.filter(ca => {
        return ca.is_active && availableAgents.some(aa => aa.id === ca.user_id);
      });

      if (activeConfiguredAgents.length === 0) {
        // Fallback to sequential if no configured agents are available
        console.log('[distribute-lead] No configured agents available, falling back to sequential');
        const agentIndex = currentPosition % availableAgents.length;
        selectedAgent = availableAgents[agentIndex];
        currentPosition = (currentPosition + 1) % availableAgents.length;
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
          const agentData = availableAgents.find(a => a.id === bestAgent!.user_id);
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
            selectedAgent = availableAgents[0];
          }
        } else {
          selectedAgent = availableAgents[0];
        }
      }
    } else {
      // Sequential (round-robin) distribution
      // If we have configured agents with order, use that order
      if (configuredAgents.length > 0) {
        const orderedAgents = configuredAgents
          .filter(ca => ca.is_active && availableAgents.some(aa => aa.id === ca.user_id))
          .sort((a, b) => a.order_position - b.order_position);
        
        if (orderedAgents.length > 0) {
          const agentIndex = currentPosition % orderedAgents.length;
          const selectedConfig = orderedAgents[agentIndex];
          const agentData = availableAgents.find(a => a.id === selectedConfig.user_id);
          
          if (agentData) {
            selectedAgent = agentData;
            currentPosition = (agentIndex + 1) % orderedAgents.length;
          } else {
            selectedAgent = availableAgents[currentPosition % availableAgents.length];
            currentPosition = (currentPosition + 1) % availableAgents.length;
          }
        } else {
          // All configured agents are unavailable, use all available
          const agentIndex = currentPosition % availableAgents.length;
          selectedAgent = availableAgents[agentIndex];
          currentPosition = (currentPosition + 1) % availableAgents.length;
        }
      } else {
        // No configured agents, use all available in department
        const agentIndex = currentPosition % availableAgents.length;
        selectedAgent = availableAgents[agentIndex];
        currentPosition = (currentPosition + 1) % availableAgents.length;
      }

      // Update position in settings
      await supabase
        .from('company_settings')
        .update({ lead_distribution_position: currentPosition })
        .eq('id', settings.id);
    }

    console.log(`[distribute-lead] Selected agent: ${selectedAgent.full_name} (${selectedAgent.id})`);

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
    const { error: conversationError } = await supabase
      .from('conversations')
      .update({
        assigned_to: selectedAgent.id,
        department_id: departmentId,
        status: 'open',
        updated_at: new Date().toISOString()
      })
      .eq('contact_id', contact_id)
      .in('status', ['open', 'pending']);

    if (conversationError) {
      console.error('[distribute-lead] Error updating conversations:', conversationError);
      // Don't fail the whole operation, contact was already updated
    }

    // 6. Record assignment history
    const { error: historyError } = await supabase
      .from('lead_assignment_history')
      .insert({
        contact_id: contact_id,
        assigned_to: selectedAgent.id,
        assignment_type: 'auto_distribution',
        assigned_at: new Date().toISOString()
      });

    if (historyError) {
      console.error('[distribute-lead] Error recording history:', historyError);
      // Don't fail the whole operation
    }

    console.log(`[distribute-lead] Successfully distributed contact ${contact_id} to ${selectedAgent.full_name}`);

    return new Response(
      JSON.stringify({
        success: true,
        contact_id: contact_id,
        assigned_to: {
          id: selectedAgent.id,
          name: selectedAgent.full_name
        },
        department_id: departmentId,
        distribution_type: distributionType
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
