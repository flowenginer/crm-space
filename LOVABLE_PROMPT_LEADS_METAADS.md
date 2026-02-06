# Prompt para Lovable - Dashboard de Leads + Integração Meta Ads

## Visão Geral do Projeto

Crie um sistema de **Dashboard de Leads** com **integração ao Meta Ads (Facebook Ads)** usando:
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Edge Functions + Realtime)
- **Gráficos**: Recharts
- **Gerenciamento de Estado**: TanStack Query (React Query)

O sistema recebe leads via webhook do WhatsApp (JSON com dados de Click-to-WhatsApp do Meta Ads) e exibe métricas em uma dashboard analítica.

---

## 1. Estrutura do Banco de Dados (Supabase)

### 1.1 Tabela `contacts` (Leads/Contatos)

```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,

  -- Campos de origem (Meta Ads)
  origin TEXT DEFAULT 'whatsapp', -- 'meta_ads', 'organic', 'manual', 'referral', etc.
  origin_campaign TEXT, -- Nome da campanha/anúncio de origem
  referral_data JSONB, -- Dados completos do Click-to-WhatsApp

  -- Status do lead
  lead_status TEXT REFERENCES lead_statuses(name),
  negotiated_value DECIMAL(10,2),

  -- Atribuição
  assigned_to UUID REFERENCES profiles(id),
  department_id UUID REFERENCES departments(id),

  -- Timestamps
  first_contact_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contacts_origin ON contacts(origin);
CREATE INDEX idx_contacts_lead_status ON contacts(lead_status);
CREATE INDEX idx_contacts_created_at ON contacts(created_at);
```

### 1.2 Tabela `lead_statuses` (Status do Funil)

```sql
CREATE TABLE lead_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#8B5CF6',
  order_position INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_conversion BOOLEAN DEFAULT false, -- Marca status de conversão
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Status padrão sugeridos
INSERT INTO lead_statuses (name, color, order_position, is_conversion) VALUES
  ('01 - Novo Lead', '#3B82F6', 1, false),
  ('02 - Em Contato', '#F59E0B', 2, false),
  ('03 - Qualificado', '#10B981', 3, false),
  ('04 - Proposta Enviada', '#8B5CF6', 4, false),
  ('05 - Negociação', '#EC4899', 5, false),
  ('06 - Fechado Ganho', '#22C55E', 6, true),
  ('07 - Fechado Perdido', '#EF4444', 7, false);
```

### 1.3 Tabelas do Meta Ads

```sql
-- Contas do Meta Ads conectadas
CREATE TABLE meta_ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  account_id TEXT NOT NULL, -- ID da conta de anúncios no Meta
  account_name TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  business_id TEXT,
  currency TEXT DEFAULT 'BRL',
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(account_id)
);

-- Campanhas do Meta Ads
CREATE TABLE meta_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_account_id UUID REFERENCES meta_ad_accounts(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL, -- ID da campanha no Meta
  name TEXT NOT NULL,
  objective TEXT,
  status TEXT,
  daily_budget DECIMAL(10,2),
  lifetime_budget DECIMAL(10,2),
  start_time TIMESTAMPTZ,
  stop_time TIMESTAMPTZ,
  created_time TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(meta_account_id, campaign_id)
);

-- Insights diários das campanhas
CREATE TABLE meta_campaign_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES meta_campaigns(id) ON DELETE CASCADE,
  date_start DATE NOT NULL,
  date_stop DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend DECIMAL(10,2) DEFAULT 0,
  reach BIGINT DEFAULT 0,
  ctr DECIMAL(5,2),
  cpc DECIMAL(10,2),
  cpm DECIMAL(10,2),
  conversions BIGINT DEFAULT 0,
  cost_per_conversion DECIMAL(10,2),
  actions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, date_start)
);

-- Anúncios individuais
CREATE TABLE meta_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_account_id UUID REFERENCES meta_ad_accounts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES meta_campaigns(id) ON DELETE CASCADE,
  ad_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT,
  thumbnail_url TEXT,
  created_time TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(meta_account_id, ad_id)
);
```

### 1.4 Histórico de Status (opcional, para métricas avançadas)

