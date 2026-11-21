-- =====================================================================
-- App musculation : schéma initial
-- Rôles : admin et coach (tous les droits), athlète (ses propres données
-- et les programmes qui lui sont attribués).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
create type public.app_role as enum ('admin', 'coach', 'athlete');

create type public.equipment_kind as enum (
  'machine', 'poulie', 'barre', 'halteres', 'banc', 'rack', 'kettlebell', 'autre'
);

create type public.muscle_group as enum (
  'pectoraux', 'dos', 'epaules', 'biceps', 'triceps', 'avant_bras',
  'quadriceps', 'ischios', 'fessiers', 'mollets', 'abdominaux', 'cardio', 'corps_entier'
);

-- ---------------------------------------------------------------------
-- Profils
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'athlete',
  coach_id uuid references public.profiles (id) on delete set null,
  birth_date date,
  height_cm numeric(5, 1) check (height_cm is null or height_cm between 50 and 260),
  created_at timestamptz not null default now()
);

-- Fonctions d'aide pour les règles de sécurité.
-- SECURITY DEFINER pour lire le rôle sans déclencher la RLS de profiles.
create function public.current_role_name()
returns public.app_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = auth.uid() $$;

create function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select role in ('admin', 'coach') from public.profiles where id = auth.uid()), false) $$;

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false) $$;

-- Création automatique du profil à l'inscription.
-- Le tout premier compte devient administrateur.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when exists (select 1 from public.profiles) then 'athlete'::public.app_role
         else 'admin'::public.app_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Un utilisateur ne peut pas changer son propre rôle ni son coach ;
-- seul un membre du staff le peut, et seul un admin peut nommer un admin.
create function public.guard_profile_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new; -- appel côté serveur (service_role)
  end if;
  if (new.role is distinct from old.role or new.coach_id is distinct from old.coach_id)
     and not public.is_staff() then
    raise exception 'Seul un coach ou un administrateur peut modifier le rôle ou le coach';
  end if;
  if new.role is distinct from old.role
     and (new.role = 'admin' or old.role = 'admin')
     and not public.is_admin() then
    raise exception 'Seul un administrateur peut attribuer ou retirer le rôle administrateur';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------------------------------------------------------------------
-- Bibliothèque : salles, équipements, exercices
-- ---------------------------------------------------------------------
create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  address text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  brand text,
  kind public.equipment_kind not null default 'machine',
  notes text,
  created_at timestamptz not null default now()
);
create index equipment_gym_idx on public.equipment (gym_id);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  muscle_group public.muscle_group not null,
  secondary_muscles public.muscle_group[] not null default '{}',
  -- Si vrai, l'exercice n'est proposé dans une salle que si un équipement
  -- de cette salle lui est associé (machine, poulie…).
  requires_equipment boolean not null default false,
  description text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index exercises_name_key on public.exercises (lower(name));

create table public.exercise_equipment (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  equipment_id uuid not null references public.equipment (id) on delete cascade,
  primary key (exercise_id, equipment_id)
);
create index exercise_equipment_equipment_idx on public.exercise_equipment (equipment_id);

-- Exercices disponibles par salle
create view public.gym_exercises
with (security_invoker = true) as
select g.id as gym_id, e.*
from public.gyms g
cross join public.exercises e
where not e.requires_equipment
   or exists (
     select 1
     from public.exercise_equipment ee
     join public.equipment eq on eq.id = ee.equipment_id
     where ee.exercise_id = e.id and eq.gym_id = g.id
   );

-- ---------------------------------------------------------------------
-- Programmation
-- ---------------------------------------------------------------------
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  -- null = modèle non attribué
  athlete_id uuid references public.profiles (id) on delete cascade,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index programs_athlete_idx on public.programs (athlete_id) where is_active;

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  position integer not null default 0,
  -- Séance spécifique à une salle (optionnel)
  gym_id uuid references public.gyms (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index workouts_program_idx on public.workouts (program_id, position);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  equipment_id uuid references public.equipment (id) on delete set null,
  position integer not null default 0,
  target_sets integer not null default 3 check (target_sets between 1 and 20),
  rep_min integer not null default 8 check (rep_min between 1 and 100),
  rep_max integer check (rep_max is null or rep_max >= rep_min),
  target_weight_kg numeric(6, 2) check (target_weight_kg is null or target_weight_kg >= 0),
  rest_sec integer not null default 90 check (rest_sec between 0 and 900),
  notes text
);
create index workout_exercises_workout_idx on public.workout_exercises (workout_id, position);

