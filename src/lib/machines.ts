import type { Equipment } from './types'

export interface Link { exercise_id: string; equipment_id: string }

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

/** Marques distinctes, dans l'ordre alphabétique. */
export function brandsOf(equipment: Equipment[]): string[] {
  const byKey = new Map<string, string>()
  for (const eq of equipment) {
    const b = eq.brand?.trim()
    if (b && !byKey.has(b.toLocaleLowerCase('fr'))) byKey.set(b.toLocaleLowerCase('fr'), b)
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'fr'))
}

/**
 * Machine à utiliser pendant la séance :
 * - la machine programmée si elle est dans la salle de la séance (ou si aucune salle n'est choisie) ;
 * - sinon une machine de la salle associée à l'exercice et de la même marque ;
 * - sinon aucune (la marque reste affichée).
 */
export function resolveMachine(
  plan: { exerciseId: string; equipmentId: string | null; brand: string | null },
  gymId: string | null, equipment: Equipment[], links: Link[],
): string | null {
  const planned = plan.equipmentId ? equipment.find((eq) => eq.id === plan.equipmentId) : undefined
  if (planned && (!gymId || planned.gym_id === gymId)) return planned.id
  const brand = plan.brand ?? planned?.brand ?? null
  if (!gymId || !brand) return null
  return machinesFor(plan.exerciseId, equipment, links, { gymId, brand })[0]?.id ?? null
}
