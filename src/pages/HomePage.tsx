import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/auth'
import { supabase, unwrap } from '../lib/supabase'
import { ACTIVE_SESSION_KEY, startSession, useActiveSession } from '../lib/sessions'
import { byId, useExercises, useGyms } from '../lib/queries'
import type { Program, SessionSummary, Workout, WorkoutExercise } from '../lib/types'
import { Dialog } from '../components/Dialog'
import { Empty, ErrorMessage, Loading } from '../components/Feedback'
import { SessionRow } from '../components/SessionRow'
import { BarLoad } from '../components/BarLoad'
import { isBarbellExercise } from '../lib/plates'
import { formatNumber } from '../lib/numbers'

const LAST_GYM_KEY = 'muscu:last-gym'

function readLastGym(): string {
  try { return localStorage.getItem(LAST_GYM_KEY) ?? '' } catch { return '' }
}

export function HomePage() {
  const { profile } = useAuth()
  const userId = profile?.id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const gyms = useGyms()
  const active = useActiveSession(userId)
  const [startFor, setStartFor] = useState<Workout | null | undefined>(undefined)
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)

  const next = useQuery({
    queryKey: ['next-workout', userId],
    enabled: Boolean(userId),
    queryFn: async () => (unwrap(await supabase.rpc('next_workout', { p_athlete: userId })) as Workout[])[0] ?? null,
  })

  const program = useQuery({
    queryKey: ['my-program', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const p = unwrap(
        await supabase.from('programs').select('*').eq('athlete_id', userId!).eq('is_active', true)
          .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      ) as Program | null
      if (!p) return null
      const workouts = unwrap(
        await supabase.from('workouts').select('*').eq('program_id', p.id).order('position'),
      ) as Workout[]
      return { ...p, workouts }
    },
  })

  const plan = useQuery({
    queryKey: ['workout-plan', next.data?.id],
    enabled: Boolean(next.data?.id),
    queryFn: async () =>
      unwrap(await supabase.from('workout_exercises').select('*').eq('workout_id', next.data!.id)
        .order('position')) as WorkoutExercise[],
  })
  const exerciseMap = byId(useExercises().data)

  const recent = useQuery({
    queryKey: ['summaries', userId, 'recent'],
    enabled: Boolean(userId),
    queryFn: async () =>
      unwrap(await supabase.from('session_summaries').select('*').eq('athlete_id', userId!)
        .order('started_at', { ascending: false }).limit(3)) as SessionSummary[],
  })

  async function onStart(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!userId) return
    const gymId = String(new FormData(e.currentTarget).get('gym') || '') || null
    setPending(true)
    setError(null)
    try {
      try { if (gymId) localStorage.setItem(LAST_GYM_KEY, gymId) } catch { /* stockage indisponible */ }
      await startSession({ athleteId: userId, gymId, workout: startFor })
      await queryClient.invalidateQueries({ queryKey: ACTIVE_SESSION_KEY })
      setStartFor(undefined)
      navigate('/seance')
    } catch (err) {
      setError(err)
    } finally {
      setPending(false)
    }
  }

  const gymForWorkout = startFor?.gym_id ?? readLastGym()

  const firstName = profile?.full_name.split(' ')[0] || ''

  return (
    <div className="stack-lg">
      <h1 className="greeting">Bonjour {firstName}</h1>

      {active.data ? (
        <section className="card today live" aria-labelledby="active-title">
          <p className="today-label" id="active-title">Séance en cours</p>
          <h2 className="today-title">{active.data.name}</h2>
          <Link to="/seance" className="button primary cta">Reprendre la séance</Link>
        </section>
      ) : next.isPending ? <Loading /> : next.data ? (
        <section className="card today" aria-labelledby="next-title">
          <div className="stack-sm">
            <p className="today-label">Prochaine séance</p>
            <h2 className="today-title" id="next-title">{next.data.name}</h2>
            {program.data && <p className="muted">Programme : {program.data.name}</p>}
          </div>
          {plan.data && plan.data.length > 0 && (
            <ul className="plan-list" aria-label={`Exercices de ${next.data.name}`}>
              {plan.data.map((item, index) => {
                const name = exerciseMap.get(item.exercise_id)?.name
                return (
                <li key={item.id}>
                  <span><span className="station" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{name ?? 'Exercice'}</span>
                  <span className="figure">
                    {item.target_sets} × {item.rep_max ? `${item.rep_min}–${item.rep_max}` : item.rep_min}
                    {item.target_weight_kg ? ` @ ${formatNumber(Number(item.target_weight_kg))} kg` : null}
                  </span>
                  {item.target_weight_kg && isBarbellExercise(name) ? <BarLoad weightKg={Number(item.target_weight_kg)} /> : null}
                </li>
                )
              })}
            </ul>
          )}
          <button type="button" className="primary cta" onClick={() => setStartFor(next.data)}>
            Démarrer {next.data.name}
          </button>
          <div className="today-actions">
            <button type="button" className="link" onClick={() => setStartFor(null)}>Séance libre</button>
            {program.data && program.data.workouts.length > 1 && (
              <details className="other-workouts">
                <summary>Choisir une autre séance du programme</summary>
                <ul className="plain-list">
                  {program.data.workouts.map((w) => (
                    <li key={w.id}>
                      <button type="button" className="link" onClick={() => setStartFor(w)}>{w.name}</button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </section>
      ) : (
        <section className="card today" aria-labelledby="next-title">
          <h2 className="today-title" id="next-title">Séance libre</h2>
          <p className="muted">Aucun programme ne t’est attribué pour l’instant. Lance une séance libre et choisis tes exercices au fil de l’eau.</p>
          <button type="button" className="primary cta" onClick={() => setStartFor(null)}>Démarrer une séance libre</button>
        </section>
      )}

      <section aria-labelledby="recent-title" className="stack">
        <div className="section-head">
          <h2 id="recent-title">Dernières séances</h2>
          {recent.data && recent.data.length > 0 && <Link to="/historique">Tout voir</Link>}
        </div>
        {recent.data?.length === 0 && <Empty>Tes séances terminées apparaîtront ici.</Empty>}
        <ul className="plain-list session-list">
          {recent.data?.map((s) => (
            <li key={s.session_id}><SessionRow summary={s} /></li>
          ))}
        </ul>
      </section>

      <Dialog open={startFor !== undefined} onClose={() => setStartFor(undefined)}
        title={startFor ? `Démarrer : ${startFor.name}` : 'Démarrer une séance libre'}>
        <form onSubmit={onStart} className="stack">
          <div className="field">
            <label htmlFor="gym">Dans quelle salle es-tu ?</label>
            <select id="gym" name="gym" defaultValue={gymForWorkout} aria-describedby="gym-help">
              <option value="">Aucune salle précise</option>
              {gyms.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <span id="gym-help" className="hint">Seuls les exercices réalisables avec les machines de cette salle seront proposés.</span>
          </div>
          <ErrorMessage error={error} />
          <button type="submit" className="primary" disabled={pending} autoFocus>C’est parti</button>
        </form>
      </Dialog>
    </div>
  )
}
