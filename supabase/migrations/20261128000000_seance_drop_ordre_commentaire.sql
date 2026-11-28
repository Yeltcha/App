-- =====================================================================
-- Pendant la séance : drop sets, ordre des exercices, commentaires.
-- =====================================================================

-- Drop set : série enchaînée sans repos juste après une autre, charge réduite
alter table public.session_sets drop constraint if exists session_sets_set_kind_check;
alter table public.session_sets
  add constraint session_sets_set_kind_check
    check (set_kind in ('normal', 'warmup', 'top', 'backoff', 'drop'));

-- Commentaire facultatif de l'athlète sur un exercice de la séance
create table public.session_exercise_notes (
  session_id uuid not null references public.sessions (id) on delete cascade,
  exercise_position integer not null,
  note text not null check (length(trim(note)) between 1 and 1000),
  updated_at timestamptz not null default now(),
  primary key (session_id, exercise_position)
);
alter table public.session_exercise_notes enable row level security;
create policy session_exercise_notes_all on public.session_exercise_notes for all to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id
                 and (s.athlete_id = (select auth.uid()) or (select public.is_staff()))))
  with check (exists (select 1 from public.sessions s where s.id = session_id
                      and (s.athlete_id = (select auth.uid()) or (select public.is_staff()))));
grant select, insert, update, delete on public.session_exercise_notes to authenticated;
grant all on public.session_exercise_notes to service_role;

-- Échange de place de deux exercices de la séance (séries et commentaire suivent),
-- en une seule fois pour ne jamais laisser deux exercices à la même place.
create function public.swap_session_exercises(p_session uuid, p_a integer, p_b integer)
returns void
language sql security invoker set search_path = ''
as $$
  update public.session_sets
  set exercise_position = case exercise_position when p_a then p_b else p_a end
  where session_id = p_session and exercise_position in (p_a, p_b);

  -- Les commentaires : on passe par une position libre pour respecter la clé primaire
  update public.session_exercise_notes set exercise_position = -1 - p_a
  where session_id = p_session and exercise_position = p_a;
  update public.session_exercise_notes set exercise_position = p_a
  where session_id = p_session and exercise_position = p_b;
  update public.session_exercise_notes set exercise_position = p_b
  where session_id = p_session and exercise_position = -1 - p_a;
$$;
revoke execute on function public.swap_session_exercises(uuid, integer, integer) from public;
grant execute on function public.swap_session_exercises(uuid, integer, integer) to authenticated;