```sql
CREATE TABLE lead_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT,
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 2. Estrutura JSON do Click-to-WhatsApp (referral_data)

Quando um lead vem do Meta Ads via Click-to-WhatsApp, o `referral_data` contém:

```typescript
interface ReferralData {
  // Identificação Click-to-WhatsApp
  ctwaClid?: string;           // Click ID do Meta Ads
  sourceId?: string;           // ID do Anúncio/Post
  sourceType?: string;         // 'ad' | 'post'

  // Informações do Anúncio
  sourceUrl?: string;          // URL do anúncio
  headline?: string;           // Título do anúncio
  body?: string;               // Descrição do anúncio
  adName?: string;             // Nome do anúncio
  campaignName?: string;       // Nome da campanha

  // Mídia
  mediaType?: string;          // 'image' | 'video'
  imageUrl?: string;           // URL da imagem
  videoUrl?: string;           // URL do vídeo
  thumbnailUrl?: string;       // URL da thumbnail

  // Atribuição Meta
  showAdAttribution?: boolean; // Badge "Patrocinado"
  sourceApp?: string;          // 'instagram' | 'facebook'
  conversionSource?: string;   // 'FB_Ads'
}
```

---

## 3. Funções RPC do Supabase (PostgreSQL Functions)

### 3.1 Métricas por Origem

```sql
CREATE OR REPLACE FUNCTION get_leads_by_origin(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_conversion_status_names TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS TABLE(origin TEXT, total BIGINT, converted BIGINT)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(c.origin, 'other') as origin,
    COUNT(DISTINCT c.id) as total,
    COUNT(DISTINCT c.id) FILTER (WHERE c.lead_status = ANY(p_conversion_status_names)) as converted
  FROM contacts c
  WHERE c.created_at BETWEEN p_date_from AND p_date_to
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
  GROUP BY COALESCE(c.origin, 'other');
END;
$$;
```

### 3.2 Métricas da Jornada do Lead

```sql
CREATE OR REPLACE FUNCTION get_lead_journey_metrics(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_conversion_status_names TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_origin TEXT DEFAULT NULL
)
RETURNS TABLE(
  total_leads BIGINT,
  total_assigned BIGINT,
  total_unassigned BIGINT,
  assignment_rate NUMERIC,
  conversions BIGINT,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT c.id) as total_leads,
    COUNT(DISTINCT c.id) FILTER (WHERE c.assigned_to IS NOT NULL) as total_assigned,
    COUNT(DISTINCT c.id) FILTER (WHERE c.assigned_to IS NULL) as total_unassigned,
    CASE WHEN COUNT(DISTINCT c.id) > 0
      THEN ROUND((COUNT(DISTINCT c.id) FILTER (WHERE c.assigned_to IS NOT NULL)::NUMERIC / COUNT(DISTINCT c.id)::NUMERIC) * 100, 2)
      ELSE 0
    END as assignment_rate,
    COUNT(DISTINCT c.id) FILTER (WHERE c.lead_status = ANY(p_conversion_status_names)) as conversions,
    CASE WHEN COUNT(DISTINCT c.id) > 0
      THEN ROUND((COUNT(DISTINCT c.id) FILTER (WHERE c.lead_status = ANY(p_conversion_status_names))::NUMERIC / COUNT(DISTINCT c.id)::NUMERIC) * 100, 2)
      ELSE 0
    END as conversion_rate
  FROM contacts c
  WHERE c.created_at BETWEEN p_date_from AND p_date_to
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_origin IS NULL OR c.origin = p_origin);
END;
$$;
```

### 3.3 Funil de Status (Realtime)

```sql
CREATE OR REPLACE FUNCTION get_status_funnel(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_origin TEXT DEFAULT NULL
)
RETURNS TABLE(
  status TEXT,
  count BIGINT,
  color TEXT,
  status_order INTEGER
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    ls.name as status,
    COUNT(c.id) as count,
    ls.color,
    ls.order_position as status_order
  FROM lead_statuses ls
  LEFT JOIN contacts c ON c.lead_status = ls.name
    AND c.created_at BETWEEN p_date_from AND p_date_to
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_origin IS NULL OR c.origin = p_origin)
  WHERE ls.is_active = true
  GROUP BY ls.name, ls.color, ls.order_position
  ORDER BY ls.order_position;
