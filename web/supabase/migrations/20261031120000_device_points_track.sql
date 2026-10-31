-- =====================================================================
-- Рівнохід 3.0: точки з пристрою (кнопка 3) з нотатками й голосом
-- та GPS-трек зі станом дороги для навігатора.
-- Виконати один раз: Supabase → SQL Editor → Run. Скрипт ідемпотентний.
-- =====================================================================

-- ---------- Тип позначки: точка з пристрою ----------
insert into public.marker_types (slug, label)
select 'point', 'Точка з пристрою'
where not exists (select 1 from public.marker_types where slug = 'point');

-- ---------- Голосова нотатка належить точці ----------
alter table public.voice_notes
    add column if not exists marker_id uuid references public.markers (id) on delete set null;
create index if not exists voice_notes_marker_id_idx on public.voice_notes (marker_id);

-- ---------- Трек пристрою: координата + струс (RMS, g) ----------
create table if not exists public.device_track (
    id         bigint generated always as identity primary key,
    device_id  uuid references public.devices (id) on delete cascade,
    lat        double precision not null,
    lng        double precision not null,
    rms        real,
    created_at timestamptz not null default now()
);
create index if not exists device_track_created_at_idx on public.device_track (created_at desc);
alter table public.device_track enable row level security;
drop policy if exists "device_track: public read" on public.device_track;
create policy "device_track: public read" on public.device_track
    for select to anon, authenticated using (true);
drop policy if exists "device_track: authenticated delete" on public.device_track;
create policy "device_track: authenticated delete" on public.device_track
    for delete to authenticated using (true);

-- =====================================================================
-- API для пристрою
-- =====================================================================

-- Точка (кнопка 3): ставиться там, де натиснули; severity — стан дороги за останні 10 с
create or replace function public.device_add_point(
    p_token text, p_lat double precision, p_lng double precision,
    p_severity text default 'ok', p_rms real default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
    v_device uuid := public._device_from_token(p_token);
    v_type int;
    v_id uuid;
begin
    if v_device is null then raise exception 'unknown device' using errcode = '28000'; end if;
    if p_lat is null or p_lng is null or abs(p_lat) > 90 or abs(p_lng) > 180 then raise exception 'bad coordinates'; end if;
    select id into v_type from public.marker_types where slug = 'point';
    insert into public.markers (type_id, lat, lng, severity, description, source, device_id)
    values (v_type, p_lat, p_lng,
            case when p_severity in ('ok', 'warning', 'bad') then p_severity else 'ok' end,
            null, 'device', v_device)
    returning id into v_id;
    return v_id;
end $$;

-- Голосова нотатка (кнопка 1 → 2). p_point_id — точка, до якої прив'язати запис.
-- Без точки, але з координатами, точка створюється автоматично.
drop function if exists public.device_add_voice_note(text, double precision, double precision, integer, integer, text);
create or replace function public.device_add_voice_note(
    p_token text, p_lat double precision, p_lng double precision,
    p_duration_ms integer, p_sample_rate integer, p_audio_b64 text,
    p_point_id uuid default null, p_severity text default 'ok')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
    v_device uuid := public._device_from_token(p_token);
    v_audio bytea;
    v_marker uuid;
    v_id uuid;
begin
    if v_device is null then raise exception 'unknown device' using errcode = '28000'; end if;
    v_audio := decode(p_audio_b64, 'base64');
    if octet_length(v_audio) > 3 * 1024 * 1024 then raise exception 'audio too large'; end if;

    if p_point_id is not null then
        select id into v_marker from public.markers where id = p_point_id and device_id = v_device;
    end if;
    if v_marker is null and p_lat is not null and p_lng is not null then
        v_marker := public.device_add_point(p_token, p_lat, p_lng, p_severity, null);
    end if;

    insert into public.voice_notes (device_id, lat, lng, duration_ms, sample_rate, audio, marker_id)
    values (v_device,
            coalesce(p_lat, (select lat from public.markers where id = v_marker)),
            coalesce(p_lng, (select lng from public.markers where id = v_marker)),
            p_duration_ms, coalesce(p_sample_rate, 8000), v_audio, v_marker)
    returning id into v_id;
    return v_id;
end $$;

-- Пачка точок треку: [[lat, lng, rms, секунд_тому], ...]
create or replace function public.device_add_track(p_token text, p_points jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare
    v_device uuid := public._device_from_token(p_token);
    v_n integer;
begin
    if v_device is null then raise exception 'unknown device' using errcode = '28000'; end if;
    if jsonb_typeof(p_points) <> 'array' or jsonb_array_length(p_points) > 300 then raise exception 'bad points'; end if;
    insert into public.device_track (device_id, lat, lng, rms, created_at)
    select v_device, (p->>0)::double precision, (p->>1)::double precision, (p->>2)::real,
           now() - make_interval(secs => greatest(0, least(86400, coalesce((p->>3)::double precision, 0))))
    from jsonb_array_elements(p_points) p
    where jsonb_typeof(p) = 'array'
      and abs((p->>0)::double precision) <= 90 and abs((p->>1)::double precision) <= 180;
    get diagnostics v_n = row_count;
    update public.devices set last_seen_at = now() where id = v_device;
    return v_n;
end $$;

grant execute on function public.device_add_point(text, double precision, double precision, text, real) to anon, authenticated;
grant execute on function public.device_add_voice_note(text, double precision, double precision, integer, integer, text, uuid, text) to anon, authenticated;
grant execute on function public.device_add_track(text, jsonb) to anon, authenticated;

-- =====================================================================
-- API для сайту
-- =====================================================================

-- Трек компактно: [[lat, lng, rms, unix_сек], ...] за останні p_days днів
create or replace function public.get_device_track(p_days integer default 30)
returns json
language sql stable security invoker set search_path = public as $$
    select coalesce(json_agg(json_build_array(
               round(lat::numeric, 6), round(lng::numeric, 6), round(coalesce(rms, 0)::numeric, 3),
               floor(extract(epoch from created_at))::bigint) order by created_at), '[]'::json)
    from (select lat, lng, rms, created_at from public.device_track
          where created_at > now() - make_interval(days => greatest(1, least(365, p_days)))
          order by created_at desc limit 20000) t
$$;
grant execute on function public.get_device_track(integer) to anon, authenticated;

-- Текст нотатки в точці з пристрою (пише будь-який залогінений користувач)
create or replace function public.set_point_note(p_id uuid, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
begin
    if auth.uid() is null then raise exception 'Увійдіть, щоб писати нотатки' using errcode = '28000'; end if;
    update public.markers set description = nullif(left(trim(p_note), 1000), '')
    where id = p_id and source = 'device';
    if not found then raise exception 'Точку не знайдено'; end if;
end $$;
revoke all on function public.set_point_note(uuid, text) from public, anon;
grant execute on function public.set_point_note(uuid, text) to authenticated;

-- Видалити точку з пристрою разом з її голосовими нотатками (будь-який залогінений)
create or replace function public.delete_point(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
    if auth.uid() is null then raise exception 'Увійдіть, щоб видаляти' using errcode = '28000'; end if;
    if not exists (select 1 from public.markers where id = p_id and source = 'device') then
        raise exception 'Точку не знайдено';
    end if;
    delete from public.voice_notes where marker_id = p_id;
    delete from public.markers where id = p_id;
end $$;
revoke all on function public.delete_point(uuid) from public, anon;
grant execute on function public.delete_point(uuid) to authenticated;
