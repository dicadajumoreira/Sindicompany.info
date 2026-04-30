-- =============================================================
-- Hubstation — Schema inicial (Fase 1)
-- Cole isso no SQL Editor do Supabase e clique em RUN.
-- =============================================================

-- Extensões úteis
create extension if not exists "uuid-ossp";

-- ============= TABELAS =============

create table if not exists public.condos (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  logo_url text,
  brand_color text default '#56CFE1',
  sindico_data jsonb default '{}'::jsonb,
  admin_data jsonb default '{}'::jsonb,
  juridico_data jsonb default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_condos_slug on public.condos(slug);

-- Roles: sindico, conselheiro, morador
create table if not exists public.memberships (
  id uuid primary key default uuid_generate_v4(),
  condo_id uuid not null references public.condos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('sindico','conselheiro','morador')),
  created_at timestamptz not null default now(),
  unique (condo_id, user_id)
);

create index if not exists idx_memberships_user on public.memberships(user_id);
create index if not exists idx_memberships_condo on public.memberships(condo_id);

-- ============= TABELAS DE FEATURES (esqueleto, preencher na Fase 3) =============

create table if not exists public.notes (
  id uuid primary key default uuid_generate_v4(),
  condo_id uuid not null references public.condos(id) on delete cascade,
  scope text not null default 'visao_geral',
  content text not null default '',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.apontamentos (
  id uuid primary key default uuid_generate_v4(),
  condo_id uuid not null references public.condos(id) on delete cascade,
  titulo text not null,
  status text not null default 'aberto',
  prioridade text default 'media',
  descricao text,
  data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documentos (
  id uuid primary key default uuid_generate_v4(),
  condo_id uuid not null references public.condos(id) on delete cascade,
  nome text not null,
  storage_path text not null,
  mime_type text,
  visibility text not null default 'todos' check (visibility in ('sindico','conselheiro','todos')),
  hidden boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.vp_items (
  id uuid primary key default uuid_generate_v4(),
  condo_id uuid not null references public.condos(id) on delete cascade,
  titulo text not null,
  inicio date,
  termino date,
  status text default 'planejado',
  data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.vp_fotos (
  id uuid primary key default uuid_generate_v4(),
  condo_id uuid not null references public.condos(id) on delete cascade,
  vp_item_id uuid not null references public.vp_items(id) on delete cascade,
  storage_path text not null,
  ordem int default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.juridico_processos (
  id uuid primary key default uuid_generate_v4(),
  condo_id uuid not null references public.condos(id) on delete cascade,
  codigo text not null,
  secao text,
  status text,
  valor numeric,
  prazo date,
  data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.plano_diretor_items (
  id uuid primary key default uuid_generate_v4(),
  condo_id uuid not null references public.condos(id) on delete cascade,
  categoria text not null,
  titulo text not null,
  inicio date,
  termino date,
  conclusao int default 0,
  data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============= HELPERS =============

create or replace function public.is_member_of(_condo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where condo_id = _condo_id and user_id = auth.uid()
  );
$$;

create or replace function public.role_in(_condo_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.memberships
  where condo_id = _condo_id and user_id = auth.uid()
  limit 1;
$$;

-- ============= RLS =============

alter table public.condos enable row level security;
alter table public.memberships enable row level security;
alter table public.notes enable row level security;
alter table public.apontamentos enable row level security;
alter table public.documentos enable row level security;
alter table public.vp_items enable row level security;
alter table public.vp_fotos enable row level security;
alter table public.juridico_processos enable row level security;
alter table public.plano_diretor_items enable row level security;

-- condos: membros podem ler; só síndico atualiza
drop policy if exists "condos_select_members" on public.condos;
create policy "condos_select_members" on public.condos
  for select using (public.is_member_of(id));

drop policy if exists "condos_update_sindico" on public.condos;
create policy "condos_update_sindico" on public.condos
  for update using (public.role_in(id) = 'sindico')
  with check (public.role_in(id) = 'sindico');

-- memberships: usuário vê só os próprios; síndico vê os do seu condo
drop policy if exists "memberships_select_self" on public.memberships;
create policy "memberships_select_self" on public.memberships
  for select using (
    user_id = auth.uid() or public.role_in(condo_id) = 'sindico'
  );

drop policy if exists "memberships_insert_sindico" on public.memberships;
create policy "memberships_insert_sindico" on public.memberships
  for insert with check (public.role_in(condo_id) = 'sindico');

drop policy if exists "memberships_delete_sindico" on public.memberships;
create policy "memberships_delete_sindico" on public.memberships
  for delete using (public.role_in(condo_id) = 'sindico');

-- Padrão para tabelas filhas: leitura para membros, escrita para síndico+conselheiro
do $$
declare
  t text;
  tables text[] := array[
    'notes','apontamentos','documentos','vp_items','vp_fotos',
    'juridico_processos','plano_diretor_items'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "%1$s_select" on public.%1$s', t);
    execute format(
      'create policy "%1$s_select" on public.%1$s for select using (public.is_member_of(condo_id))', t
    );
    execute format('drop policy if exists "%1$s_write" on public.%1$s', t);
    execute format(
      'create policy "%1$s_write" on public.%1$s for all using (public.role_in(condo_id) in (''sindico'',''conselheiro'')) with check (public.role_in(condo_id) in (''sindico'',''conselheiro''))', t
    );
  end loop;
end $$;

-- ============= TRIGGERS =============

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_condos_touch on public.condos;
create trigger trg_condos_touch before update on public.condos
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_apontamentos_touch on public.apontamentos;
create trigger trg_apontamentos_touch before update on public.apontamentos
  for each row execute function public.touch_updated_at();
