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
 * Supersets d'une séance en cours, à partir des numéros enregistrés sur les séries :
 * deux exercices qui se suivent avec le même numéro sont enchaînés (même règle que supersetSlots).
 * Renvoie la place de chaque exercice, par position ; `group` = position du premier exercice.
 */
export function sessionSupersets(exercises: { position: number; group: number | null }[]): Map<number, SupersetSlot> {
  const sorted = [...exercises].sort((a, b) => a.position - b.position)
  const slots = supersetSlots(sorted.map((e, i) => ({
    superset_with_previous: i > 0 && e.group !== null && e.group === sorted[i - 1].group,
  })))
  const result = new Map<number, SupersetSlot>()
  sorted.forEach((e, i) => {
    const slot = slots[i]
    if (slot) result.set(e.position, { ...slot, group: sorted[slot.group].position })
  })
  return result
}

/** Après une série, on enchaîne sans repos tant que ce n'est pas le dernier exercice du superset. */
export const restsAfter = (slot: SupersetSlot | null | undefined) => !slot || slot.order === slot.size