END;
$$;
```

### 3.4 Métricas de Leads Novos vs Retornantes

```sql
CREATE OR REPLACE FUNCTION get_returning_leads_metrics(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_channel_id UUID DEFAULT NULL,
  p_origin TEXT DEFAULT NULL
)
RETURNS TABLE(
  total_contacts BIGINT,
  new_contacts BIGINT,
  returning_contacts BIGINT,
  new_contact_rate NUMERIC
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT c.id) as total_contacts,
    COUNT(DISTINCT c.id) FILTER (WHERE c.first_contact_at >= p_date_from) as new_contacts,
    COUNT(DISTINCT c.id) FILTER (WHERE c.first_contact_at < p_date_from) as returning_contacts,
    CASE WHEN COUNT(DISTINCT c.id) > 0
      THEN ROUND((COUNT(DISTINCT c.id) FILTER (WHERE c.first_contact_at >= p_date_from)::NUMERIC / COUNT(DISTINCT c.id)::NUMERIC) * 100, 2)
      ELSE 0
    END as new_contact_rate
  FROM contacts c
  WHERE c.created_at BETWEEN p_date_from AND p_date_to
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_origin IS NULL OR c.origin = p_origin);
END;
$$;
```

---

## 4. Edge Function: Webhook do WhatsApp (Recepção de Leads)

```typescript
// supabase/functions/whatsapp-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ReferralData {
  ctwaClid?: string;
  sourceId?: string;
  sourceType?: string;
  sourceUrl?: string;
  headline?: string;
  body?: string;
  adName?: string;
  campaignName?: string;
  mediaType?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  showAdAttribution?: boolean;
  sourceApp?: string;
  conversionSource?: string;
}

