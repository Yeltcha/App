import { useEffect, useState } from 'react'
import { formatClock } from '../lib/dates'

interface Props {
  endsAt: number | null
  onChange: (endsAt: number | null) => void
}

/** Minuteur de repos basé sur une heure de fin (précis même si l'onglet est en veille). */
export function RestTimer({ endsAt, onChange }: Props) {
  const [now, setNow] = useState(() => Date.now())
  const [announce, setAnnounce] = useState('')

  useEffect(() => {
    if (endsAt === null) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
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

  return (
    <>
      <p role="status" className="visually-hidden">{announce}</p>
      {announce && endsAt === null && <div className="rest-bar done" aria-hidden="true">{announce}</div>}
      {endsAt !== null && (
        <div className="rest-bar" role="group" aria-label="Minuteur de repos">
          <span className="rest-label">Repos</span>
          <span className="rest-clock" role="timer" aria-live="off">{formatClock(remaining)}</span>
          <button type="button" onClick={() => onChange(endsAt - 15_000)} aria-label="Retirer 15 secondes">−15 s</button>
          <button type="button" onClick={() => onChange(endsAt + 15_000)} aria-label="Ajouter 15 secondes">+15 s</button>
          <button type="button" onClick={() => onChange(null)}>Passer</button>
        </div>
      )}
    </>
  )
}
