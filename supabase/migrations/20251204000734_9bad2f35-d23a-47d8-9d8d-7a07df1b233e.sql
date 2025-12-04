-- =============================================
-- SPACE SPORTS CRM - COMPLETE DATABASE SCHEMA
-- =============================================

-- =============================================
-- 1. DEPARTMENTS
-- =============================================
create table if not exists public.departments (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  color text default '#8B5CF6',
  icon text default 'Building',
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add department_id to profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'department_id') THEN
    ALTER TABLE public.profiles ADD COLUMN department_id uuid references public.departments(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
    ALTER TABLE public.profiles ADD COLUMN phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_online') THEN
    ALTER TABLE public.profiles ADD COLUMN is_online boolean default false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_seen_at') THEN
    ALTER TABLE public.profiles ADD COLUMN last_seen_at timestamp with time zone;
  END IF;
END $$;

-- =============================================
-- 2. TAGS
-- =============================================
create table if not exists public.tags (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  color text default '#8B5CF6',
  description text,
  usage_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- 3. CONTACTS
-- =============================================
create table if not exists public.contacts (
  id uuid default gen_random_uuid() primary key,
  full_name text not null,
  phone text not null,
  email text,
  avatar_url text,
  cpf_cnpj text,
  birth_date date,
  person_type text default 'individual' check (person_type in ('individual', 'company')),
  
  -- Address
  zip_code text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  country text default 'Brasil',
  
  -- CRM fields
  lead_status text default 'new' check (lead_status in ('new', 'active', 'qualified', 'unqualified', 'client')),
  assigned_to uuid references public.profiles(id),
  department_id uuid references public.departments(id),
  origin text,
  notes text,
  
  -- Custom fields (JSON)
  custom_fields jsonb default '{}'::jsonb,
  
  -- Status
  is_online boolean default false,
  last_seen_at timestamp with time zone,
  
  -- Timestamps
  first_contact_at timestamp with time zone default timezone('utc'::text, now()),
  last_interaction_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- 4. CONTACT_TAGS (many-to-many)
-- =============================================
create table if not exists public.contact_tags (
  contact_id uuid references public.contacts(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (contact_id, tag_id)
);

-- =============================================
-- 5. WHATSAPP CHANNELS
-- =============================================
create table if not exists public.whatsapp_channels (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text not null,
  channel_id text,
  type text default 'unofficial' check (type in ('unofficial', 'business')),
  status text default 'disconnected' check (status in ('connected', 'disconnected', 'connecting')),
  qr_code text,
  qr_expires_at timestamp with time zone,
  battery_level integer,
  last_sync_at timestamp with time zone,
  messages_sent integer default 0,
  messages_received integer default 0,
  department_id uuid references public.departments(id),
  is_deleted boolean default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- 6. CONVERSATIONS
-- =============================================
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  contact_id uuid references public.contacts(id) on delete cascade not null,
  channel_id uuid references public.whatsapp_channels(id),
  assigned_to uuid references public.profiles(id),
  department_id uuid references public.departments(id),
  
  status text default 'open' check (status in ('open', 'pending', 'closed')),
  lead_status text default 'new',
  
  is_unread boolean default true,
  unread_count integer default 0,
  
  last_message_at timestamp with time zone,
  last_message_preview text,
  
  closed_at timestamp with time zone,
  closed_by uuid references public.profiles(id),
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- 7. MESSAGES
-- =============================================
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id),
  contact_id uuid references public.contacts(id),
  
  content text,
  message_type text default 'text' check (message_type in ('text', 'audio', 'image', 'video', 'document', 'sticker', 'location')),
  media_url text,
  media_mime_type text,
  
  is_from_me boolean default false,
  status text default 'sent' check (status in ('pending', 'sent', 'delivered', 'read', 'failed')),
  
  whatsapp_message_id text,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- 8. MESSAGE TEMPLATES
-- =============================================
create table if not exists public.template_folders (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  color text default '#8B5CF6',
  parent_id uuid references public.template_folders(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.message_templates (
  id uuid default gen_random_uuid() primary key,
  folder_id uuid references public.template_folders(id),
  category text default 'messages' check (category in ('messages', 'audios', 'medias', 'documents', 'funnels', 'triggers')),
  title text not null,
  content text not null,
  variables jsonb default '[]'::jsonb,
  usage_count integer default 0,
  is_favorite boolean default false,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- 9. PIPELINES (CRM)
-- =============================================
create table if not exists public.pipelines (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.pipeline_stages (
  id uuid default gen_random_uuid() primary key,
  pipeline_id uuid references public.pipelines(id) on delete cascade not null,
  name text not null,
  color text default '#8B5CF6',
  order_position integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- 10. DEALS (CRM)
-- =============================================
create table if not exists public.deals (
  id uuid default gen_random_uuid() primary key,
  pipeline_id uuid references public.pipelines(id) not null,
  stage_id uuid references public.pipeline_stages(id) not null,
  contact_id uuid references public.contacts(id),
  assigned_to uuid references public.profiles(id),
  
  title text not null,
  value numeric(12, 2) default 0,
  description text,
  
  status text default 'open' check (status in ('open', 'won', 'lost')),
  order_position integer default 0,
  
  expected_close_date date,
  closed_at timestamp with time zone,
  
  last_activity_at timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- 11. CUSTOM FIELDS DEFINITIONS
-- =============================================
create table if not exists public.custom_field_definitions (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  field_type text not null check (field_type in ('text', 'number', 'date', 'select', 'multiselect', 'checkbox')),
  entity_type text not null check (entity_type in ('contact', 'deal')),
  options jsonb default '[]'::jsonb,
  is_required boolean default false,
  order_position integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- 12. NOTIFICATION SETTINGS
-- =============================================
create table if not exists public.notification_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade unique,
  
  new_messages boolean default true,
  new_deals boolean default true,
  stage_changes boolean default false,
  sla_alerts boolean default true,
  daily_summary boolean default false,
  
  email_enabled boolean default true,
  push_enabled boolean default true,
  whatsapp_enabled boolean default false,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- INDEXES
-- =============================================
create index if not exists contacts_phone_idx on public.contacts(phone);
create index if not exists contacts_email_idx on public.contacts(email);
create index if not exists contacts_assigned_to_idx on public.contacts(assigned_to);
create index if not exists contacts_lead_status_idx on public.contacts(lead_status);
create index if not exists conversations_contact_id_idx on public.conversations(contact_id);
create index if not exists conversations_assigned_to_idx on public.conversations(assigned_to);
create index if not exists conversations_status_idx on public.conversations(status);
create index if not exists messages_conversation_id_idx on public.messages(conversation_id);
create index if not exists deals_pipeline_id_idx on public.deals(pipeline_id);
create index if not exists deals_stage_id_idx on public.deals(stage_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
alter table public.departments enable row level security;
alter table public.tags enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_tags enable row level security;
alter table public.whatsapp_channels enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.template_folders enable row level security;
alter table public.message_templates enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.deals enable row level security;
alter table public.custom_field_definitions enable row level security;
alter table public.notification_settings enable row level security;

-- RLS Policies
create policy "Authenticated access departments" on public.departments for all using (auth.uid() is not null);
create policy "Authenticated access tags" on public.tags for all using (auth.uid() is not null);
create policy "Authenticated access contacts" on public.contacts for all using (auth.uid() is not null);
create policy "Authenticated access contact_tags" on public.contact_tags for all using (auth.uid() is not null);
create policy "Authenticated access whatsapp_channels" on public.whatsapp_channels for all using (auth.uid() is not null);
create policy "Authenticated access conversations" on public.conversations for all using (auth.uid() is not null);
create policy "Authenticated access messages" on public.messages for all using (auth.uid() is not null);
create policy "Authenticated access template_folders" on public.template_folders for all using (auth.uid() is not null);
create policy "Authenticated access message_templates" on public.message_templates for all using (auth.uid() is not null);
create policy "Authenticated access pipelines" on public.pipelines for all using (auth.uid() is not null);
create policy "Authenticated access pipeline_stages" on public.pipeline_stages for all using (auth.uid() is not null);
create policy "Authenticated access deals" on public.deals for all using (auth.uid() is not null);
create policy "Authenticated access custom_field_definitions" on public.custom_field_definitions for all using (auth.uid() is not null);
create policy "Authenticated access notification_settings" on public.notification_settings for all using (auth.uid() is not null);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_contacts_updated_at') THEN
    create trigger set_contacts_updated_at before update on public.contacts for each row execute function public.handle_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_whatsapp_channels_updated_at') THEN
    create trigger set_whatsapp_channels_updated_at before update on public.whatsapp_channels for each row execute function public.handle_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_conversations_updated_at') THEN
    create trigger set_conversations_updated_at before update on public.conversations for each row execute function public.handle_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_deals_updated_at') THEN
    create trigger set_deals_updated_at before update on public.deals for each row execute function public.handle_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_notification_settings_updated_at') THEN
    create trigger set_notification_settings_updated_at before update on public.notification_settings for each row execute function public.handle_updated_at();
  END IF;
END $$;

-- =============================================
-- SEED DATA
-- =============================================
insert into public.departments (name, description, color, icon) values
  ('Vendas', 'Equipe de vendas e atendimento comercial', '#8B5CF6', 'ShoppingCart'),
  ('Pós-vendas', 'Acompanhamento de pedidos e suporte', '#3B82F6', 'Package'),
  ('Suporte', 'Atendimento técnico e dúvidas', '#10B981', 'Headphones'),
  ('Financeiro', 'Cobranças e pagamentos', '#F59E0B', 'DollarSign'),
  ('Expedição', 'Logística e entregas', '#EF4444', 'Truck')
on conflict do nothing;

insert into public.tags (name, color) values
  ('Urgente', '#EF4444'),
  ('VIP', '#F59E0B'),
  ('Follow-up', '#3B82F6'),
  ('Cliente', '#10B981'),
  ('Novo Lead', '#8B5CF6'),
  ('Recorrente', '#14B8A6')
on conflict (name) do nothing;

insert into public.pipelines (name, description, is_active) values
  ('Venda', 'Pipeline principal de vendas', true)
on conflict do nothing;

insert into public.custom_field_definitions (name, field_type, entity_type, options, order_position) values
  ('Tamanho de camisa', 'select', 'contact', '["P", "M", "G", "GG", "G1", "G2", "G3", "G4"]', 1),
  ('Esporte preferido', 'text', 'contact', '[]', 2),
  ('Time/Equipe', 'text', 'contact', '[]', 3),
  ('Quantidade usual', 'number', 'contact', '[]', 4),
  ('Prazo de entrega', 'date', 'deal', '[]', 5)
on conflict do nothing;