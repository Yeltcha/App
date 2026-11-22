import { supabase, unwrap } from './supabase'
import { plannedSetLoad, type PlannedSet } from './setPlan'
import type { ReferenceMax } from './oneRepMax'
import type { Specialty } from './types'

/** Une série faite lors de la dernière séance sur l'exercice */
export interface PreviousSet {
  set_number: number
  weight_kg: number
  reps: number
  rpe: number | null
}

export interface PreviousSession {
  session_id: string
  date: string
  sets: PreviousSet[]
}

interface Row {
  exercise_id: string
  session_id: string
  set_number: number
  weight_kg: number
  reps: number
  rpe: number | null
  completed_at: string | null
}

/** Garde, pour chaque exercice, les séries de la séance la plus récente (rangées du plus récent au plus ancien). */
export function groupLastSession(rows: Row[]): Map<string, PreviousSession> {
  const result = new Map<string, PreviousSession>()
  for (const row of rows) {
    let entry = result.get(row.exercise_id)
    if (!entry) {
      entry = { session_id: row.session_id, date: (row.completed_at ?? '').slice(0, 10), sets: [] }
      result.set(row.exercise_id, entry)
    }
    if (entry.session_id !== row.session_id) continue
    entry.sets.push({ set_number: row.set_number, weight_kg: Number(row.weight_kg), reps: row.reps, rpe: row.rpe === null ? null : Number(row.rpe) })
  }
  for (const entry of result.values()) entry.sets.sort((a, b) => a.set_number - b.set_number)
  return result
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
  ) as Row[]
  return groupLastSession(rows)
}

/** Série de la dernière fois qui correspond à la série n° index (la dernière faite s'il y en avait moins). */
export function previousSetAt(previous: PreviousSession | undefined, index: number): PreviousSet | undefined {
  return previous?.sets[index] ?? previous?.sets.at(-1)
}

/**
 * Charge préremplie d'une série :
 * - fixée par le coach : toujours prioritaire ;
 * - bodybuilding : la charge de la même série la dernière fois, sinon le calcul au RPE ;
 * - force : le calcul au RPE depuis le 1RM, sinon la dernière charge.
 */
export function prefillWeight(
  specialty: Specialty, planned: PlannedSet, index: number,
  previous: PreviousSession | undefined, max: ReferenceMax | undefined,
): number {
  if (planned.target_weight_kg !== null) return planned.target_weight_kg
  const last = previousSetAt(previous, index)?.weight_kg ?? null
  const fromRpe = plannedSetLoad(planned, specialty, max)
  if (specialty === 'bodybuilding') return last ?? fromRpe ?? 0
  return fromRpe ?? last ?? 0
}
