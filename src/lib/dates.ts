import type {} from 'temporal-polyfill/types/global'

/**
 * Charge le polyfill Temporal uniquement si le navigateur ne le fournit pas
 * (Safari notamment). À appeler avant le premier rendu.
 */
export async function ensureTemporal(): Promise<void> {
  if (!('Temporal' in globalThis)) {
    await import('temporal-polyfill/global')
  }
}

/** Date du jour dans le fuseau de l'appareil, au format AAAA-MM-JJ. */
export function todayISO(): string {
  return Temporal.Now.plainDateISO().toString()
}

const LONG_DATE: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
const SHORT_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }

export function formatLongDate(iso: string): string {
  return Temporal.PlainDate.from(iso).toLocaleString('fr-FR', LONG_DATE)
}

export function formatShortDate(iso: string): string {
  return Temporal.PlainDate.from(iso).toLocaleString('fr-FR', SHORT_DATE)
}

let durationFormat: Intl.DurationFormat | null | undefined

function formatHoursMinutes(hours: number, minutes: number): string {
  if (durationFormat === undefined) {
    durationFormat = 'DurationFormat' in Intl ? new Intl.DurationFormat('fr-FR', { style: 'short' }) : null
  }
  if (durationFormat) return durationFormat.format({ hours, minutes })
  // Repli si Intl.DurationFormat est absent
  if (hours === 0) return `${minutes} min`
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')} min`
}

/** Durée lisible entre deux horodatages (ms), ex. « 1 h 5 min ». */
export function formatDuration(startMs: number, endMs: number): string {
  const duration = Temporal.Instant.fromEpochMilliseconds(startMs)
    .until(Temporal.Instant.fromEpochMilliseconds(endMs), { largestUnit: 'hours' })
    .round({ smallestUnit: 'minutes', roundingMode: 'halfExpand' })
  if (duration.hours === 0 && duration.minutes === 0) return '< 1 min'
  return formatHoursMinutes(duration.hours, duration.minutes)
}

/** Date locale (AAAA-MM-JJ) d'un horodatage ISO renvoyé par la base. */
export function localDateOf(timestamp: string): string {
  return Temporal.Instant.from(timestamp).toZonedDateTimeISO(Temporal.Now.timeZoneId()).toPlainDate().toString()
}

/** Nombre de jours entre deux dates ISO (b − a). */
export function daysBetween(a: string, b: string): number {
  return Temporal.PlainDate.from(a).until(Temporal.PlainDate.from(b), { largestUnit: 'days' }).days
}

/** Compte à rebours mm:ss */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
