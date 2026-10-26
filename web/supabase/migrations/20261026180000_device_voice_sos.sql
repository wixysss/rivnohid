-- =====================================================================
-- Рівнохід: голосові нотатки, SOS і автоматичні позначки стану дороги
-- Виконати один раз: Supabase → SQL Editor → Run  (або `supabase db push`)
-- Скрипт ідемпотентний: повторний запуск нічого не зламає.
-- =====================================================================

-- ---------- Тип позначки для автоматичного стану дороги ----------
insert into public.marker_types (slug, label)
select 'road', 'Стан дороги (пристрій)'
where not exists (select 1 from public.marker_types where slug = 'road');

-- ---------- Налаштування пристрою: кому дзвонити при SOS ----------
create table if not exists public.device_settings (
    device_id  uuid primary key references public.devices (id) on delete cascade,
    sos_name   text,
    sos_phone  text not null check (sos_phone ~ '^\+?[0-9]{7,15}$'),
    updated_at timestamptz not null default now(),
    updated_by uuid references auth.users (id) on delete set null
);
alter table public.device_settings enable row level security;
drop policy if exists "device_settings: authenticated read" on public.device_settings;
create policy "device_settings: authenticated read" on public.device_settings
    for select to authenticated using (true);
-- Запис лише через set_sos_settings() нижче

-- ---------- Голосові нотатки ----------
create table if not exists public.voice_notes (
    id          uuid primary key default gen_random_uuid(),
    device_id   uuid references public.devices (id) on delete set null,
    lat         double precision,
    lng         double precision,
    duration_ms integer,
    sample_rate integer not null default 8000,
    audio       bytea not null,                 -- WAV, 16 біт, моно
    created_at  timestamptz not null default now()
);
create index if not exists voice_notes_created_at_idx on public.voice_notes (created_at desc);
alter table public.voice_notes enable row level security;
drop policy if exists "voice_notes: public read" on public.voice_notes;
create policy "voice_notes: public read" on public.voice_notes
    for select to anon, authenticated using (true);
drop policy if exists "voice_notes: authenticated delete" on public.voice_notes;
create policy "voice_notes: authenticated delete" on public.voice_notes
    for delete to authenticated using (true);

-- ---------- SOS-події ----------
create table if not exists public.sos_events (
    id          uuid primary key default gen_random_uuid(),
    device_id   uuid references public.devices (id) on delete set null,
    lat         double precision,
    lng         double precision,
    phone       text,
    called      boolean not null default false,  -- чи дзвонив сам пристрій (SIM800L)
    created_at  timestamptz not null default now(),
    resolved_at timestamptz,
    resolved_by uuid references auth.users (id) on delete set null
);
create index if not exists sos_events_created_at_idx on public.sos_events (created_at desc);
alter table public.sos_events enable row level security;
drop policy if exists "sos_events: authenticated read" on public.sos_events;
create policy "sos_events: authenticated read" on public.sos_events
    for select to authenticated using (true);
drop policy if exists "sos_events: authenticated resolve" on public.sos_events;
create policy "sos_events: authenticated resolve" on public.sos_events
    for update to authenticated using (true) with check (true);

-- =====================================================================
-- API для пристрою. Пристрій знає лише свій токен; у таблиці devices
-- зберігається sha256(токен) у hex. Функції security definer, тож
-- пристрою не потрібні права на таблиці.
-- =====================================================================

create or replace function public._device_from_token(p_token text)
returns uuid
language sql stable security definer set search_path = public as $$
    select id from public.devices
    where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
      and revoked_at is null
    limit 1
$$;
revoke all on function public._device_from_token(text) from public, anon, authenticated;

-- Пристрій вітається при старті й раз на кілька хвилин: оновлює last_seen_at
-- і отримує номер для SOS.
create or replace function public.device_hello(p_token text)
returns json
language plpgsql security definer set search_path = public as $$
declare
    v_device uuid := public._device_from_token(p_token);
    v_res json;
begin
    if v_device is null then raise exception 'unknown device' using errcode = '28000'; end if;
    update public.devices set last_seen_at = now() where id = v_device;
    select json_build_object('sos_phone', s.sos_phone, 'sos_name', s.sos_name)
      into v_res from public.device_settings s where s.device_id = v_device;
    return coalesce(v_res, json_build_object('sos_phone', null, 'sos_name', null));
end $$;

