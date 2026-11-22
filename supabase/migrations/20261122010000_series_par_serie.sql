-- =====================================================================
-- Réglage série par série : montée en RPE, top set et back-off,
-- répétitions différentes d'une série à l'autre.
-- =====================================================================

-- Plan de séries d'un exercice programmé. Null = toutes les séries identiques
-- (target_sets × rep_min…rep_max, target_rpe, target_weight_kg).
-- Sinon, un tableau d'objets :
--   { "kind": "normal" | "warmup" | "top" | "backoff",
--     "rep_min": int, "rep_max": int | null,
--     "target_rpe": numeric | null, "target_weight_kg": numeric | null }
alter table public.workout_exercises
  add column set_plan jsonb
    check (set_plan is null or (jsonb_typeof(set_plan) = 'array' and jsonb_array_length(set_plan) between 1 and 20));

-- Type de série repris dans la séance réalisée
alter table public.session_sets
  add column set_kind text not null default 'normal'
    check (set_kind in ('normal', 'warmup', 'top', 'backoff'));
