import { useEffect, useState } from 'react'
import { formatClock } from '../lib/dates'

const ADJUST_MS = 15_000

interface Props {
  endsAt: number | null
  onChange: (endsAt: number | null) => void
}

/** Minuteur de repos basé sur une heure de fin (précis même si l'onglet est en veille). */
export function RestTimer({ endsAt, onChange }: Props) {
  const [now, setNow] = useState(() => Date.now())
  const [announce, setAnnounce] = useState('')
  // Durée totale du repos en cours, pour la jauge qui se vide
  const [spanFor, setSpanFor] = useState<{ end: number; span: number } | null>(null)

  useEffect(() => {
    if (endsAt === null) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      setSpanFor((prev) => {
        if (prev?.end === endsAt) return prev
        // ±15 s : on ajuste le repos en cours, sinon c'est un nouveau repos
        const adjusted = prev !== null && Math.abs(endsAt - prev.end) === ADJUST_MS
        return { end: endsAt, span: adjusted ? Math.max(1, prev.span + endsAt - prev.end) : Math.max(1, endsAt - t) }
      })
      if (t >= endsAt) {
        clearInterval(id)
        navigator.vibrate?.([200, 100, 200])
        setAnnounce('Repos terminé, série suivante !')
        onChange(null)
      }
    }, 250)
    return () => clearInterval(id)
  }, [endsAt, onChange])

  useEffect(() => {
    if (!announce) return
    const id = setTimeout(() => setAnnounce(''), 4000)
    return () => clearTimeout(id)
  }, [announce])

  const remaining = endsAt === null ? 0 : (endsAt - now) / 1000
  const ratio = spanFor?.end === endsAt ? Math.min(1, Math.max(0, (remaining * 1000) / spanFor.span)) : 1

  return (
    <>
      <p role="status" className="visually-hidden">{announce}</p>
      {announce && endsAt === null && <div className="rest-bar done" aria-hidden="true">{announce}</div>}
      {endsAt !== null && (
        <div className="rest-bar" role="group" aria-label="Minuteur de repos">
          <span className="rest-time">
            <span className="rest-label">Repos</span>
            <span className="rest-clock" role="timer" aria-live="off">{formatClock(remaining)}</span>
          </span>
          <button type="button" onClick={() => onChange(endsAt - ADJUST_MS)} aria-label="Retirer 15 secondes">−15 s</button>
          <button type="button" onClick={() => onChange(endsAt + ADJUST_MS)} aria-label="Ajouter 15 secondes">+15 s</button>
          <button type="button" onClick={() => onChange(null)}>Passer</button>
          <span className="rest-drain" aria-hidden="true" style={{ transform: `scaleX(${ratio})` }} />
        </div>
      )}
    </>
  )
}
