import { MUSCLE_LABELS, type Equipment, type Exercise } from './types'

export interface Link { exercise_id: string; equipment_id: string }

/** « Pec deck (Technogym) » */
export const machineLabel = (eq: Pick<Equipment, 'name' | 'brand'>) => `${eq.name}${eq.brand ? ` (${eq.brand})` : ''}`

/** Recherche d'un exercice par nom ou par muscle (requête déjà en minuscules). */
export const matchesExercise = (e: Pick<Exercise, 'name' | 'muscle_group'>, query: string) =>
  !query || e.name.toLocaleLowerCase('fr').includes(query) || MUSCLE_LABELS[e.muscle_group].toLocaleLowerCase('fr').includes(query)

const same = (a: string | null | undefined, b: string | null | undefined) =>
  Boolean(a && b && a.trim().toLocaleLowerCase('fr') === b.trim().toLocaleLowerCase('fr'))

/** Machines associées à un exercice, éventuellement limitées à une salle et à une marque. */
export function machinesFor(
  exerciseId: string, equipment: Equipment[], links: Link[],
  { gymId, brand }: { gymId?: string | null; brand?: string | null } = {},
): Equipment[] {
  const linked = new Set(links.filter((l) => l.exercise_id === exerciseId).map((l) => l.equipment_id))
  return equipment.filter((eq) =>
    linked.has(eq.id) && (!gymId || eq.gym_id === gymId) && (!brand?.trim() || same(eq.brand, brand)))
}

/**
 * Machine à utiliser pendant la séance :
 * - la machine programmée si elle est dans la salle de la séance (ou si aucune salle n'est choisie) ;
 * - sinon, dans la salle de la séance, une machine de la même marque associée à l'exercice ;
 * - sinon aucune.
 */
export function resolveMachine(
  plan: { exerciseId: string; equipmentId: string | null },
  gymId: string | null, equipment: Equipment[], links: Link[],
): string | null {
  const planned = plan.equipmentId ? equipment.find((eq) => eq.id === plan.equipmentId) : undefined
  if (planned && (!gymId || planned.gym_id === gymId)) return planned.id
  const brand = planned?.brand ?? null
  if (!gymId || !brand) return null
  return machinesFor(plan.exerciseId, equipment, links, { gymId, brand })[0]?.id ?? null
}

export interface MachineChoice { exercise: Exercise; machine: Equipment }

/**
 * Exercices proposés à la création d'une séance :
 * les exercices sans machine, puis ceux des machines de la salle, rangés par marque.
 * Sans salle, seulement les exercices sans machine.
 */
export function exerciseChoices(
  exercises: Exercise[], equipment: Equipment[], links: Link[], gymId: string | null,
): { free: Exercise[]; brands: { brand: string; items: MachineChoice[] }[] } {
  const free = exercises.filter((e) => !e.requires_equipment)
  if (!gymId) return { free, brands: [] }
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const groups = new Map<string, MachineChoice[]>()
  for (const machine of equipment.filter((eq) => eq.gym_id === gymId)) {
    for (const link of links.filter((l) => l.equipment_id === machine.id)) {
      const exercise = byId.get(link.exercise_id)
      if (!exercise) continue
      const brand = machine.brand ?? 'Sans marque'
      groups.set(brand, [...(groups.get(brand) ?? []), { exercise, machine }])
    }
  }
  const brands = [...groups.entries()]
    .sort(([a], [b]) => (a === 'Sans marque' ? 1 : b === 'Sans marque' ? -1 : a.localeCompare(b, 'fr')))
    .map(([brand, items]) => ({
      brand,
      items: items.sort((x, y) => x.exercise.name.localeCompare(y.exercise.name, 'fr') || x.machine.name.localeCompare(y.machine.name, 'fr')),
    }))
  return { free, brands }
}
