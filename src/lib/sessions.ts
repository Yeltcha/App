import { useQuery } from '@tanstack/react-query'
import { supabase, unwrap } from './supabase'
import type { Session, SessionSet, Workout, WorkoutExercise } from './types'
import { referenceMaxes } from './oneRepMax'
import { plannedSets } from './setPlan'
import { groupLastSession, prefillWeight, type LastSessionRow, type PreviousSession } from './lastSession'
import { resolveMachine, type Link } from './machines'
import type { Equipment } from './types'

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
    // Machines : seulement si l'une est programmée ou qu'une marque est visée
    const needsMachines = planned.some((p) => p.equipment_id || p.equipment_brand)
    const [last, maxes, machines] = await Promise.all([
      lastSessionSets(athleteId, ids),
      referenceMaxes(athleteId, needsMax),
      needsMachines ? loadMachines(ids) : Promise.resolve({ equipment: [] as Equipment[], links: [] as Link[] }),
    ])
    const machineFor = (p: WorkoutExercise) => needsMachines
      ? resolveMachine({ exerciseId: p.exercise_id, equipmentId: p.equipment_id, brand: p.equipment_brand }, gymId, machines.equipment, machines.links)
      : null
    const sets: Partial<SessionSet>[] = planned.flatMap((p, index) =>
      plannedSets(p).map((planned, i) => ({
        session_id: session.id,
        exercise_id: p.exercise_id,
        equipment_id: machineFor(p),
        equipment_brand: p.equipment_brand,
        exercise_position: index,
        set_number: i + 1,
        reps: planned.rep_min,
        // Charge préremplie, modifiable : voir prefillWeight (dernière fois en bodybuilding, RPE en force)
        weight_kg: prefillWeight(p.specialty, planned, i, last.get(p.exercise_id), maxes.get(p.exercise_id)),
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

async function loadMachines(exerciseIds: string[]) {
  const [equipment, links] = await Promise.all([
    supabase.from('equipment').select('*'),
    supabase.from('exercise_equipment').select('*').in('exercise_id', exerciseIds),
  ])
  return { equipment: unwrap(equipment) as Equipment[], links: unwrap(links) as Link[] }
}

/** Séries de la dernière séance terminée de l'athlète, pour chaque exercice. */
export async function lastSessionSets(athleteId: string, exerciseIds: string[]): Promise<Map<string, PreviousSession>> {
  if (exerciseIds.length === 0) return new Map()
  const rows = unwrap(
    await supabase
      .from('session_sets')
      .select('exercise_id, session_id, set_number, weight_kg, reps, rpe, completed_at, sessions!inner(athlete_id, ended_at)')
      .eq('sessions.athlete_id', athleteId)
      .not('sessions.ended_at', 'is', null)
      .eq('done', true)
      .in('exercise_id', exerciseIds)
      .order('completed_at', { ascending: false })
      .limit(1000),
  ) as LastSessionRow[]
  return groupLastSession(rows)
}
