import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../lib/auth'
import { supabase, unwrap } from '../lib/supabase'
import { useActiveSession } from '../lib/sessions'
import { byId, useExercises } from '../lib/queries'
import { useMyProgram, useNextWorkout } from '../lib/program'
import type { BodyWeight, SessionSummary, Workout, WorkoutExercise } from '../lib/types'
import { Dialog } from '../components/Dialog'
import { StartSessionPicker } from '../components/StartSessionPicker'
import { Empty, Loading } from '../components/Feedback'
import { SessionRow } from '../components/SessionRow'
import { BarLoad } from '../components/BarLoad'
import { isBarbellExercise } from '../lib/plates'
import { formatNumber } from '../lib/numbers'
import { daysBetween, localDateOf, todayISO } from '../lib/dates'
import { ProgressRing } from '../components/ProgressRing'
import { ActivityDots } from '../components/ActivityDots'

const WEEKS = 13

function ago(iso: string): string {
  const days = daysBetween(iso, todayISO())
  if (days <= 0) return 'aujourd’hui'
  if (days === 1) return 'hier'
  return `il y a ${days} jours`
}

export function HomePage() {
  const { profile } = useAuth()
  const userId = profile?.id
  const active = useActiveSession(userId)
  // Fenêtre de démarrage : undefined = fermée ; initial absent = liste des séances ; null = séance libre
  const [picker, setPicker] = useState<{ key: number, initial?: Workout | null } | undefined>(undefined)
  const openPicker = (initial?: Workout | null) => setPicker({ key: Date.now(), initial })

  const next = useNextWorkout(userId)
  const program = useMyProgram(userId)

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

  const activity = useQuery({
    queryKey: ['summaries', userId, 'activity'],
    enabled: Boolean(userId),
    queryFn: async () => {
      const since = Temporal.Now.instant().subtract({ hours: 24 * 7 * (WEEKS + 1) }).toString()
      const rows = unwrap(await supabase.from('session_summaries').select('started_at, volume_kg')
        .eq('athlete_id', userId!).gte('started_at', since)) as Pick<SessionSummary, 'started_at' | 'volume_kg'>[]
      const weekAgo = Date.now() - 7 * 86_400_000
      const lastWeek = rows.filter((r) => Date.parse(r.started_at) >= weekAgo)
      return {
        days: new Set(rows.map((r) => localDateOf(r.started_at))),
        weekVolume: lastWeek.reduce((sum, r) => sum + Number(r.volume_kg), 0),
        weekSessions: lastWeek.length,
      }
    },
  })

  const weight = useQuery({
    queryKey: ['body-weight', userId, 'latest'],
    enabled: Boolean(userId),
    queryFn: async () =>
      unwrap(await supabase.from('body_weights').select('*').eq('athlete_id', userId!)
        .order('measured_on', { ascending: false }).limit(1).maybeSingle()) as BodyWeight | null,
  })

  const firstName = profile?.full_name.split(' ')[0] || ''
  const cycleWorkouts = program.data?.workouts.filter((w) => !w.is_bonus) ?? []
  const cycleIndex = next.data ? cycleWorkouts.findIndex((w) => w.id === next.data!.id) : -1
  const cycle = cycleIndex >= 0 ? { index: cycleIndex + 1, total: cycleWorkouts.length } : null

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
          <div className="today-head">
            {cycle && (
              <ProgressRing value={cycle.index} max={cycle.total} label={`Séance ${cycle.index} sur ${cycle.total} du programme`}>
                {cycle.index}
              </ProgressRing>
            )}
            <div className="stack-sm">
              <p className="today-label">Prochaine séance</p>
              {program.data && <p className="muted">Programme : {program.data.name}</p>}
            </div>
          </div>
          <h2 className="today-title" id="next-title">{next.data.name}</h2>
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
          <button type="button" className="primary cta" onClick={() => openPicker(next.data)}>
            Démarrer {next.data.name}
          </button>
          <button type="button" className="link" onClick={() => openPicker()}>
            Voir toutes les séances ou démarrer une séance libre
          </button>
        </section>
      ) : (
        <section className="card today" aria-labelledby="next-title">
          {program.data && program.data.workouts.length > 0 ? (
            <>
              <h2 className="today-title" id="next-title">Séance bonus</h2>
              <p className="muted">Ton programme {program.data.name} n’a que des séances bonus : choisis celle qui te fait envie.</p>
              <button type="button" className="primary cta" onClick={() => openPicker()}>Choisir une séance</button>
            </>
          ) : (
            <>
              <h2 className="today-title" id="next-title">Séance libre</h2>
              <p className="muted">Aucun programme ne t’est attribué pour l’instant. Lance une séance libre et choisis tes exercices au fil de l’eau.</p>
              <button type="button" className="primary cta" onClick={() => openPicker(null)}>Démarrer une séance libre</button>
            </>
          )}
        </section>
      )}

      <section aria-label="En bref" className="bento">
        <Link to="/profil" className="tile">
          <span className="tile-value">
            {weight.data ? formatNumber(Number(weight.data.weight_kg)) : '–'}<small>kg</small>
          </span>
          <span className="tile-label">
            <strong>Poids de corps</strong>
            <span>{weight.data ? ago(weight.data.measured_on) : 'Ajoute ta première pesée'}</span>
          </span>
        </Link>
        <Link to="/stats" className="tile">
          <span className="tile-value">
            {activity.data ? formatNumber(Math.round(activity.data.weekVolume)) : '–'}<small>kg</small>
          </span>
          <span className="tile-label">
            <strong>Volume soulevé</strong>
            <span>7 derniers jours, {activity.data?.weekSessions ?? 0} séance{(activity.data?.weekSessions ?? 0) > 1 ? 's' : ''}</span>
          </span>
        </Link>
        <Link to="/historique" className="tile wide">
          <span className="dots-head">
            <strong>Régularité</strong>
            <span className="muted small">{WEEKS} semaines</span>
          </span>
          <ActivityDots trainedDays={activity.data?.days ?? new Set()} weeks={WEEKS} />
        </Link>
      </section>

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

      <Dialog open={picker !== undefined} onClose={() => setPicker(undefined)} title="Démarrer une séance">
        {picker && userId && <StartSessionPicker key={picker.key} athleteId={userId} initial={picker.initial} />}
      </Dialog>
    </div>
  )
}
