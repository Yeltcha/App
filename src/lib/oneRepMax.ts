import { supabase, unwrap } from './supabase'
import { loadFromRpe, type RpeLoad } from './rpe'
import type { WorkoutExercise } from './types'

export interface ReferenceMax {
  kg: number
  /** « test » : 1RM saisi dans le profil ; « estimé » : meilleure série récente */
  source: 'test' | 'estimé'
  date: string
}

/** Fenêtre pour le 1RM estimé quand aucun test n'est saisi */
const ESTIMATE_WEEKS = 12

/**
 * 1RM de référence de l'athlète pour chaque exercice : le dernier 1RM testé,
 * sinon le meilleur 1RM estimé sur les 12 dernières semaines.
 */
export async function referenceMaxes(athleteId: string, exerciseIds?: string[]): Promise<Map<string, ReferenceMax>> {
  const result = new Map<string, ReferenceMax>()
  if (exerciseIds && exerciseIds.length === 0) return result

  let tested = supabase.from('one_rep_maxes').select('exercise_id, weight_kg, tested_on')
    .eq('athlete_id', athleteId).order('tested_on', { ascending: false })
  if (exerciseIds) tested = tested.in('exercise_id', exerciseIds)
  for (const row of unwrap(await tested) as { exercise_id: string; weight_kg: number; tested_on: string }[]) {
    if (!result.has(row.exercise_id)) {
      result.set(row.exercise_id, { kg: Number(row.weight_kg), source: 'test', date: row.tested_on })
    }
  }

  const since = new Date(Date.now() - ESTIMATE_WEEKS * 7 * 86_400_000).toISOString()
  let estimated = supabase.from('exercise_progress').select('exercise_id, estimated_1rm_kg, started_at')
    .eq('athlete_id', athleteId).gte('started_at', since).not('estimated_1rm_kg', 'is', null)
  if (exerciseIds) estimated = estimated.in('exercise_id', exerciseIds)
  for (const row of unwrap(await estimated) as { exercise_id: string; estimated_1rm_kg: number; started_at: string }[]) {
    const current = result.get(row.exercise_id)
    if (current?.source === 'test') continue
    if (!current || Number(row.estimated_1rm_kg) > current.kg) {
      result.set(row.exercise_id, { kg: Number(row.estimated_1rm_kg), source: 'estimé', date: row.started_at.slice(0, 10) })
    }
  }
  return result
}

/** Charge calculée au RPE pour un exercice programmé, si la règle s'applique. */
export function plannedRpeLoad(
  item: Pick<WorkoutExercise, 'specialty' | 'target_rpe' | 'rep_min'>,
  max: ReferenceMax | undefined,
): RpeLoad | null {
  if (item.specialty === 'cardio' || item.target_rpe === null || !max) return null
  return loadFromRpe(max.kg, item.rep_min, Number(item.target_rpe))
}
