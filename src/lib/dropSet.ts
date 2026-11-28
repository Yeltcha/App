import { roundLoad } from './rpe'

interface DropSetSource {
  id: string
  set_number: number
  set_kind: string
  weight_kg: number | string
  reps: number
  rest_sec: number
  done: boolean
  completed_at: string | null
}

/** Part de la charge retirée à chaque drop set. */
export const DROP_RATIO = 0.8

/** Charge proposée pour un drop set : −20 %, arrondie à 2,5 kg (0,5 kg pour les petites charges). */
export function dropWeight(weightKg: number): number {
  const step = weightKg >= 10 ? 2.5 : 0.5
  return Math.max(0, roundLoad(weightKg * DROP_RATIO, step))
}

/** Numéro affiché de chaque série : les séries « normales » sont numérotées, les drops suivent leur série. */
export function setLabels<T extends { id: string; set_kind: string }>(group: T[]): Map<string, { number: number; drop: number | null }> {
  const labels = new Map<string, { number: number; drop: number | null }>()
  let number = 0
  let drop = 0
  for (const s of group) {
    if (s.set_kind === 'drop' && number > 0) {
      drop += 1
      labels.set(s.id, { number, drop })
    } else {
      number += 1
      drop = 0
      labels.set(s.id, { number, drop: null })
    }
  }
  return labels
}

/**
 * Série à laquelle on accroche le prochain drop set : la dernière série cochée
 * (le drop se fait juste après), sinon la prochaine série à faire. On renvoie
 * la série « mère » (pas un drop).
 */
export function dropAnchor<T extends DropSetSource>(group: T[]): T | undefined {
  const done = group.filter((s) => s.done && s.completed_at)
    .sort((a, b) => Date.parse(b.completed_at!) - Date.parse(a.completed_at!))[0]
  const start = done ?? group.find((s) => !s.done) ?? group.at(-1)
  if (!start) return undefined
  let index = group.indexOf(start)
  while (index > 0 && group[index].set_kind === 'drop') index -= 1
  return group[index]
}

export interface DropSetChange<T> {
  /** Séries à décaler d'un cran pour faire de la place */
  renumber: { id: string; set_number: number }[]
  /** Dernière série de la chaîne actuelle : plus de repos après elle */
  chainEnd: T
  /** Valeurs du nouveau drop set */
  drop: { set_number: number; weight_kg: number; reps: number; rest_sec: number }
}

/** Ajoute un drop set à la fin de la chaîne de la série `anchor` (série mère + drops déjà ajoutés). */
export function planDropSet<T extends DropSetSource>(group: T[], anchor: T): DropSetChange<T> {
  let end = group.indexOf(anchor)
  while (end + 1 < group.length && group[end + 1].set_kind === 'drop') end += 1
  const chainEnd = group[end]
  return {
    renumber: group.slice(end + 1).map((s) => ({ id: s.id, set_number: s.set_number + 1 })),
    chainEnd,
    drop: {
      set_number: chainEnd.set_number + 1,
      weight_kg: dropWeight(Number(chainEnd.weight_kg)),
      reps: chainEnd.reps,
      // Le repos se prend après le dernier drop, pas entre les séries de la chaîne
      rest_sec: chainEnd.rest_sec,
    },
  }
}
