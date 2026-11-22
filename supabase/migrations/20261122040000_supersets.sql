-- =====================================================================
-- Supersets : des exercices consécutifs d'une séance enchaînés sans repos.
-- Le repos de l'exercice s'applique après le dernier exercice du superset.
-- =====================================================================

-- Programmation : l'exercice est enchaîné avec celui qui le précède
alter table public.workout_exercises
  add column superset_with_previous boolean not null default false;

-- Séance réalisée : même numéro pour les exercices d'un même superset
alter table public.session_sets
  add column superset_group smallint check (superset_group is null or superset_group >= 0);
