import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/auth'
import { supabase, unwrap } from '../lib/supabase'
import { byId, useExercises, useProfiles } from '../lib/queries'
import type { ExerciseProgress, Goal, OneRepMax, SessionSummary } from '../lib/types'
import { average, formatKg, formatNumber } from '../lib/numbers'
import { formatDuration, localDateOf } from '../lib/dates'
import { LineChartCard } from '../components/LineChartCard'
import { ErrorMessage, Loading } from '../components/Feedback'

type Metric = 'estimated_1rm_kg' | 'top_weight_kg' | 'volume_kg'
const METRICS: { value: Metric; label: string }[] = [
  { value: 'estimated_1rm_kg', label: '1RM estimé' },
  { value: 'top_weight_kg', label: 'Charge max' },
  { value: 'volume_kg', label: 'Volume' },
]

export default function StatsPage() {
  const { profile, isStaff } = useAuth()
  const [params, setParams] = useSearchParams()
  const athleteId = (isStaff && params.get('athlete')) || profile?.id
  const profiles = useProfiles(isStaff)
  const exercises = useExercises()
  const exerciseMap = byId(exercises.data)
  const queryClient = useQueryClient()
  const [metric, setMetric] = useState<Metric>('estimated_1rm_kg')
  const [now] = useState(() => Date.now())

  const data = useQuery({
    queryKey: ['stats', athleteId],
    enabled: Boolean(athleteId),
    queryFn: async () => {
      const [summaries, progress, favorites, goals, maxes] = await Promise.all([
        supabase.from('session_summaries').select('*').eq('athlete_id', athleteId!).order('started_at'),
        supabase.from('exercise_progress').select('*').eq('athlete_id', athleteId!).order('started_at'),
        supabase.from('favorite_exercises').select('exercise_id').eq('athlete_id', athleteId!),
        supabase.from('goals').select('*').eq('athlete_id', athleteId!),
        supabase.from('one_rep_maxes').select('*').eq('athlete_id', athleteId!).order('tested_on'),
      ])
      return {
        summaries: unwrap(summaries) as SessionSummary[],
        progress: unwrap(progress) as ExerciseProgress[],
        favorites: new Set((unwrap(favorites) as { exercise_id: string }[]).map((f) => f.exercise_id)),
        goals: unwrap(goals) as Goal[],
        maxes: unwrap(maxes) as OneRepMax[],
      }
    },
  })

  const trainedIds = useMemo(() => {
    const ids = [...new Set(data.data?.progress.map((p) => p.exercise_id) ?? [])]
    const fav = data.data?.favorites ?? new Set()
    return ids.sort((a, b) => Number(fav.has(b)) - Number(fav.has(a)) ||
      (exerciseMap.get(a)?.name ?? '').localeCompare(exerciseMap.get(b)?.name ?? '', 'fr'))
  }, [data.data, exerciseMap])

  const selectedId = params.get('exercice') ?? trainedIds[0] ?? ''

  async function toggleFavorite(exerciseId: string) {
    if (!athleteId || !data.data) return
    if (data.data.favorites.has(exerciseId)) {
      await supabase.from('favorite_exercises').delete().eq('athlete_id', athleteId).eq('exercise_id', exerciseId)
    } else {
      await supabase.from('favorite_exercises').insert({ athlete_id: athleteId, exercise_id: exerciseId })
    }
    await queryClient.invalidateQueries({ queryKey: ['stats', athleteId] })
  }

  if (data.isPending) return <Loading />
  if (data.error) return <ErrorMessage error={data.error} />
  const { summaries, progress, favorites, goals, maxes } = data.data

  const last30 = summaries.filter((s) => Date.parse(s.started_at) > now - 30 * 86_400_000)
  const avgDuration = average(summaries.map((s) => s.duration_sec))
  const avgRpe = average(summaries.flatMap((s) => (s.rpe ? [Number(s.rpe)] : [])))
  const avgVolume = average(summaries.map((s) => Number(s.volume_kg)))

  function bestFor(exerciseId: string) {
    const fromSessions = progress.filter((p) => p.exercise_id === exerciseId).map((p) => Number(p.estimated_1rm_kg ?? 0))
    const fromTests = maxes.filter((m) => m.exercise_id === exerciseId).map((m) => Number(m.weight_kg))
    return Math.max(0, ...fromSessions, ...fromTests)
  }

  const points = progress
    .filter((p) => p.exercise_id === selectedId && p[metric] !== null)
    .map((p) => ({ date: localDateOf(p.started_at), value: Number(p[metric]) }))
  const goal = goals.find((g) => g.exercise_id === selectedId && !g.achieved_at)
  const featured = [...favorites].filter((id) => exerciseMap.has(id))
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    next.set(key, value)
    setParams(next, { replace: true })
  }

  return (
    <div className="stack-lg">
      <h1>Statistiques</h1>
      {isStaff && profiles.data && (
        <div className="field">
          <label htmlFor="athlete">Athlète</label>
          <select id="athlete" value={athleteId} onChange={(e) => setParams({ athlete: e.target.value })}>
            {profiles.data.map((p) => <option key={p.id} value={p.id}>{p.full_name || 'Sans nom'}</option>)}
          </select>
        </div>
      )}

      <section aria-labelledby="kpi-title">
        <h2 id="kpi-title" className="visually-hidden">Indicateurs</h2>
        <dl className="kpis">
          <div className="kpi"><dt>Séances (30 j)</dt><dd>{last30.length}</dd></div>
          <div className="kpi"><dt>Durée moyenne</dt><dd>{avgDuration === null ? '–' : formatDuration(0, avgDuration * 1000)}</dd></div>
          <div className="kpi"><dt>Intensité moyenne</dt><dd>{avgRpe === null ? '–' : `RPE ${formatNumber(avgRpe)}`}</dd></div>
          <div className="kpi"><dt>Volume moyen</dt><dd>{avgVolume === null ? '–' : formatKg(avgVolume)}</dd></div>
        </dl>
      </section>

      {featured.length > 0 && (
        <section aria-labelledby="fav-title" className="stack">
          <h2 id="fav-title">Exercices mis en avant</h2>
          <ul className="plain-list featured">
            {featured.map((id) => {
              const best = bestFor(id)
              const g = goals.find((x) => x.exercise_id === id && !x.achieved_at)
              const pct = g ? Math.min(100, Math.round((best / Number(g.target_1rm_kg)) * 100)) : null
              return (
                <li key={id} className="card">
                  <button type="button" className="link" onClick={() => setParam('exercice', id)}>
                    <strong>{exerciseMap.get(id)!.name}</strong>
                  </button>
                  <p className="lead">{best > 0 ? formatKg(best) : '–'} <span className="muted small">1RM</span></p>
                  {g && pct !== null && (
                    <>
                      <label className="small" htmlFor={`goal-${id}`}>Objectif {formatKg(Number(g.target_1rm_kg))} : {pct} %</label>
                      <progress id={`goal-${id}`} max={100} value={pct}>{pct} %</progress>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="prog-title" className="card stack">
        <h2 id="prog-title">Progression par exercice</h2>
        {trainedIds.length === 0 ? (
          <p className="muted">Termine une séance pour voir ta progression.</p>
        ) : (
          <>
            <div className="row wrap">
              <div className="field grow">
                <label htmlFor="exercise">Exercice</label>
                <select id="exercise" value={selectedId} onChange={(e) => setParam('exercice', e.target.value)}>
                  {trainedIds.map((id) => (
                    <option key={id} value={id}>{favorites.has(id) ? '★ ' : ''}{exerciseMap.get(id)?.name}</option>
                  ))}
                </select>
              </div>
              <button type="button" aria-pressed={favorites.has(selectedId)} onClick={() => toggleFavorite(selectedId)}>
                {favorites.has(selectedId) ? '★ Mis en avant' : '☆ Mettre en avant'}
              </button>
            </div>
            <fieldset className="segmented">
              <legend>Mesure</legend>
              {METRICS.map((m) => (
                <label key={m.value}>
                  <input type="radio" name="metric" value={m.value} checked={metric === m.value} onChange={() => setMetric(m.value)} />
                  {m.label}
                </label>
              ))}
            </fieldset>
            <LineChartCard
              title={METRICS.find((m) => m.value === metric)!.label}
              unit="kg"
              points={points}
              target={goal && metric === 'estimated_1rm_kg' ? { value: Number(goal.target_1rm_kg), label: `Objectif ${formatNumber(Number(goal.target_1rm_kg))} kg` } : undefined}
            />
          </>
        )}
      </section>
    </div>
  )
}
