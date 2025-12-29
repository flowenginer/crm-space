-- Grant table permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ad_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ad_accounts TO service_role;

-- Grant permissions on related tables if needed
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_campaigns TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_campaign_insights TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_campaign_insights TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ads TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_oauth_states TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_oauth_states TO service_role;