function extractReferralData(msg: any): ReferralData | null {
  const message = msg.message;
  if (!message) return null;

  const contextInfo =
    msg.contextInfo ||
    message.contextInfo ||
    message.extendedTextMessage?.contextInfo;

  if (!contextInfo) return null;

  const hasAdData = contextInfo.showAdAttribution ||
                    contextInfo.entryPointConversionSource ||
                    contextInfo.adReplyInfo ||
                    contextInfo.externalAdReply ||
                    contextInfo.ctwaClid;

  if (!hasAdData) return null;

  const entryPoint = contextInfo.entryPointConversionSource || {};
  const adReply = contextInfo.adReplyInfo || contextInfo.externalAdReply || {};

  const referralData: ReferralData = {
    ctwaClid: contextInfo.ctwaClid || entryPoint.ctwaClid,
    sourceId: entryPoint.sourceId || adReply.sourceId,
    sourceType: entryPoint.sourceType || adReply.sourceType ||
                (contextInfo.showAdAttribution ? 'ad' : undefined),
    sourceUrl: adReply.sourceUrl || adReply.url,
    headline: adReply.headline || adReply.title,
    body: adReply.body || adReply.description,
    adName: adReply.adName || adReply.title,
    campaignName: adReply.campaignName || adReply.campaign,
    mediaType: adReply.mediaType,
    imageUrl: adReply.thumbnail || adReply.thumbnailUrl || adReply.imageUrl,
    thumbnailUrl: adReply.thumbnail || adReply.thumbnailUrl,
    showAdAttribution: contextInfo.showAdAttribution === true,
  };

  // Limpar campos undefined
  Object.keys(referralData).forEach(key => {
    if (referralData[key as keyof ReferralData] === undefined) {
      delete referralData[key as keyof ReferralData];
    }
  });

  if (Object.keys(referralData).length === 0) return null;

  return referralData;
}

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const payload = await req.json();

  // Extrair dados da mensagem
  const phone = payload.from || payload.data?.key?.remoteJid?.replace('@s.whatsapp.net', '');
  const name = payload.pushName || payload.data?.pushName;
  const message = payload.message || payload.data?.message;

  // Extrair dados de referral (Meta Ads)
  const referralData = extractReferralData(payload);

  // Determinar origem
  const origin = referralData ? 'meta_ads' : 'whatsapp';
  const originCampaign = referralData?.headline || referralData?.adName || referralData?.campaignName;

  // Upsert do contato
  const { data: contact, error } = await supabase
    .from('contacts')
    .upsert({
      phone,
      full_name: name || `WhatsApp ${phone}`,
      origin,
      origin_campaign: originCampaign,
      referral_data: referralData,
      first_contact_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'phone',
      ignoreDuplicates: false
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting contact:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({
    success: true,
    contact_id: contact.id,
    origin,
    is_meta_ads: !!referralData
  }), { status: 200 });
});
```

---

## 5. Edge Function: Sincronização do Meta Ads

```typescript
// supabase/functions/meta-sync/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { accountId, dateFrom, dateTo, action } = await req.json();

  // Buscar conta do Meta
  const { data: metaAccount } = await supabase
    .from('meta_ad_accounts')
    .select('*')
    .eq('id', accountId)
    .single();

  if (!metaAccount) {
    return new Response(JSON.stringify({ error: 'Account not found' }), { status: 404 });
  }

  const accessToken = metaAccount.access_token;
  const adAccountId = metaAccount.account_id;

  if (action === 'sync-campaigns') {
    // Buscar campanhas da API do Meta
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${adAccountId}/campaigns?` +
      `fields=id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time,created_time` +
      `&limit=500&access_token=${accessToken}`
    );

    const data = await response.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message }), { status: 500 });
    }

    // Upsert campanhas
    for (const campaign of data.data || []) {
      await supabase.from('meta_campaigns').upsert({
        meta_account_id: accountId,
        campaign_id: campaign.id,
        name: campaign.name,
        objective: campaign.objective,
        status: campaign.status,
        daily_budget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
        lifetime_budget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : null,
        start_time: campaign.start_time,
        stop_time: campaign.stop_time,
        created_time: campaign.created_time,
      }, { onConflict: 'meta_account_id,campaign_id' });
    }

    return new Response(JSON.stringify({
      success: true,
      campaignsCount: data.data?.length || 0
    }));
  }

  if (action === 'sync-insights') {
    // Buscar campanhas do banco
    const { data: campaigns } = await supabase
      .from('meta_campaigns')
      .select('id, campaign_id')
      .eq('meta_account_id', accountId);

    let totalInsights = 0;

    for (const campaign of campaigns || []) {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${campaign.campaign_id}/insights?` +
        `fields=impressions,clicks,spend,reach,ctr,cpc,cpm,actions` +
        `&time_range={"since":"${dateFrom}","until":"${dateTo}"}` +
        `&time_increment=1&access_token=${accessToken}`
      );

      const data = await response.json();

      for (const insight of data.data || []) {
        // Calcular conversões
        let conversions = 0;
        if (insight.actions) {
          conversions = insight.actions
            .filter((a: any) =>
              a.action_type.includes('conversion') ||
              a.action_type.includes('lead') ||
              a.action_type === 'onsite_conversion.messaging_first_reply'
            )
            .reduce((sum: number, a: any) => sum + parseInt(a.value), 0);
        }

        const spend = parseFloat(insight.spend || '0');

        await supabase.from('meta_campaign_insights').upsert({
          campaign_id: campaign.id,
          date_start: insight.date_start,
          date_stop: insight.date_stop,
          impressions: parseInt(insight.impressions || '0'),
          clicks: parseInt(insight.clicks || '0'),
          spend,
          reach: parseInt(insight.reach || '0'),
          ctr: parseFloat(insight.ctr || '0'),
          cpc: parseFloat(insight.cpc || '0'),
          cpm: parseFloat(insight.cpm || '0'),
          conversions,
          cost_per_conversion: conversions > 0 ? spend / conversions : null,
          actions: insight.actions || []
        }, { onConflict: 'campaign_id,date_start' });

        totalInsights++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      insightsCount: totalInsights
    }));
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
});
```

---

## 6. Hooks React (Frontend)

### 6.1 useLeadsByOrigin

```typescript
// src/hooks/useLeadJourneyDashboard.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';

export interface DashboardFilters {
  dateFrom: Date;
  dateTo: Date;
  agentId?: string;
  departmentId?: string;
}

export interface LeadOriginData {
  origin: string;
  label: string;
  total: number;
  converted: number;
  conversionRate: number;
  color: string;
}

const ORIGIN_CONFIG: Record<string, { label: string; color: string }> = {
  meta_ads: { label: 'Meta Ads', color: '#1877F2' },
  organic: { label: 'Orgânico', color: '#39E09B' },
  referral: { label: 'Indicação', color: '#EC4899' },
  manual: { label: 'Manual', color: '#8B5CF6' },
  whatsapp: { label: 'WhatsApp Direto', color: '#25D366' },
  other: { label: 'Outros', color: '#94A3B8' },
};

