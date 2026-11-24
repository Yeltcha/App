/** Lit un nombre saisi en français (virgule ou point). Renvoie null si invalide. */
export function parseDecimal(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, '').replace(',', '.')
  if (normalized === '') return null
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  return Number(normalized)
}

const kg = new Intl.NumberFormat('fr-FR', { style: 'unit', unit: 'kilogram', maximumFractionDigits: 1 })
const num = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

export const formatKg = (value: number) => kg.format(value)
export const formatNumber = (value: number) => num.format(value)

/** Nombre à éditer dans un champ, à la française : 97.5 → « 97,5 », rien → « ». */
export const decimalText = (value: number | string | null | undefined) =>
  value == null ? '' : String(Number(value)).replace('.', ',')

/** 1RM estimé selon Epley, fiable jusqu'à ~12 répétitions. */
export function estimate1RM(weightKg: number, reps: number): number | null {
  if (reps < 1 || reps > 12 || weightKg <= 0) return null
  if (reps === 1) return weightKg
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}
