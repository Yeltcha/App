const KEY = 'muscu:rest-ends-at'

export function readRestEnd(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY))
    return Number.isFinite(v) && v > Date.now() ? v : null
  } catch {
    return null
  }
}

export function writeRestEnd(value: number | null) {
  try {
    if (value === null) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, String(value))
  } catch { /* stockage indisponible : le minuteur reste en mémoire */ }
}
