-- =====================================================================
-- Séances bonus : une séance du programme peut être marquée « bonus ».
-- Elle reste disponible au démarrage, mais n'entre pas dans le cycle :
-- elle n'est jamais suggérée comme prochaine séance, et la faire ne fait
-- pas avancer le cycle.
-- =====================================================================
alter table public.workouts
  add column is_bonus boolean not null default false;

create or replace function public.next_workout(p_athlete uuid default auth.uid())
returns setof public.workouts
language sql stable security invoker set search_path = ''
as $$
  with program as (
    select p.id
    from public.programs p
    where p.athlete_id = p_athlete and p.is_active
    order by p.updated_at desc
    limit 1
  ),
  -- Le cycle : les séances du programme hors bonus, dans l'ordre
  ordered as (
    select w.*, row_number() over (order by w.position, w.created_at) as rn
    from public.workouts w
    where w.program_id = (select id from program) and not w.is_bonus
  ),
  -- Dernière séance du cycle terminée (les séances bonus sont ignorées)
  last_done as (
    select o.rn
    from public.sessions s
    join ordered o on o.id = s.workout_id
    where s.athlete_id = p_athlete and s.ended_at is not null
    order by s.ended_at desc
    limit 1
  )
  select id, program_id, name, position, gym_id, notes, created_at, is_bonus
  from ordered
  where rn = coalesce(
    (select case when rn >= (select max(rn) from ordered) then 1 else rn + 1 end from last_done),
    1
  );
$$;
