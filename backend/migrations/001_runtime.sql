-- Apply in the application's Supabase project before starting Version 1.
-- Register ONLY buckets dedicated to this application after reviewing ownership.
create table if not exists public.vidpilot_state (key text primary key, value jsonb not null);
create table if not exists public.vidpilot_buckets (name text primary key);
create table if not exists public.vidpilot_reservations (
 bucket text not null references public.vidpilot_buckets(name), name text not null,
 bytes bigint not null check(bytes >= 0), created_at timestamptz not null default now(),
 primary key(bucket,name)
);
alter table public.vidpilot_state enable row level security;
alter table public.vidpilot_buckets enable row level security;
alter table public.vidpilot_reservations enable row level security;
revoke all on public.vidpilot_state, public.vidpilot_buckets, public.vidpilot_reservations from anon, authenticated;
grant all on public.vidpilot_state, public.vidpilot_buckets, public.vidpilot_reservations to service_role;

create or replace function public.vidpilot_storage_usage() returns jsonb
language plpgsql security definer set search_path = public, storage as $$
begin
 if not exists(select 1 from public.vidpilot_buckets) then raise exception 'Register verified application-owned buckets before enabling storage'; end if;
 if exists(select 1 from storage.objects where bucket_id in(select name from public.vidpilot_buckets) and (metadata->>'size' is null or (metadata->>'size')::bigint < 0)) then raise exception 'Object size unavailable; storage operations blocked'; end if;
 return (select jsonb_build_object(
 'usedBytes',coalesce((select sum(coalesce((metadata->>'size')::bigint,0)) from storage.objects where bucket_id in (select name from public.vidpilot_buckets)),0),
 'reservedBytes',coalesce((select sum(r.bytes) from public.vidpilot_reservations r where not exists(select 1 from storage.objects o where o.bucket_id=r.bucket and o.name=r.name)),0)));
end;
$$;
create or replace function public.vidpilot_reserve(p_bucket text,p_name text,p_bytes bigint) returns text
language plpgsql security definer set search_path = public, storage as $$
declare usage jsonb;
begin
 perform pg_advisory_xact_lock(716401);
 if not exists(select 1 from public.vidpilot_buckets where name=p_bucket) then raise exception 'Bucket ownership not registered'; end if;
 if p_bytes < 0 or p_bytes > 500000000 then raise exception 'Storage limit exceeded'; end if;
 if exists(select 1 from storage.objects where bucket_id=p_bucket and name=p_name) then return 'exists'; end if;
 if exists(select 1 from public.vidpilot_reservations where bucket=p_bucket and name=p_name) then return 'reserved'; end if;
 usage := public.vidpilot_storage_usage();
 if (usage->>'usedBytes')::bigint + (usage->>'reservedBytes')::bigint + p_bytes > 500000000 then raise exception 'Vidpilot 500 MB storage limit exceeded'; end if;
 insert into public.vidpilot_reservations(bucket,name,bytes) values(p_bucket,p_name,p_bytes);
 return 'reserved_new';
end; $$;
create or replace function public.vidpilot_inventory() returns table(bucket text,name text,bytes bigint,created_at timestamptz)
language sql security definer set search_path = public, storage as $$
 select o.bucket_id,o.name,coalesce((o.metadata->>'size')::bigint,0),o.created_at from storage.objects o where o.bucket_id in(select b.name from public.vidpilot_buckets b) order by o.bucket_id,o.name;
$$;
create or replace function public.vidpilot_lease(p_key text,p_owner text,p_seconds integer) returns boolean
language plpgsql security definer set search_path=public as $$
declare result text;
begin
 insert into public.vidpilot_state(key,value) values(p_key,jsonb_build_object('owner',p_owner,'expires',now()+make_interval(secs=>p_seconds)))
 on conflict(key) do update set value=excluded.value
 where vidpilot_state.value->>'owner'=p_owner or (vidpilot_state.value->>'expires')::timestamptz < now()
 returning key into result;
 return result is not null;
end; $$;
revoke all on function public.vidpilot_storage_usage(),public.vidpilot_reserve(text,text,bigint),public.vidpilot_inventory(),public.vidpilot_lease(text,text,integer) from public,anon,authenticated;
grant execute on function public.vidpilot_storage_usage(),public.vidpilot_reserve(text,text,bigint),public.vidpilot_inventory(),public.vidpilot_lease(text,text,integer) to service_role;
create or replace function public.vidpilot_release_lease(p_key text,p_owner text) returns void
language sql security definer set search_path=public as $$
 delete from public.vidpilot_state where key=p_key and value->>'owner'=p_owner;
$$;
revoke all on function public.vidpilot_release_lease(text,text) from public,anon,authenticated;
grant execute on function public.vidpilot_release_lease(text,text) to service_role;
-- Example ONLY after verifying exclusive ownership:
-- insert into public.vidpilot_buckets(name) values ('rendered-videos'),('voice-audio'),('visual-cache') on conflict do nothing;
