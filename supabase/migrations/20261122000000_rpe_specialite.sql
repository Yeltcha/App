-- =====================================================================
-- Spécialité d'un exercice programmé (force, bodybuilding, cardio)
-- et programmation au RPE.
-- =====================================================================

create type public.training_specialty as enum ('force', 'bodybuilding', 'cardio');

-- Programmation : spécialité et RPE cible (6 à 10, par demi-points).
-- Pour le cardio, rep_min et rep_max sont des minutes par bloc.
alter table public.workout_exercises
  add column specialty public.training_specialty not null default 'bodybuilding',
  add column target_rpe numeric(3, 1)
    check (target_rpe is null or (target_rpe between 6 and 10 and target_rpe * 2 = floor(target_rpe * 2)));

-- Exécution : on garde la spécialité et le RPE cible sur chaque série,
-- à côté du RPE ressenti (colonne rpe existante).
alter table public.session_sets
  add column specialty public.training_specialty,
  add column target_rpe numeric(3, 1)
    check (target_rpe is null or (target_rpe between 6 and 10 and target_rpe * 2 = floor(target_rpe * 2)));
