-- Counters only: no questions, transcripts, answers, or conversation history.
create table public.ask_ai_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  minute_start timestamptz not null,
  minute_count integer not null,
  day_start timestamptz not null,
  day_count integer not null
);
alter table public.ask_ai_rate_limits enable row level security;
revoke all on public.ask_ai_rate_limits from anon, authenticated;

create or replace function public.consume_ask_ai_request()
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  now_at timestamptz := clock_timestamp();
  minute_at timestamptz := date_trunc('minute', now_at);
  day_at timestamptz := date_trunc('day', now_at at time zone 'UTC') at time zone 'UTC';
  accepted uuid;
begin
  if uid is null then return false; end if;
  insert into public.ask_ai_rate_limits as limits
    (user_id, minute_start, minute_count, day_start, day_count)
  values (uid, minute_at, 1, day_at, 1)
  on conflict (user_id) do update set
    minute_start = minute_at,
    minute_count = case when limits.minute_start = minute_at then limits.minute_count + 1 else 1 end,
    day_start = day_at,
    day_count = case when limits.day_start = day_at then limits.day_count + 1 else 1 end
  where (limits.minute_start <> minute_at or limits.minute_count < 10)
    and (limits.day_start <> day_at or limits.day_count < 100)
  returning user_id into accepted;
  return accepted is not null;
end;
$$;
revoke all on function public.consume_ask_ai_request() from public, anon;
grant execute on function public.consume_ask_ai_request() to authenticated;