-- Автоматична позначка стану дороги (кнопка 3)
create or replace function public.device_add_marker(
    p_token text, p_lat double precision, p_lng double precision,
    p_severity text, p_description text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
    v_device uuid := public._device_from_token(p_token);
    v_type int;
    v_id uuid;
begin
    if v_device is null then raise exception 'unknown device' using errcode = '28000'; end if;
    if p_severity not in ('ok', 'warning', 'bad') then raise exception 'bad severity'; end if;
    if p_lat is null or p_lng is null or abs(p_lat) > 90 or abs(p_lng) > 180 then raise exception 'bad coordinates'; end if;
    select id into v_type from public.marker_types where slug = 'road';
    if v_type is null then select id into v_type from public.marker_types where slug = 'device'; end if;
    insert into public.markers (type_id, lat, lng, severity, description, source, device_id)
    values (v_type, p_lat, p_lng, p_severity, left(p_description, 500), 'device', v_device)
    returning id into v_id;
    return v_id;
end $$;

-- Голосова нотатка (кнопка 1 → 2). Аудіо приходить як base64 WAV.
create or replace function public.device_add_voice_note(
    p_token text, p_lat double precision, p_lng double precision,
    p_duration_ms integer, p_sample_rate integer, p_audio_b64 text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
    v_device uuid := public._device_from_token(p_token);
    v_audio bytea;
    v_id uuid;
begin
    if v_device is null then raise exception 'unknown device' using errcode = '28000'; end if;
    v_audio := decode(p_audio_b64, 'base64');
    if octet_length(v_audio) > 3 * 1024 * 1024 then raise exception 'audio too large'; end if;
    insert into public.voice_notes (device_id, lat, lng, duration_ms, sample_rate, audio)
    values (v_device, p_lat, p_lng, p_duration_ms, coalesce(p_sample_rate, 8000), v_audio)
    returning id into v_id;
    return v_id;
end $$;

-- SOS (кнопка 4)
create or replace function public.device_sos(
    p_token text, p_lat double precision, p_lng double precision, p_called boolean default false)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
    v_device uuid := public._device_from_token(p_token);
    v_id uuid;
begin
    if v_device is null then raise exception 'unknown device' using errcode = '28000'; end if;
    insert into public.sos_events (device_id, lat, lng, phone, called)
    values (v_device, p_lat, p_lng,
            (select sos_phone from public.device_settings where device_id = v_device), p_called)
    returning id into v_id;
    return v_id;
end $$;

grant execute on function public.device_hello(text) to anon, authenticated;
grant execute on function public.device_add_marker(text, double precision, double precision, text, text) to anon, authenticated;
grant execute on function public.device_add_voice_note(text, double precision, double precision, integer, integer, text) to anon, authenticated;
grant execute on function public.device_sos(text, double precision, double precision, boolean) to anon, authenticated;

-- =====================================================================
-- API для сайту
-- =====================================================================

-- Аудіо нотатки в base64 (щоб не тягнути bytea в списку)
create or replace function public.voice_note_audio(p_id uuid)
returns text
language sql stable security invoker set search_path = public as $$
    select encode(audio, 'base64') from public.voice_notes where id = p_id
$$;
grant execute on function public.voice_note_audio(uuid) to anon, authenticated;

-- Поточний номер SOS (для сторінки налаштувань і кнопки «Подзвонити»)
create or replace function public.get_sos_settings()
returns json
language sql stable security definer set search_path = public as $$
    select json_build_object('sos_phone', s.sos_phone, 'sos_name', s.sos_name, 'updated_at', s.updated_at)
    from public.device_settings s
    join public.devices d on d.id = s.device_id and d.revoked_at is null
    order by s.updated_at desc limit 1
$$;
revoke all on function public.get_sos_settings() from public, anon;
grant execute on function public.get_sos_settings() to authenticated;

-- Зберегти номер SOS для всіх активних пристроїв (зараз пристрій один)
create or replace function public.set_sos_settings(p_name text, p_phone text)
returns void
language plpgsql security definer set search_path = public as $$
begin
    if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
    if p_phone !~ '^\+?[0-9]{7,15}$' then raise exception 'Невірний номер телефону'; end if;
    if not exists (select 1 from public.devices where revoked_at is null) then
        raise exception 'Немає зареєстрованого пристрою';
    end if;
    insert into public.device_settings (device_id, sos_name, sos_phone, updated_at, updated_by)
    select id, nullif(trim(p_name), ''), p_phone, now(), auth.uid()
    from public.devices where revoked_at is null
    on conflict (device_id) do update
        set sos_name = excluded.sos_name, sos_phone = excluded.sos_phone,
            updated_at = now(), updated_by = auth.uid();
end $$;
revoke all on function public.set_sos_settings(text, text) from public, anon;
grant execute on function public.set_sos_settings(text, text) to authenticated;

-- =====================================================================
-- Реєстрація пристрою: виконати ОДИН раз, підставивши хеш токена.
-- Сам токен лежить лише у firmware/secrets.h (DEVICE_TOKEN) і не комітиться.
-- Хеш рахується так:  printf %s "$TOKEN" | sha256sum
-- =====================================================================
-- insert into public.devices (name, token_hash)
-- values ('Рівнохід #1', '<sha256 hex токена>')
-- on conflict do nothing;
