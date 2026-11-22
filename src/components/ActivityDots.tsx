import { Fragment } from 'react'

const MONTH: Intl.DateTimeFormatOptions = { month: 'short' }

interface Props {
  /** Dates locales (AAAA-MM-JJ) des jours où une séance a été terminée. */
  trainedDays: Set<string>
  weeks?: number
}

/** Un point par jour sur les dernières semaines, allumé les jours d'entraînement. */
export function ActivityDots({ trainedDays, weeks = 13 }: Props) {
  const today = Temporal.Now.plainDateISO()
  const start = today.subtract({ days: today.dayOfWeek - 1 + 7 * (weeks - 1) })
  const columns = Array.from({ length: weeks }, (_, w) => {
    const monday = start.add({ days: 7 * w })
    const days = Array.from({ length: 7 }, (_, d) => monday.add({ days: d }))
    const firstOfMonth = days.find((day) => day.day === 1)
    const month = w === 0 ? monday : firstOfMonth
    return { key: monday.toString(), days, month: month ? month.toLocaleString('fr-FR', MONTH) : '' }
  })
  const count = [...trainedDays].filter((d) => Temporal.PlainDate.compare(Temporal.PlainDate.from(d), start) >= 0).length
  return (
    <div className="dots" role="img" aria-label={`${count} jour${count > 1 ? 's' : ''} d’entraînement sur les ${weeks} dernières semaines`}>
      {columns.map((col) => (
        <Fragment key={col.key}>
          <span className="month" aria-hidden="true">{col.month}</span>
          {col.days.map((day) => {
            const iso = day.toString()
            const cmp = Temporal.PlainDate.compare(day, today)
            const cls = ['dot', trainedDays.has(iso) && 'on', cmp === 0 && 'is-today', cmp > 0 && 'future'].filter(Boolean).join(' ')
            return <span key={iso} className={cls} aria-hidden="true" />
          })}
        </Fragment>
      ))}
    </div>
  )
}