-- ---------------------------------------------------------------------
-- Exécution : séances réalisées et séries
-- ---------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  -- null = séance libre
  workout_id uuid references public.workouts (id) on delete set null,
  gym_id uuid references public.gyms (id) on delete set null,
  name text not null default 'Séance libre',
  started_at timestamptz not null default now(),
  ended_at timestamptz check (ended_at is null or ended_at >= started_at),
  -- Intensité perçue de la séance (RPE 1 à 10)
  rpe numeric(3, 1) check (rpe is null or rpe between 1 and 10),
  notes text
);
create index sessions_athlete_idx on public.sessions (athlete_id, started_at desc);
-- Une seule séance en cours par athlète
create unique index sessions_one_active_idx on public.sessions (athlete_id) where ended_at is null;

create table public.session_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  equipment_id uuid references public.equipment (id) on delete set null,
  exercise_position integer not null default 0,
  set_number integer not null default 1,
  reps integer not null default 0 check (reps between 0 and 1000),
  weight_kg numeric(6, 2) not null default 0 check (weight_kg >= 0),
  rpe numeric(3, 1) check (rpe is null or rpe between 1 and 10),
  rest_sec integer not null default 90 check (rest_sec between 0 and 900),
  done boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index session_sets_session_idx on public.session_sets (session_id, exercise_position, set_number);
create index session_sets_exercise_idx on public.session_sets (exercise_id);

-- ---------------------------------------------------------------------
-- Profil athlète : poids, objectifs, 1RM, exercices mis en avant
-- ---------------------------------------------------------------------
create table public.body_weights (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  measured_on date not null default current_date,
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 400),
  unique (athlete_id, measured_on)
);

create table public.one_rep_maxes (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  weight_kg numeric(6, 2) not null check (weight_kg > 0),
  tested_on date not null default current_date,
  notes text
);
create index one_rep_maxes_athlete_idx on public.one_rep_maxes (athlete_id, exercise_id, tested_on desc);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  target_1rm_kg numeric(6, 2) not null check (target_1rm_kg > 0),
  target_date date,
  achieved_at date,
  created_at timestamptz not null default now()
);
create index goals_athlete_idx on public.goals (athlete_id);

create table public.favorite_exercises (
  athlete_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  primary key (athlete_id, exercise_id)
);

-- ---------------------------------------------------------------------
-- Vues et fonctions de statistiques
-- ---------------------------------------------------------------------

-- Résumé par séance terminée : durée, volume, séries
create view public.session_summaries
with (security_invoker = true) as
select
  s.id as session_id,
  s.athlete_id,
  s.workout_id,
  s.gym_id,
  s.name,
  s.started_at,
  s.ended_at,
  s.rpe,
  extract(epoch from (s.ended_at - s.started_at))::integer as duration_sec,
  count(ss.id) filter (where ss.done) as sets_done,
  coalesce(sum(ss.reps * ss.weight_kg) filter (where ss.done), 0)::numeric(10, 2) as volume_kg
from public.sessions s
left join public.session_sets ss on ss.session_id = s.id
where s.ended_at is not null
group by s.id;

-- Meilleure série par exercice et par séance, avec 1RM estimé (Epley)
create view public.exercise_progress
with (security_invoker = true) as
select
  s.athlete_id,
  ss.exercise_id,
  s.id as session_id,
  s.started_at,
  max(ss.weight_kg) as top_weight_kg,
  max(case when ss.reps = 1 then ss.weight_kg
           else round(ss.weight_kg * (1 + ss.reps / 30.0), 1) end)
    filter (where ss.reps between 1 and 12) as estimated_1rm_kg,
  sum(ss.reps * ss.weight_kg)::numeric(10, 2) as volume_kg,
  sum(ss.reps) as total_reps
from public.session_sets ss
join public.sessions s on s.id = ss.session_id
where ss.done and s.ended_at is not null
group by s.athlete_id, ss.exercise_id, s.id, s.started_at;

