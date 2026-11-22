-- =====================================================================
-- Marque de machine par exercice programmé.
-- La salle reste celle de la séance (workouts.gym_id, une seule) ; chaque
-- exercice peut viser une marque (ex. peck deck Technogym, viking press
-- GYM80), une machine précise, ou les deux.
-- =====================================================================

alter table public.workout_exercises
  add column equipment_brand text
    check (equipment_brand is null or length(trim(equipment_brand)) between 1 and 60);

-- Marque visée, conservée sur la séance réalisée (utile quand la salle
-- n'a pas de machine enregistrée de cette marque)
alter table public.session_sets
  add column equipment_brand text
    check (equipment_brand is null or length(trim(equipment_brand)) between 1 and 60);
