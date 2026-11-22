/** Place d'un exercice dans un superset (A1, A2…). */
export interface SupersetSlot {
  /** Numéro du superset : position du premier exercice du groupe */
  group: number
  /** Lettre du superset (A, B…) */
  letter: string
  /** Rang dans le superset, à partir de 1 */
  order: number
  /** Nombre d'exercices du superset */
  size: number
}

/**
 * Supersets d'une liste d'exercices ordonnée : chaque exercice lié au précédent
 * rejoint son groupe. Le premier exercice ne peut pas être lié ; un groupe
 * compte au moins deux exercices. Renvoie null pour un exercice seul.
 */
export function supersetSlots(items: { superset_with_previous: boolean }[]): (SupersetSlot | null)[] {
  const starts: number[] = []
  items.forEach((item, i) => {
    starts.push(i > 0 && item.superset_with_previous ? starts[i - 1] : i)
  })
  const sizes = new Map<number, number>()
  for (const start of starts) sizes.set(start, (sizes.get(start) ?? 0) + 1)
  const letters = new Map<number, string>()
  for (const [start, size] of [...sizes.entries()].sort((a, b) => a[0] - b[0])) {
    if (size > 1) letters.set(start, String.fromCharCode(65 + (letters.size % 26)))
  }
  return starts.map((start, i) => {
    const letter = letters.get(start)
    if (!letter) return null
    return { group: start, letter, order: i - start + 1, size: sizes.get(start)! }
  })
}

/** Libellé court : « A1 », « A2 »… */
export const slotLabel = (slot: SupersetSlot) => `${slot.letter}${slot.order}`

/**
 * Supersets d'une séance en cours, à partir des numéros enregistrés sur les séries.
 * `positions` : positions des exercices dans l'ordre ; `groupOf` : numéro du superset.
 */
export function sessionSupersets(positions: { position: number; group: number | null }[]): Map<number, SupersetSlot> {
  const members = new Map<number, number[]>()
  for (const p of positions) {
    if (p.group === null) continue
    members.set(p.group, [...(members.get(p.group) ?? []), p.position])
  }
  const result = new Map<number, SupersetSlot>()
  let letterIndex = 0
  for (const [group, list] of [...members.entries()].sort((a, b) => Math.min(...a[1]) - Math.min(...b[1]))) {
    if (list.length < 2) continue
    const letter = String.fromCharCode(65 + (letterIndex++ % 26))
    list.sort((a, b) => a - b).forEach((position, i) => result.set(position, { group, letter, order: i + 1, size: list.length }))
  }
  return result
}

/** Après une série, on enchaîne sans repos tant que ce n'est pas le dernier exercice du superset. */
export const restsAfter = (slot: SupersetSlot | null | undefined) => !slot || slot.order === slot.size
