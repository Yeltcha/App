import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../lib/supabase'
import { byId, useEquipment, useExercises, useGyms } from '../lib/queries'
import type { Session, SessionExerciseNote, SessionSet } from '../lib/types'
import { formatDuration, formatLongDate, localDateOf } from '../lib/dates'
import { estimate1RM, formatKg } from '../lib/numbers'
import { formatRpe } from '../lib/rpe'
import { SET_KIND_LABELS } from '../lib/setPlan'
import { sessionSupersets, slotLabel } from '../lib/superset'
import { groupByExercise } from '../lib/sessionSets'
import { machineLabel } from '../lib/machines'
import { ConfirmDialog } from '../components/Dialog'
import { ErrorMessage, Loading } from '../components/Feedback'

export default function SessionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const exercises = byId(useExercises().data)
  const equipment = byId(useEquipment().data)
  const gyms = byId(useGyms().data)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const data = useQuery({
    queryKey: ['session-detail', id],
    queryFn: async () => {
      const session = unwrap(await supabase.from('sessions').select('*').eq('id', id!).single()) as Session
      const sets = unwrap(await supabase.from('session_sets').select('*').eq('session_id', id!)
        .order('exercise_position').order('set_number')) as SessionSet[]
      const notes = unwrap(await supabase.from('session_exercise_notes').select('*').eq('session_id', id!)) as SessionExerciseNote[]
      return { session, sets, notes: new Map(notes.map((n) => [n.exercise_position, n.note])) }
    },
  })

  if (data.isPending) return <Loading />
  if (data.error) return <ErrorMessage error={data.error} />
  const { session, sets, notes } = data.data

  const groups = groupByExercise(sets)
  const supersets = sessionSupersets(groups.map(([position, g]) => ({ position, group: g[0].superset_group })))

  async function remove() {
    setConfirming(false)
    const { error } = await supabase.from('sessions').delete().eq('id', session.id)
    if (error) return setError(error.message)
    await queryClient.invalidateQueries()
    navigate('/historique')
  }

  return (
    <div className="stack-lg">
      <header className="page-head">
        <h1>{session.name}</h1>
        <p className="muted">{formatLongDate(localDateOf(session.started_at))}</p>
        <dl className="session-facts">
          {session.ended_at && (
            <div className="fact"><dt>durée</dt><dd>{formatDuration(Date.parse(session.started_at), Date.parse(session.ended_at))}</dd></div>
          )}
          <div className="fact"><dt>séries</dt><dd>{sets.length}</dd></div>
          {session.rpe && <div className="fact"><dt>RPE</dt><dd>{session.rpe}/10</dd></div>}
          {session.gym_id && gyms.get(session.gym_id) && (
            <div className="fact"><dt>salle</dt><dd>{gyms.get(session.gym_id)!.name}</dd></div>
          )}
        </dl>
        {session.notes && <p className="notes">{session.notes}</p>}
      </header>
      <ErrorMessage error={error} />

      {groups.map(([pos, group]) => {
        const slot = supersets.get(pos)
        const ex = exercises.get(group[0].exercise_id)
        const eq = group[0].equipment_id ? equipment.get(group[0].equipment_id) : undefined
        const best = Math.max(...group.map((s) => estimate1RM(Number(s.weight_kg), s.reps) ?? 0))
        return (
          <section key={pos} className="card" aria-labelledby={`d-${pos}`}>
            <h2 id={`d-${pos}`}>{slot && <span className="superset-tag" title={`Superset ${slot.letter}`}>{slotLabel(slot)}</span>}{ex?.name}</h2>
            {eq && <p className="muted small">{machineLabel(eq)}</p>}
            <ol className="set-summary">
              {group.map((s) => (
                <li key={s.id}>
                  {s.set_kind !== 'normal' && <span className="set-kind">{SET_KIND_LABELS[s.set_kind]}</span>}
                  {formatKg(Number(s.weight_kg))} × {s.reps}{s.specialty === 'cardio' ? ' min' : ''}
                  {s.rpe !== null && <span className="set-rpe"> · RPE {formatRpe(Number(s.rpe))}{s.target_rpe !== null ? ` (cible ${formatRpe(Number(s.target_rpe))})` : ''}</span>}
                </li>
              ))}
            </ol>
            {best > 0 && <p className="small muted">1RM estimé : {formatKg(best)}</p>}
            {notes.get(pos) && <p className="exercise-comment"><span className="visually-hidden">Commentaire : </span>{notes.get(pos)}</p>}
          </section>
        )
      })}

      <button type="button" className="danger-link" onClick={() => setConfirming(true)}>Supprimer cette séance</button>
      <ConfirmDialog open={confirming} title="Supprimer la séance ?" message="Cette séance et ses séries seront définitivement supprimées."
        confirmLabel="Supprimer" onConfirm={remove} onCancel={() => setConfirming(false)} />
    </div>
  )
}
