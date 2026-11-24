import { decimalText } from './numbers'

/**
 * Programmation au RPE.
 *
 * RPE (effort perçu, 6 à 10) et RIR (répétitions en réserve) sont liés :
 * RIR = 10 − RPE. Une série de N répétitions à RPE r revient donc à une
 * série « jusqu'à l'échec » de N + (10 − r) répétitions. Le pourcentage du
 * 1RM ne dépend que de ce total : c'est la table RPE de référence (Reactive
 * Training Systems), dont chaque case se lit sur une seule suite.
 */

/** % du 1RM pour 1, 1,5, 2 … 16 répétitions jusqu'à l'échec (pas de 0,5). */
const PERCENT_BY_REPS_TO_FAILURE = [
  100, 97.8, 95.5, 93.9, 92.2, 90.7, 89.2, 87.8, 86.3, 85.0, 83.7, 82.4, 81.1, 79.9, 78.6, 77.4,
  76.2, 75.1, 73.9, 72.3, 70.7, 69.4, 68.0, 66.7, 65.3, 64.0, 62.6, 61.3, 59.9, 58.6, 57.2,
]

/** RPE proposés à la programmation, du plus léger au plus dur. */
export const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const
/** Répétitions couvertes par la table. */
export const TABLE_REPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

export const rirFor = (rpe: number) => 10 - rpe

/** % du 1RM pour faire `reps` répétitions à un RPE donné, ou null hors table. */
export function percentOf1RM(reps: number, rpe: number): number | null {
  if (!Number.isInteger(reps) || reps < 1 || reps > 12) return null
  if (rpe < 6 || rpe > 10 || (rpe * 2) % 1 !== 0) return null
  const index = (reps + rirFor(rpe) - 1) * 2
  return PERCENT_BY_REPS_TO_FAILURE[index] ?? null
}

/** Arrondit une charge au palier le plus proche (2,5 kg par défaut). */
export function roundLoad(kg: number, step = 2.5): number {
  return Math.round(kg / step) * step
}

export interface RpeLoad {
  /** Charge arrondie à travailler */
  kg: number
  percent: number
  rir: number
}

/** Charge de travail : 1RM × % de la table, arrondie au palier. */
export function loadFromRpe(oneRepMaxKg: number, reps: number, rpe: number, step = 2.5): RpeLoad | null {
  const percent = percentOf1RM(reps, rpe)
  if (percent === null || !(oneRepMaxKg > 0)) return null
  return { kg: roundLoad((oneRepMaxKg * percent) / 100, step), percent, rir: rirFor(rpe) }
}

/** Affichage français : 8 → « 8 », 7,5 → « 7,5 ». */
export const formatRpe = (rpe: number) => decimalText(rpe)