-- Prochaine séance suggérée : celle qui suit, dans le programme actif,
-- la dernière séance programmée terminée (on boucle en fin de cycle).
create function public.next_workout(p_athlete uuid default auth.uid())
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
  ordered as (
    select w.*, row_number() over (order by w.position, w.created_at) as rn
    from public.workouts w
    where w.program_id = (select id from program)
  ),
  last_done as (
    select o.rn
    from public.sessions s
    join ordered o on o.id = s.workout_id
    where s.athlete_id = p_athlete and s.ended_at is not null
    order by s.ended_at desc
    limit 1
  )
  select id, program_id, name, position, gym_id, notes, created_at
  from ordered
  where rn = coalesce(
    (select case when rn >= (select max(rn) from ordered) then 1 else rn + 1 end from last_done),
    1
  );
$$;

-- updated_at automatique sur les programmes
create function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger programs_touch before update on public.programs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.gyms enable row level security;
alter table public.equipment enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_equipment enable row level security;
alter table public.programs enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.sessions enable row level security;
alter table public.session_sets enable row level security;
alter table public.body_weights enable row level security;
alter table public.one_rep_maxes enable row level security;
alter table public.goals enable row level security;
alter table public.favorite_exercises enable row level security;

-- Profils : chacun lit et modifie le sien ; le staff gère tout.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()))
  with check (id = (select auth.uid()) or (select public.is_staff()));
create policy profiles_delete on public.profiles for delete to authenticated
  using ((select public.is_admin()));

-- Bibliothèque : lecture pour tous les connectés, écriture pour le staff.
create policy gyms_read on public.gyms for select to authenticated using (true);
create policy gyms_write on public.gyms for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy equipment_read on public.equipment for select to authenticated using (true);
create policy equipment_write on public.equipment for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy exercises_read on public.exercises for select to authenticated using (true);
create policy exercises_write on public.exercises for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy exercise_equipment_read on public.exercise_equipment for select to authenticated using (true);
create policy exercise_equipment_write on public.exercise_equipment for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- Programmation : le staff gère tout ; l'athlète lit ce qui lui est attribué.
create policy programs_read on public.programs for select to authenticated
  using ((select public.is_staff()) or athlete_id = (select auth.uid()));
create policy programs_write on public.programs for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy workouts_read on public.workouts for select to authenticated
  using (
    (select public.is_staff())
    or exists (select 1 from public.programs p
               where p.id = program_id and p.athlete_id = (select auth.uid()))
  );
create policy workouts_write on public.workouts for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy workout_exercises_read on public.workout_exercises for select to authenticated
  using (
    (select public.is_staff())
    or exists (select 1 from public.workouts w
               join public.programs p on p.id = w.program_id
               where w.id = workout_id and p.athlete_id = (select auth.uid()))
  );
create policy workout_exercises_write on public.workout_exercises for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- Données de l'athlète : l'athlète gère les siennes, le staff gère tout.
create policy sessions_all on public.sessions for all to authenticated
  using (athlete_id = (select auth.uid()) or (select public.is_staff()))
  with check (athlete_id = (select auth.uid()) or (select public.is_staff()));

create policy session_sets_all on public.session_sets for all to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id
                 and (s.athlete_id = (select auth.uid()) or (select public.is_staff()))))
  with check (exists (select 1 from public.sessions s where s.id = session_id
                      and (s.athlete_id = (select auth.uid()) or (select public.is_staff()))));

create policy body_weights_all on public.body_weights for all to authenticated
  using (athlete_id = (select auth.uid()) or (select public.is_staff()))
  with check (athlete_id = (select auth.uid()) or (select public.is_staff()));

create policy one_rep_maxes_all on public.one_rep_maxes for all to authenticated
  using (athlete_id = (select auth.uid()) or (select public.is_staff()))
  with check (athlete_id = (select auth.uid()) or (select public.is_staff()));

create policy goals_all on public.goals for all to authenticated
  using (athlete_id = (select auth.uid()) or (select public.is_staff()))
  with check (athlete_id = (select auth.uid()) or (select public.is_staff()));

create policy favorite_exercises_all on public.favorite_exercises for all to authenticated
  using (athlete_id = (select auth.uid()) or (select public.is_staff()))
  with check (athlete_id = (select auth.uid()) or (select public.is_staff()));

-- Les fonctions d'aide ne doivent pas être appelables par les anonymes
revoke execute on function public.current_role_name(), public.is_staff(), public.is_admin() from public, anon;
grant execute on function public.current_role_name(), public.is_staff(), public.is_admin() to authenticated;
revoke execute on function public.handle_new_user(), public.guard_profile_update() from public, anon, authenticated;
