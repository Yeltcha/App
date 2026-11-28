import { formatKg } from './numbers'
import { formatRpe, loadFromRpe, RPE_VALUES } from './rpe'
import type { ReferenceMax } from './oneRepMax'
import type { Specialty, WorkoutExercise } from './types'

export type SetKind = 'normal' | 'warmup' | 'top' | 'backoff' | 'drop'

/** Types proposés dans le programme (le drop set s'ajoute pendant la séance) */
export const SET_KINDS: SetKind[] = ['normal', 'warmup', 'top', 'backoff']

export const SET_KIND_LABELS: Record<SetKind, string> = {
  normal: 'Série',
  warmup: 'Échauffement',
  top: 'Top set',
  backoff: 'Back-off',
  drop: 'Drop set',
}

/** Une série programmée */
export interface PlannedSet {
  kind: SetKind
  rep_min: number
  rep_max: number | null
  target_rpe: number | null
  target_weight_kg: number | null
}

type PlanSource = Pick<WorkoutExercise,
  'target_sets' | 'rep_min' | 'rep_max' | 'target_rpe' | 'target_weight_kg' | 'set_plan'>

/** Les séries d'un exercice programmé : le plan série par série, sinon des séries identiques. */
export function plannedSets(item: PlanSource): PlannedSet[] {
  if (item.set_plan && item.set_plan.length > 0) {
    return item.set_plan.map((s) => ({
      kind: s.kind ?? 'normal',
      rep_min: Number(s.rep_min),
      rep_max: s.rep_max == null ? null : Number(s.rep_max),
      target_rpe: s.target_rpe == null ? null : Number(s.target_rpe),
      target_weight_kg: s.target_weight_kg == null ? null : Number(s.target_weight_kg),
    }))
  }
  return Array.from({ length: item.target_sets }, () => ({
    kind: 'normal' as const,
    rep_min: item.rep_min,
    rep_max: item.rep_max,
    target_rpe: item.target_rpe == null ? null : Number(item.target_rpe),
    target_weight_kg: item.target_weight_kg == null ? null : Number(item.target_weight_kg),
  }))
}

/** Charge d'une série : fixée par le coach, sinon calculée au RPE depuis le 1RM. */
export function plannedSetLoad(set: PlannedSet, specialty: Specialty, max: ReferenceMax | undefined): number | null {
  if (specialty === 'cardio') return null
  if (set.target_weight_kg !== null) return set.target_weight_kg
  if (set.target_rpe === null || !max) return null
  return loadFromRpe(max.kg, set.rep_min, set.target_rpe)?.kg ?? null
}

/** Montée en RPE : +0,5 par série à partir de la première (7 par défaut), plafonnée à 10. */
export function rampRpe<T extends { target_rpe: number | null; kind: SetKind }>(sets: T[], step = 0.5): T[] {
  const start = sets.find((s) => s.kind !== 'warmup')?.target_rpe ?? 7
  let i = 0
  return sets.map((s) => {
    if (s.kind === 'warmup') return s
    const rpe = Math.min(10, start + step * i++)
    return { ...s, target_rpe: RPE_VALUES.includes(rpe as (typeof RPE_VALUES)[number]) ? rpe : 10 }
  })
}

/** « 5 @ RPE 8, ≈ 112,5 kg » ou « 10 min » pour le cardio. */
export function describeSet(set: PlannedSet, specialty: Specialty, loadKg: number | null): string {
  const reps = set.rep_max ? `${set.rep_min}–${set.rep_max}` : `${set.rep_min}`
  if (specialty === 'cardio') return `${reps} min`
  let text = reps
  if (set.target_rpe !== null) text += ` @ RPE ${formatRpe(set.target_rpe)}`
  if (set.target_weight_kg !== null) text += `, ${formatKg(set.target_weight_kg)}`
  else if (loadKg !== null) text += `, ≈ ${formatKg(loadKg)}`
  return text
}
