-- Add WhatsApp Lead Tracking menu item to the sidebar
INSERT INTO public.menu_items (title, href, icon, parent_id, position, permission, is_active)
VALUES (
  'Lead Tracking',
  '/whatsapp-lead-tracking',
  'Megaphone',
  NULL,
  15,
  'marketing.view',
  true
)
ON CONFLICT DO NOTHING;
