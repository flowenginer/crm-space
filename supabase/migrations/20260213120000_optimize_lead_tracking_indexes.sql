-- Composite index for WhatsApp Lead Tracking page query
-- Covers: WHERE tenant_id = ? AND referral_source IN (...) ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_tenant_referral_created
  ON conversations (tenant_id, referral_source, created_at DESC)
  WHERE referral_source IS NOT NULL;

-- Index for meta_ads ad_id lookup (used in sidebar creative enrichment)
-- Already exists as idx_meta_ads_ad_id but ensure composite with tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meta_ads_tenant_ad_id
  ON meta_ads (tenant_id, ad_id);

-- Analyze tables to update query planner statistics
ANALYZE conversations;
ANALYZE meta_ads;
