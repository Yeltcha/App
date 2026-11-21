import { Link } from 'react-router'
import type { SessionSummary } from '../lib/types'
import { formatDuration, formatLongDate, localDateOf } from '../lib/dates'
import { formatKg } from '../lib/numbers'

interface Props {
  summary: SessionSummary
  gymName?: string
  detailed?: boolean
}

/** Une séance terminée, en ligne : nom et date à gauche, durée et séries à droite. */
export function SessionRow({ summary: s, gymName, detailed = false }: Props) {
  const showExtra = detailed && (Number(s.volume_kg) > 0 || s.rpe || gymName)
  return (
    <Link to={`/historique/${s.session_id}`} className="session-row">
      <span className="name">{s.name}</span>
      <span className="facts">
        <span className="fact">
          <b>{formatDuration(Date.parse(s.started_at), Date.parse(s.ended_at))}</b>
          <span>durée</span>
        </span>
        <span className="fact">
          <b>{s.sets_done}</b>
          <span>séries</span>
        </span>
      </span>
      <span className="date">{formatLongDate(localDateOf(s.started_at))}</span>
      {showExtra && (
        <span className="extra">
          {Number(s.volume_kg) > 0 && <span>{formatKg(Number(s.volume_kg))} soulevés</span>}
          {s.rpe && <span>RPE {s.rpe}</span>}
          {gymName && <span>{gymName}</span>}
        </span>
      )}
    </Link>
  )
}