export function useLeadsByOrigin(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['leads_by_origin', filters],
    queryFn: async (): Promise<LeadOriginData[]> => {
      const { data, error } = await supabase.rpc('get_leads_by_origin', {
        p_date_from: startOfDay(filters.dateFrom).toISOString(),
        p_date_to: endOfDay(filters.dateTo).toISOString(),
        p_agent_id: filters.agentId || null,
        p_department_id: filters.departmentId || null,
        p_conversion_status_names: ['06 - Fechado Ganho'], // Ajustar conforme status de conversão
      });

      if (error) throw error;

      return (data || [])
        .map((row: any) => {
          const config = ORIGIN_CONFIG[row.origin] || ORIGIN_CONFIG.other;
          return {
            origin: row.origin,
            label: config.label,
            total: Number(row.total),
            converted: Number(row.converted),
            conversionRate: row.total > 0 ? (row.converted / row.total) * 100 : 0,
            color: config.color,
          };
        })
        .filter((r: LeadOriginData) => r.total > 0)
        .sort((a: LeadOriginData, b: LeadOriginData) => b.total - a.total);
    },
    staleTime: 30000,
  });
}
```

### 6.2 useMetaAds (Campanhas e Métricas)

```typescript
// src/hooks/useMetaAds.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CampaignWithInsights {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  insights?: {
    impressions: number;
    clicks: number;
    spend: number;
    ctr: number;
    cpc: number;
    conversions: number;
  };
  ctwLeads?: number;
  realCpl?: number | null;
}

export interface AggregatedInsights {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  avgCtr: number;
  avgCpc: number;
  ctwLeads: number;
  realCpl: number | null;
}

export function useMetaAccounts() {
  return useQuery({
    queryKey: ['meta-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_ad_accounts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });
}

export function useMetaAccountInsights(accountId: string | null, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['meta-account-insights', accountId, dateFrom, dateTo],
    queryFn: async (): Promise<AggregatedInsights | null> => {
      if (!accountId) return null;

      // Buscar campanhas da conta
      const { data: campaigns } = await supabase
        .from('meta_campaigns')
        .select('id')
        .eq('meta_account_id', accountId);

      if (!campaigns?.length) return null;

      // Buscar insights
      let query = supabase
        .from('meta_campaign_insights')
        .select('*')
        .in('campaign_id', campaigns.map(c => c.id));

      if (dateFrom) query = query.gte('date_start', dateFrom);
      if (dateTo) query = query.lte('date_stop', dateTo);

      const { data: insights } = await query;

      // Agregar métricas
      const aggregated: AggregatedInsights = {
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
        avgCtr: 0,
        avgCpc: 0,
        ctwLeads: 0,
        realCpl: null
      };

      insights?.forEach(insight => {
        aggregated.totalSpend += Number(insight.spend) || 0;
        aggregated.totalImpressions += Number(insight.impressions) || 0;
        aggregated.totalClicks += Number(insight.clicks) || 0;
        aggregated.totalConversions += Number(insight.conversions) || 0;
      });

      if (aggregated.totalImpressions > 0) {
        aggregated.avgCtr = (aggregated.totalClicks / aggregated.totalImpressions) * 100;
      }
      if (aggregated.totalClicks > 0) {
        aggregated.avgCpc = aggregated.totalSpend / aggregated.totalClicks;
      }

      // Buscar leads CTWA (Click-to-WhatsApp)
      let leadsQuery = supabase
        .from('contacts')
        .select('id', { count: 'exact' })
        .eq('origin', 'meta_ads');

      if (dateFrom) leadsQuery = leadsQuery.gte('created_at', dateFrom);
      if (dateTo) leadsQuery = leadsQuery.lte('created_at', dateTo + 'T23:59:59');

      const { count: ctwLeads } = await leadsQuery;
      aggregated.ctwLeads = ctwLeads || 0;

      if (aggregated.ctwLeads > 0 && aggregated.totalSpend > 0) {
        aggregated.realCpl = aggregated.totalSpend / aggregated.ctwLeads;
      }

      return aggregated;
    },
    enabled: !!accountId
  });
}

export function useSyncMetaAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, dateFrom, dateTo }: {
      accountId: string;
      dateFrom?: string;
      dateTo?: string
    }) => {
      const { data, error } = await supabase.functions.invoke('meta-sync', {
        body: { accountId, dateFrom, dateTo, action: 'sync-all' }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['meta-account-insights'] });
    }
  });
}
```

---

## 7. Componentes da Dashboard

### 7.1 Página Principal da Dashboard

```tsx
// src/pages/Dashboard.tsx
import { useState } from 'react';
import { startOfMonth } from 'date-fns';
import { useLeadsByOrigin, useLeadJourneyMetrics, useStatusFunnel, DashboardFilters } from '@/hooks/useLeadJourneyDashboard';

