/** Disques calibrés disponibles, du plus lourd au plus léger (kg). */
export const PLATES = [25, 20, 15, 10, 5, 2.5, 2, 1.5, 1, 0.5] as const
export type Plate = (typeof PLATES)[number]

export const BAR_KG = 20

export interface BarLoad {
  /** Disques à charger de chaque côté, du centre vers l'extérieur. */
  perSide: Plate[]
  /** Reste impossible à charger avec ces disques (kg par côté). */
  remainder: number
}

/** Calcule les disques à mettre de chaque côté d'une barre olympique. */
export function loadBar(totalKg: number, barKg: number = BAR_KG): BarLoad | null {
  if (!Number.isFinite(totalKg) || totalKg < barKg) return null
  // On travaille en centièmes de kilo pour éviter les erreurs d'arrondi
  let side = Math.round(((totalKg - barKg) / 2) * 100)
  const perSide: Plate[] = []
  for (const plate of PLATES) {
    const p = Math.round(plate * 100)
    while (side >= p) {
      perSide.push(plate)
      side -= p
    }
  }
  return { perSide, remainder: side / 100 }
}

/** Couleur du disque : chaque poids reprend le code couleur des disques calibrés. */
export function plateColor(plate: Plate): string {
  switch (plate) {
    case 25: case 2.5: return 'var(--disque-25)'
    case 20: case 2: return 'var(--disque-20)'
    case 15: case 1.5: return 'var(--disque-15)'
    case 10: case 1: return 'var(--disque-10)'
    default: return 'var(--disque-5)'
  }
}

const BARBELL = /\bbarre\b|soulevé de terre|squat avant|hip thrust/i

/** Exercice réalisé à la barre olympique (d'après son nom). */
export function isBarbellExercise(name: string | undefined): boolean {
  if (!name) return false
  return BARBELL.test(name) && !/haltère|barre au front/i.test(name)
}
