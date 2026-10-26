create table public.name ( col type constraints, ... );

alter table public.name enable row level security;

create policy "name" on public.table
  for select | insert | update | delete
    to anon | authenticated
    using (...)        -- какие СТРОКИ можно видеть/менять
      with check (...);  -- какие значения можно ЗАПИСАТЬ

create function public.fn() returns trigger
    language plpgsql security definer set search_path = ''
  as $$ begin ... return new; end; $$;

create trigger name after insert on auth.users
    for each row execute function public.fn();
create table public.profiles (
                                 id uuid primary key references auth.users(id) on delete cascade,
                                 display_name text,
                                 created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create function public.handle_new_user()
    returns trigger
    language plpgsql
security definer set search_path = ''
as $$
begin
insert into public.profiles (id, display_name)
values (
           new.id,
           coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
       );
return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

create table public.marker_types (
                                     id smallint generated always as identity primary key,
                                     slug text not null unique,
                                     label text not null
);

alter table public.marker_types enable row level security;

insert into public.marker_types (slug, label) values
                                                  ('ramp', 'Пандус'),
                                                  ('noise', 'Шум'),
                                                  ('obstacle', 'Препятствие');
create table public.markers (
                                id uuid primary key default gen_random_uuid(),
                                user_id uuid default auth.uid() references public.profiles(id) on delete set null,
                                type_id smallint not null references public.marker_types(id),
                                lat double precision not null check (lat between -90 and 90),
                                lng double precision not null check (lng between -180 and 180),
                                description text check (char_length(description) <= 500),
                                source text not null default 'user' check (source in ('user', 'device')),
                                created_at timestamptz not null default now()
);

create index markers_lat_lng_idx on public.markers (lat, lng);

alter table public.markers enable row level security;

-- profiles
create policy "profiles readable by everyone"
  on public.profiles for select to anon, authenticated
                                    using (true);

create policy "users update own profile"
  on public.profiles for update to authenticated
                                    using (auth.uid() = id)
                         with check (auth.uid() = id);

-- marker_types
create policy "types readable by everyone"
  on public.marker_types for select to anon, authenticated
                                        using (true);

-- markers
create policy "markers readable by everyone"
  on public.markers for select to anon, authenticated
                                   using (true);

create policy "logged in users add markers"
  on public.markers for insert to authenticated
  with check (auth.uid() = user_id and source = 'user');

create policy "users update own markers"
  on public.markers for update to authenticated
                                          using (auth.uid() = user_id)
                        with check (auth.uid() = user_id and source = 'user');

create policy "users delete own markers"
  on public.markers for delete to authenticated
  using (auth.uid() = user_id);

insert into public.markers (type_id, lat, lng, description, source)
select id, 48.4647, 35.0462, 'Пандус у входа', 'device'
from public.marker_types where slug = 'ramp';

insert into public.markers (type_id, lat, lng, description, source)
select id, 48.4700, 35.0400, 'Шумный перекрёсток', 'device'
from public.marker_types where slug = 'noise';

insert into public.markers (type_id, lat, lng, description, source)
select id, 48.4600, 35.0550, 'Ступеньки без пандуса', 'device'
from public.marker_types where slug = 'obstacle';

insert into public.markers (type_id, lat, lng, description, source, severity)
select id, 50.2600, 28.6500, 'Терпимо', 'device', 'warning'
from public.marker_types where slug = 'ramp';

insert into public.markers (type_id, lat, lng, description, source, severity)
select id, 50.2500, 28.6700, 'Всё хорошо', 'device', 'ok'
from public.marker_types where slug = 'ramp';

-- 1. Пристрої (пульти)
create table public.devices (
                                id uuid primary key default gen_random_uuid(),
                                name text not null,
                                token_hash text not null unique,
                                created_at timestamptz not null default now(),
                                last_seen_at timestamptz,
                                revoked_at timestamptz
);

-- RLS увімкнено, політик немає: з браузера таблиця недоступна взагалі
alter table public.devices enable row level security;

-- 2. Звідки мітка + захист від дублів при повторах із черги
alter table public.markers
    add column device_id uuid references public.devices(id) on delete set null,
  add column event_id text check (char_length(event_id) <= 64);

create unique index markers_device_event_uq
    on public.markers (device_id, event_id)
    where event_id is not null;

-- 3. Типи для міток пульта
insert into public.marker_types (slug, label) values
                                                  ('pothole', 'Яма / нерівність'),
                                                  ('device',  'Відмітка з пульта')
    on conflict (slug) do nothing;

-- а) згенеруй токен і скопіюй з результату
select encode(extensions.gen_random_bytes(32), 'hex') as token;

-- б) підстав його: у базу піде лише хеш
insert into public.devices (name, token_hash)
values ('pult-01', encode(extensions.digest('ВСТАВ_ТОКЕН', 'sha256'), 'hex'));

select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'markers'
order by ordinal_position;

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.markers'::regclass;