import { JourneyKPICards } from '@/components/dashboard/JourneyKPICards';
import { OriginBreakdownChart } from '@/components/dashboard/OriginBreakdownChart';
import { StatusFunnelChart } from '@/components/dashboard/StatusFunnelChart';
import { AdvancedFilters } from '@/components/dashboard/AdvancedFilters';

export default function Dashboard() {
  const [filters, setFilters] = useState<DashboardFilters>({
    dateFrom: startOfMonth(new Date()),
    dateTo: new Date(),
  });

  const { data: originData, isLoading: loadingOrigin } = useLeadsByOrigin(filters);
  const { data: metrics, isLoading: loadingMetrics } = useLeadJourneyMetrics(filters);
  const { data: funnelData, isLoading: loadingFunnel } = useStatusFunnel(filters);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard de Leads</h1>
        <p className="text-muted-foreground">
          Acompanhe a jornada dos leads e performance do time
        </p>
      </div>

      <AdvancedFilters filters={filters} onFiltersChange={setFilters} />

      <JourneyKPICards metrics={metrics} isLoading={loadingMetrics} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <OriginBreakdownChart data={originData} isLoading={loadingOrigin} />
        <StatusFunnelChart data={funnelData} isLoading={loadingFunnel} />
      </div>
    </div>
  );
}
```

### 7.2 KPIs Cards

```tsx
// src/components/dashboard/JourneyKPICards.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, TrendingUp, Clock } from 'lucide-react';

interface Props {
  metrics?: {
    totalLeads: number;
    totalAssigned: number;
    assignmentRate: number;
    conversions: number;
    conversionRate: number;
  };
  isLoading: boolean;
}

