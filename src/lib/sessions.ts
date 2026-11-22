import { useQuery } from '@tanstack/react-query'
import { supabase, unwrap } from './supabase'
import type { Session, SessionSet, Workout, WorkoutExercise } from './types'
import { referenceMaxes } from './oneRepMax'
import { plannedSetLoad, plannedSets } from './setPlan'

export const ACTIVE_SESSION_KEY = ['active-session'] as const

export function useActiveSession(userId: string | undefined) {
  return useQuery({
    queryKey: [...ACTIVE_SESSION_KEY, userId],
    enabled: Boolean(userId),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('sessions')
          .select('*')
          .eq('athlete_id', userId!)
          .is('ended_at', null)
          .maybeSingle(),
      ) as Session | null,
  })
}

/** Dernière charge et répétitions réalisées par l'athlète pour chaque exercice. */
export async function lastPerformances(athleteId: string, exerciseIds: string[]) {
  const result = new Map<string, { weight_kg: number; reps: number }>()
  if (exerciseIds.length === 0) return result
  const rows = unwrap(
    await supabase
      .from('session_sets')
      .select('exercise_id, weight_kg, reps, completed_at, sessions!inner(athlete_id)')
      .eq('sessions.athlete_id', athleteId)
      .eq('done', true)
      .in('exercise_id', exerciseIds)
      .order('completed_at', { ascending: false })
      .limit(500),
  ) as { exercise_id: string; weight_kg: number; reps: number }[]
  for (const row of rows) {
    if (!result.has(row.exercise_id)) result.set(row.exercise_id, { weight_kg: Number(row.weight_kg), reps: row.reps })
  }
  return result
}

interface StartOptions {
  athleteId: string
  gymId: string | null
  workout?: Workout | null
}

/** Démarre une séance (programmée ou libre) et prépare ses séries. */
export async function startSession({ athleteId, gymId, workout }: StartOptions): Promise<Session> {
  const session = unwrap(
    await supabase
      .from('sessions')
      .insert({
        athlete_id: athleteId,
        gym_id: gymId,
        workout_id: workout?.id ?? null,
        name: workout?.name ?? 'Séance libre',
      })
      .select()
      .single(),
  ) as Session

  if (workout) {
    const planned = unwrap(
      await supabase.from('workout_exercises').select('*').eq('workout_id', workout.id).order('position'),
    ) as WorkoutExercise[]
    const ids = planned.map((p) => p.exercise_id)
    const needsMax = planned.filter((p) => plannedSets(p).some((s) => s.target_rpe !== null && s.target_weight_kg === null))
      .map((p) => p.exercise_id)
    const [last, maxes] = await Promise.all([lastPerformances(athleteId, ids), referenceMaxes(athleteId, needsMax)])
    const sets: Partial<SessionSet>[] = planned.flatMap((p, index) =>
      plannedSets(p).map((planned, i) => ({
        session_id: session.id,
        exercise_id: p.exercise_id,
        equipment_id: p.equipment_id,
        exercise_position: index,
        set_number: i + 1,
        reps: planned.rep_min,
        // Charge : fixée par le coach, sinon calculée au RPE depuis le 1RM, sinon la dernière réalisée
        weight_kg: plannedSetLoad(planned, p.specialty, maxes.get(p.exercise_id)) ?? last.get(p.exercise_id)?.weight_kg ?? 0,
        rest_sec: p.rest_sec,
        specialty: p.specialty,
        target_rpe: p.specialty === 'cardio' ? null : planned.target_rpe,
        set_kind: planned.kind,
      })),
    )
    if (sets.length > 0) unwrap(await supabase.from('session_sets').insert(sets))
  }
  return session
}
