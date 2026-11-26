-- =====================================================================
-- Consignes : le coach choisit, pour chaque exercice programmé, si
-- l'athlète voit les consignes pendant la séance (celles de l'exercice
-- programmé et celles de la fiche exercice).
-- =====================================================================
alter table public.workout_exercises
  add column notes_visible boolean not null default true;