export function JourneyKPICards({ metrics, isLoading }: Props) {
  const cards = [
    {
      title: 'Total de Leads',
      value: metrics?.totalLeads || 0,
      icon: Users,
      color: 'text-blue-600'
    },
    {
      title: 'Leads Atribuídos',
      value: metrics?.totalAssigned || 0,
      icon: UserCheck,
      suffix: `(${metrics?.assignmentRate?.toFixed(1) || 0}%)`,
      color: 'text-green-600'
    },
    {
      title: 'Conversões',
      value: metrics?.conversions || 0,
      icon: TrendingUp,
      suffix: `(${metrics?.conversionRate?.toFixed(1) || 0}%)`,
      color: 'text-purple-600'
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : card.value.toLocaleString('pt-BR')}
              {card.suffix && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  {card.suffix}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### 7.3 Gráfico de Origem (Pizza)

```tsx
// src/components/dashboard/OriginBreakdownChart.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface Props {
  data?: Array<{
    origin: string;
    label: string;
    total: number;
    color: string;
  }>;
  isLoading: boolean;
}

export function OriginBreakdownChart({ data, isLoading }: Props) {
  if (isLoading) {
    return <Card><CardContent className="h-80 flex items-center justify-center">Carregando...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads por Origem</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={100}
              dataKey="total"
              nameKey="label"
              label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
            >
              {data?.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => value.toLocaleString('pt-BR')}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

---

## 8. Página do Meta Ads Manager

```tsx
// src/pages/MetaAdsManager.tsx
import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, DollarSign, MousePointer, Eye, Users, Target, Facebook } from 'lucide-react';
import {
  useMetaAccounts,
  useMetaAccountInsights,
  useSyncMetaAccount
} from '@/hooks/useMetaAds';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function MetaAdsManager() {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [dateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date()
  });

  const { data: accounts, isLoading: accountsLoading } = useMetaAccounts();
  const { mutate: syncAccount, isPending: isSyncing } = useSyncMetaAccount();

  const dateFrom = format(dateRange.from, 'yyyy-MM-dd');
  const dateTo = format(dateRange.to, 'yyyy-MM-dd');

  const { data: insights, isLoading: insightsLoading } = useMetaAccountInsights(
    selectedAccountId, dateFrom, dateTo
  );

  // Auto-selecionar primeira conta
  if (accounts?.length && !selectedAccountId) {
    setSelectedAccountId(accounts[0].id);
  }

  const handleSync = () => {
    if (selectedAccountId) {
      syncAccount({ accountId: selectedAccountId, dateFrom, dateTo });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Facebook className="h-6 w-6 text-blue-600" />
            Meta Ads Manager
          </h1>
          <p className="text-muted-foreground">
            Gerencie e analise suas campanhas do Meta Ads
          </p>
        </div>

        <div className="flex items-center gap-3">
          {accounts?.length > 0 && (
            <Select value={selectedAccountId || ''} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Selecione uma conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.account_name || account.account_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {selectedAccountId && (
            <Button onClick={handleSync} disabled={isSyncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
          )}
        </div>
      </div>

      {selectedAccountId && insights && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Gasto Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(insights.totalSpend)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Impressões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {insights.totalImpressions.toLocaleString('pt-BR')}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MousePointer className="h-4 w-4" />
                Cliques
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {insights.totalClicks.toLocaleString('pt-BR')}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Leads CTWA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{insights.ctwLeads}</div>
              <p className="text-xs text-muted-foreground">Via WhatsApp</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                CPL Real
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {insights.realCpl ? formatCurrency(insights.realCpl) : '-'}
              </div>
              <p className="text-xs text-muted-foreground">Custo por lead</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
```

---

## 9. Fluxo de Dados Resumido

```
┌─────────────────────────────────────────────────────────────┐
│  ENTRADA DE LEADS                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Usuário clica em anúncio Meta Ads (CTWA)               │
│                    ↓                                        │
│  2. WhatsApp recebe mensagem com contextInfo               │
│                    ↓                                        │
│  3. Webhook extrai referral_data (Meta Ads info)           │
│                    ↓                                        │
│  4. UPSERT em contacts com:                                │
│     - origin = 'meta_ads'                                  │
│     - origin_campaign = nome do anúncio                    │
│     - referral_data = JSON completo                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  SINCRONIZAÇÃO META ADS                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Conectar conta Meta via OAuth                          │
│                    ↓                                        │
│  2. Edge Function meta-sync busca:                         │
│     - Campanhas (meta_campaigns)                           │
│     - Insights diários (meta_campaign_insights)            │
│     - Anúncios (meta_ads)                                  │
│                    ↓                                        │
│  3. Dashboard correlaciona:                                │
│     - Gasto por campanha                                   │
│     - Leads CTWA (origin='meta_ads')                       │
│     - CPL Real = gasto / leads CTWA                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  DASHBOARD                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ KPIs: Total Leads | Atribuídos | Conversões        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────────┐   │
│  │ Leads por Origem     │  │ Funil de Status          │   │
│  │ (Pie Chart)          │  │ (Bar Chart)              │   │
│  │ - Meta Ads: 45%      │  │ - Novo: 100              │   │
│  │ - Orgânico: 30%      │  │ - Em Contato: 80         │   │
│  │ - WhatsApp: 25%      │  │ - Qualificado: 50        │   │
│  └──────────────────────┘  │ - Fechado: 20            │   │
│                            └──────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Meta Ads: Gasto | Impressões | CPL Real            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Tecnologias e Dependências

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.x",
    "@tanstack/react-query": "^5.x",
    "@supabase/supabase-js": "^2.x",
    "recharts": "^2.x",
    "date-fns": "^3.x",
    "lucide-react": "^0.x",
    "tailwindcss": "^3.x",
    "@radix-ui/react-*": "latest (shadcn/ui)",
    "sonner": "^1.x"
  }
}
```

---

## Resumo Final

Este prompt descreve um sistema completo de:

1. **Dashboard de Leads** com métricas em tempo real (KPIs, funil de status, origem dos leads)
2. **Integração Meta Ads** para sincronizar campanhas e calcular CPL real
3. **Webhook WhatsApp** que detecta leads vindos de Click-to-WhatsApp e marca como `origin='meta_ads'`
4. **Correlação de dados** entre gasto em ads e leads reais recebidos

Os leads entram apenas pelo webhook do WhatsApp (sem criar conversas completas), populando a tabela `contacts` com a origem e dados de referral do Meta Ads.
