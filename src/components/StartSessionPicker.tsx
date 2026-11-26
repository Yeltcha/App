import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ACTIVE_SESSION_KEY, startSession } from '../lib/sessions'
import { useGyms } from '../lib/queries'
import { useMyProgram, useNextWorkout } from '../lib/program'
import type { Workout } from '../lib/types'
import { ErrorMessage, Loading } from './Feedback'

const LAST_GYM_KEY = 'muscu:last-gym'

function readLastGym(): string {
  try { return localStorage.getItem(LAST_GYM_KEY) ?? '' } catch { return '' }
}

interface StartSessionPickerProps {
  athleteId: string
  /** Séance déjà choisie (null = séance libre) : on passe directement au choix de la salle. */
  initial?: Workout | null
}

/**
 * Démarrage d'une séance en deux temps : choisir la séance (toutes celles du
 * programme, la conseillée mise en avant, ou une séance libre), puis la salle.
 */
export function StartSessionPicker({ athleteId, initial }: StartSessionPickerProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const gyms = useGyms()
  const next = useNextWorkout(athleteId)
  const program = useMyProgram(athleteId)
  const [choice, setChoice] = useState<Workout | null | undefined>(initial)
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)
  const gymName = (id: string | null) => gyms.data?.find((g) => g.id === id)?.name

  async function onStart(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const gymId = String(new FormData(e.currentTarget).get('gym') || '') || null
    setPending(true)
    setError(null)
    try {
      try { if (gymId) localStorage.setItem(LAST_GYM_KEY, gymId) } catch { /* stockage indisponible */ }
      await startSession({ athleteId, gymId, workout: choice })
      await queryClient.invalidateQueries({ queryKey: ACTIVE_SESSION_KEY })
      navigate('/seance')
    } catch (err) {
      setError(err)
    } finally {
      setPending(false)
    }
  }

  if (choice !== undefined) {
    return (
      <form onSubmit={onStart} className="stack">
        <div className="start-chosen">
          <span className="today-label">{choice ? 'Séance du programme' : 'Séance libre'}</span>
          <strong>{choice ? choice.name : 'Tu choisis tes exercices au fil de l’eau'}</strong>
          <button type="button" className="link" onClick={() => setChoice(undefined)}>Changer de séance</button>
        </div>
        <div className="field">
          <label htmlFor="gym">Dans quelle salle es-tu ?</label>
          <select key={choice?.id ?? 'libre'} id="gym" name="gym" defaultValue={choice?.gym_id ?? readLastGym()} aria-describedby="gym-help">
            <option value="">Aucune salle précise</option>
            {gyms.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <span id="gym-help" className="hint">Seuls les exercices réalisables avec les machines de cette salle seront proposés.</span>
        </div>
        <ErrorMessage error={error} />
        <button type="submit" className="primary" disabled={pending} autoFocus>C’est parti</button>
      </form>
    )
  }

  if (program.isPending || next.isPending) return <Loading />
  if (program.error) return <ErrorMessage error={program.error} />

  return (
    <div className="stack">
      {program.data && program.data.workouts.length > 0 ? (
        <>
          <p className="muted">Programme : {program.data.name}</p>
          <ul className="workout-choices" aria-label="Séances du programme">
            {program.data.workouts.map((w, index) => {
              const recommended = w.id === next.data?.id
              const gym = gymName(w.gym_id)
              return (
                <li key={w.id}>
                  <button type="button" className={recommended ? 'workout-choice recommended' : 'workout-choice'} onClick={() => setChoice(w)}>
                    <span className="workout-choice-index" aria-hidden="true">{index + 1}</span>
                    <span className="workout-choice-text">
                      <span className="workout-choice-name">{w.name}</span>
                      <span className="muted small">
                        {w.exerciseCount} exercice{w.exerciseCount > 1 ? 's' : ''}{gym ? ` · ${gym}` : ''}
                      </span>
                    </span>
                    {recommended && <span className="badge">Conseillée</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <p className="muted">Aucun programme ne t’est attribué pour l’instant. Lance une séance libre et choisis tes exercices au fil de l’eau.</p>
      )}
      <button type="button" className="free-session" onClick={() => setChoice(null)}>Démarrer une séance libre</button>
    </div>
  )
}
