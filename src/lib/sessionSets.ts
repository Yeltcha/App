/** Séries d'une séance regroupées par exercice, dans l'ordre de la séance. */
export function groupByExercise<T extends { exercise_position: number }>(sets: T[]): [number, T[]][] {
  const map = new Map<number, T[]>()
  for (const s of sets) map.set(s.exercise_position, [...(map.get(s.exercise_position) ?? []), s])
  return [...map.entries()].sort((a, b) => a[0] - b[0])
}
