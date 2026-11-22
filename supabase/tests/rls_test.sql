-- Tests des règles de sécurité.
-- Sur la base locale Supabase (npx supabase start) :
--   npm run test:db
-- Le script s'exécute dans une transaction annulée à la fin : aucune donnée n'est conservée.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test', '{"full_name":"Admin"}'),
  ('00000000-0000-0000-0000-00000000000b', 'athlete1@test', '{"full_name":"Athlète 1"}'),
  ('00000000-0000-0000-0000-00000000000c', 'athlete2@test', '{"full_name":"Athlète 2"}');

do $$ begin
  -- Le premier compte devient admin (vérifiable seulement sur une base vide)
  if (select count(*) from public.profiles) = 3 then
    assert (select role from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'admin', 'premier compte = admin';
  end if;
  assert (select role from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 'athlete', 'suivants = athlète';
end $$;
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

-- ----- En tant qu'admin -----
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.gyms (id, name) values ('10000000-0000-0000-0000-000000000001', 'Salle A'), ('10000000-0000-0000-0000-000000000002', 'Salle B');
insert into public.equipment (id, gym_id, name, brand, kind) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Presse à cuisses 45°', 'Technogym', 'machine');
insert into public.exercises (id, name, muscle_group, requires_equipment) values
  ('30000000-0000-0000-0000-000000000001', 'Test squat', 'quadriceps', false),
  ('30000000-0000-0000-0000-000000000002', 'Test presse', 'quadriceps', true);
insert into public.exercise_equipment values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001');
insert into public.programs (id, name, athlete_id) values ('40000000-0000-0000-0000-000000000001', 'Force', '00000000-0000-0000-0000-00000000000b');
insert into public.workouts (id, program_id, name, position) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Jambes', 0),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'Haut du corps', 1);
insert into public.workout_exercises (workout_id, exercise_id, position) values ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0);

-- Marques de salle : la marque saisie sur une machine est rattachée à la salle
do $$ declare b uuid; begin
  select brand_id into b from public.equipment where id = '20000000-0000-0000-0000-000000000001';
  assert b is not null, 'la marque de la machine est rattachée à la salle';
  assert (select gym_id from public.gym_brands where id = b) = '10000000-0000-0000-0000-000000000001', 'marque dans la salle A';
  update public.gym_brands set name = 'TechnoGym' where id = b;
  assert (select brand from public.equipment where id = '20000000-0000-0000-0000-000000000001') = 'TechnoGym', 'renommer la marque met à jour la machine';
  insert into public.gym_brands (id, gym_id, name) values ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'GYM80');
  begin
    update public.equipment set brand_id = '60000000-0000-0000-0000-000000000001' where id = '20000000-0000-0000-0000-000000000001';
    assert false, 'une marque d’une autre salle aurait dû être refusée';
  exception when raise_exception then null;
  end;
  delete from public.gym_brands where id = b;
  assert (select brand from public.equipment where id = '20000000-0000-0000-0000-000000000001') is null, 'supprimer la marque garde la machine, sans marque';
end $$;

do $$ begin
  assert (select count(*) from public.gym_exercises where gym_id = '10000000-0000-0000-0000-000000000001' and name like 'Test %') = 2, 'salle A : 2 exercices';
  assert (select count(*) from public.gym_exercises where gym_id = '10000000-0000-0000-0000-000000000002' and name like 'Test %') = 1, 'salle B : presse indisponible';
end $$;

-- ----- En tant qu'athlète 1 -----
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'athlète ne voit que son profil';
  assert (select count(*) from public.programs) = 1, 'athlète voit son programme';
  assert (select count(*) from public.workout_exercises) = 1, 'athlète voit les exercices de son programme';
  assert (select name from public.next_workout()) = 'Jambes', 'première séance suggérée';
end $$;

-- L'athlète ne peut pas modifier la bibliothèque
do $$ begin
  begin
    insert into public.exercises (name, muscle_group) values ('Triche', 'dos');
    assert false, 'insertion exercice aurait dû échouer';
  exception when insufficient_privilege then null;
  end;
end $$;
do $$ begin
  assert (select count(*) from public.gym_brands) >= 1, 'athlète voit les marques des salles';
  begin
    insert into public.gym_brands (gym_id, name) values ('10000000-0000-0000-0000-000000000001', 'Triche');
    assert false, 'insertion marque aurait dû échouer';
  exception when insufficient_privilege then null;
  end;
end $$;

-- L'athlète ne peut pas se promouvoir
do $$ begin
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    assert false, 'auto-promotion aurait dû échouer';
  exception when raise_exception then null;
  end;
end $$;

-- L'athlète enregistre une séance
insert into public.sessions (id, workout_id, gym_id, name, started_at, ended_at, rpe)
values ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Jambes', now() - interval '70 minutes', now() - interval '5 minutes', 8);
insert into public.session_sets (session_id, exercise_id, set_number, reps, weight_kg, done) values
  ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 5, 100, true),
  ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 2, 5, 105, true),
  ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 3, 3, 110, false);
insert into public.body_weights (weight_kg) values (82.5);
insert into public.goals (exercise_id, target_1rm_kg) values ('30000000-0000-0000-0000-000000000001', 150);

do $$ begin
  assert (select duration_sec from public.session_summaries) = 3900, 'durée 65 min';
  assert (select volume_kg from public.session_summaries) = 1025, 'volume des séries faites';
  assert (select estimated_1rm_kg from public.exercise_progress) = 122.5, '1RM estimé Epley';
  assert (select name from public.next_workout()) = 'Haut du corps', 'séance suivante suggérée';
end $$;

-- Une seule séance en cours
insert into public.sessions (name) values ('En cours');
do $$ begin
  begin
    insert into public.sessions (name) values ('Deuxième en cours');
    assert false, 'deux séances en cours aurait dû échouer';
  exception when unique_violation then null;
  end;
end $$;

-- ----- En tant qu'athlète 2 -----
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert (select count(*) from public.programs) = 0, 'athlète 2 ne voit pas le programme de 1';
  assert (select count(*) from public.sessions) = 0, 'athlète 2 ne voit pas les séances de 1';
  assert (select count(*) from public.session_sets) = 0, 'athlète 2 ne voit pas les séries de 1';
  assert (select count(*) from public.body_weights) = 0, 'athlète 2 ne voit pas le poids de 1';
  assert (select count(*) from public.next_workout('00000000-0000-0000-0000-00000000000b')) = 0, 'pas de fuite via next_workout';
end $$;
do $$ begin
  begin
    insert into public.sessions (athlete_id, name) values ('00000000-0000-0000-0000-00000000000b', 'Usurpation');
    assert false, 'usurpation aurait dû échouer';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ----- Le staff voit tout -----
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select count(*) from public.profiles) >= 3, 'admin voit tous les profils';
  assert (select count(*) from public.sessions) >= 2, 'admin voit toutes les séances';
end $$;
update public.profiles set role = 'coach' where id = '00000000-0000-0000-0000-00000000000c';

reset role;
select 'Tous les tests RLS sont passés' as resultat;
rollback;
