import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/auth'
import { supabase, unwrap } from '../lib/supabase'
import { byId, useExercises, useProfiles } from '../lib/queries'
import { ROLE_LABELS, type BodyWeight, type Goal, type OneRepMax, type Profile } from '../lib/types'
import { formatKg, formatNumber, parseDecimal } from '../lib/numbers'
import { formatLongDate, formatShortDateYear, todayISO } from '../lib/dates'
import { LineChartCard } from '../components/LineChartCard'
import { ErrorMessage, Loading } from '../components/Feedback'

export default function ProfilePage() {
  const { profile: me, isStaff, refreshProfile } = useAuth()
  const [params, setParams] = useSearchParams()
  const athleteId = (isStaff && params.get('athlete')) || me?.id
  const profiles = useProfiles(isStaff)
  const exercises = useExercises()
  const exerciseMap = byId(exercises.data)
  const queryClient = useQueryClient()
  const [error, setError] = useState<unknown>(null)
  const [saved, setSaved] = useState('')

  const data = useQuery({
    queryKey: ['athlete-profile', athleteId],
    enabled: Boolean(athleteId),
    queryFn: async () => {
      const [p, weights, maxes, goals] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', athleteId!).single(),
        supabase.from('body_weights').select('*').eq('athlete_id', athleteId!).order('measured_on'),
        supabase.from('one_rep_maxes').select('*').eq('athlete_id', athleteId!).order('tested_on', { ascending: false }),
        supabase.from('goals').select('*').eq('athlete_id', athleteId!).order('created_at'),
      ])
      return {
        profile: unwrap(p) as Profile,
        weights: unwrap(weights) as BodyWeight[],
        maxes: unwrap(maxes) as OneRepMax[],
        goals: unwrap(goals) as Goal[],
      }
    },
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['athlete-profile', athleteId] })

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>, message: string, form?: HTMLFormElement) {
    setError(null)
    setSaved('')
    const { error } = await action()
    if (error) {
      setError(error.message.includes('duplicate') ? 'Une mesure existe déjà pour cette date.' : error.message)
      return
    }
    form?.reset()
    setSaved(message)
    await refresh()
    await queryClient.invalidateQueries({ queryKey: ['stats', athleteId] })
  }

  if (data.isPending) return <Loading />
  if (data.error) return <ErrorMessage error={data.error} />
  const { profile, weights, maxes, goals } = data.data
  // Dernier 1RM par exercice (la liste arrive du plus récent au plus ancien), et le test d'avant pour comparer
  const maxesByExercise = new Map<string, OneRepMax[]>()
  for (const m of maxes) maxesByExercise.set(m.exercise_id, [...(maxesByExercise.get(m.exercise_id) ?? []), m])
  const latestMaxes = [...maxesByExercise.values()]
    .map(([latest, previous]) => ({ latest, previous }))
    .sort((a, b) => (exerciseMap.get(a.latest.exercise_id)?.name ?? '').localeCompare(exerciseMap.get(b.latest.exercise_id)?.name ?? '', 'fr'))
  const isMe = profile.id === me?.id

  function onProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const height = parseDecimal(String(f.get('height')))
    run(() => supabase.from('profiles').update({
      full_name: String(f.get('full_name')).trim(),
      birth_date: String(f.get('birth_date')) || null,
      height_cm: height,
    }).eq('id', profile.id), 'Profil enregistré.').then(() => isMe && refreshProfile())
  }

  function onWeight(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const weight = parseDecimal(String(f.get('weight')))
    const input = form.elements.namedItem('weight') as HTMLInputElement
    if (weight === null || weight < 20 || weight > 400) {
      input.setCustomValidity('Saisis un poids entre 20 et 400 kg, par exemple 78,4')
      input.reportValidity()
      return
    }
    run(() => supabase.from('body_weights').insert({ athlete_id: profile.id, weight_kg: weight, measured_on: String(f.get('date')) }), 'Poids enregistré.', form)
  }

  function onMax(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const weight = parseDecimal(String(f.get('max_weight')))
    const input = form.elements.namedItem('max_weight') as HTMLInputElement
    if (weight === null || weight <= 0) {
      input.setCustomValidity('Saisis une charge valide')
      input.reportValidity()
      return
    }
    run(() => supabase.from('one_rep_maxes').insert({
      athlete_id: profile.id, exercise_id: String(f.get('max_exercise')), weight_kg: weight, tested_on: String(f.get('max_date')),
    }), '1RM enregistré.', form)
  }

  function onGoal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const weight = parseDecimal(String(f.get('goal_weight')))
    const input = form.elements.namedItem('goal_weight') as HTMLInputElement
    if (weight === null || weight <= 0) {
      input.setCustomValidity('Saisis une charge valide')
      input.reportValidity()
      return
    }
    run(() => supabase.from('goals').insert({
      athlete_id: profile.id, exercise_id: String(f.get('goal_exercise')), target_1rm_kg: weight,
      target_date: String(f.get('goal_date')) || null,
    }), 'Objectif ajouté.', form)
  }

  const clearValidity = (e: FormEvent<HTMLInputElement>) => e.currentTarget.setCustomValidity('')
  const exerciseOptions = exercises.data?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)
  const today = todayISO()

  return (
    <div className="stack-lg" key={profile.id}>
      <h1>{isMe ? 'Mon profil' : `Profil de ${profile.full_name}`}</h1>
      {isStaff && profiles.data && (
        <div className="field">
          <label htmlFor="athlete">Athlète</label>
          <select id="athlete" value={athleteId} onChange={(e) => setParams({ athlete: e.target.value })}>
            {profiles.data.map((p) => <option key={p.id} value={p.id}>{p.full_name || 'Sans nom'}</option>)}
          </select>
        </div>
      )}
      <ErrorMessage error={error} />
      <p role="status" className="success">{saved}</p>

      <form onSubmit={onProfile} className="card stack" aria-labelledby="info-title">
        <h2 id="info-title">Informations</h2>
        <p className="muted small">Rôle : {ROLE_LABELS[profile.role]}</p>
        <div className="field">
          <label htmlFor="full_name">Nom</label>
          <input id="full_name" name="full_name" defaultValue={profile.full_name} autoComplete="name" required />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="birth_date">Date de naissance</label>
            <input id="birth_date" name="birth_date" type="date" defaultValue={profile.birth_date ?? ''} max={today} />
          </div>
          <div className="field">
            <label htmlFor="height">Taille (cm)</label>
            <input id="height" name="height" type="text" inputMode="decimal" defaultValue={profile.height_cm ?? ''} />
          </div>
        </div>
        <button type="submit" className="primary">Enregistrer</button>
      </form>

      <section className="card stack" aria-labelledby="weight-title">
        <h2 id="weight-title">Évolution du poids</h2>
        <LineChartCard title="Poids de corps" unit="kg" points={weights.map((w) => ({ date: w.measured_on, value: Number(w.weight_kg) }))} />
        <form onSubmit={onWeight} className="inline-form" aria-label="Ajouter une pesée">
          <div className="field">
            <label htmlFor="weight">Poids (kg)</label>
            <input id="weight" name="weight" type="text" inputMode="decimal" required onInput={clearValidity} />
          </div>
          <div className="field">
            <label htmlFor="date">Date</label>
            <input id="date" name="date" type="date" defaultValue={today} max={today} required />
          </div>
          <button type="submit">Ajouter</button>
        </form>
      </section>

      <section className="card stack" aria-labelledby="max-title">
        <h2 id="max-title">Mes 1RM</h2>
        {maxes.length === 0 ? <p className="muted">Aucun 1RM renseigné.</p> : (
          <ul className="max-list">
            {latestMaxes.map(({ latest, previous }) => (
              <li key={latest.exercise_id} className="max-row">
                <div className="max-info">
                  <span className="max-name">{exerciseMap.get(latest.exercise_id)?.name}</span>
                  <span className="muted small">
                    {formatShortDateYear(latest.tested_on)}
                    {previous && <> · avant : {formatKg(Number(previous.weight_kg))}</>}
                  </span>
                </div>
                <span className="max-load">
                  {formatNumber(Number(latest.weight_kg))}<span className="max-unit">kg</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={onMax} className="inline-form" aria-label="Ajouter un 1RM">
          <div className="field span-all">
            <label htmlFor="max_exercise">Exercice</label>
            <select id="max_exercise" name="max_exercise" required>{exerciseOptions}</select>
          </div>
          <div className="field">
            <label htmlFor="max_weight">Charge (kg)</label>
            <input id="max_weight" name="max_weight" type="text" inputMode="decimal" required onInput={clearValidity} />
          </div>
          <div className="field">
            <label htmlFor="max_date">Date du test</label>
            <input id="max_date" name="max_date" type="date" defaultValue={today} max={today} required />
          </div>
          <button type="submit">Ajouter</button>
        </form>
      </section>

      <section className="card stack" aria-labelledby="goal-title">
        <h2 id="goal-title">Objectifs par mouvement</h2>
        {goals.length === 0 ? <p className="muted">Aucun objectif. Exemple : squat à 150 kg en 1RM.</p> : (
          <ul className="plain-list stack">
            {goals.map((g) => (
              <li key={g.id} className="goal-row">
                <span>
                  <strong>{exerciseMap.get(g.exercise_id)?.name}</strong> : {formatKg(Number(g.target_1rm_kg))} (1RM)
                  {g.target_date && <span className="muted small">, avant le {formatLongDate(g.target_date)}</span>}
                  {g.achieved_at && <span className="badge">✓ Atteint</span>}
                </span>
                <span className="row wrap">
                  {!g.achieved_at && (
                    <button type="button" onClick={() => run(() => supabase.from('goals').update({ achieved_at: today }).eq('id', g.id), 'Bravo, objectif atteint !')}>
                      Marquer atteint
                    </button>
                  )}
                  <button type="button" className="danger-link" onClick={() => run(() => supabase.from('goals').delete().eq('id', g.id), 'Objectif supprimé.')}>
                    Supprimer
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={onGoal} className="inline-form" aria-label="Ajouter un objectif">
          <div className="field span-all">
            <label htmlFor="goal_exercise">Exercice</label>
            <select id="goal_exercise" name="goal_exercise" required>{exerciseOptions}</select>
          </div>
          <div className="field">
            <label htmlFor="goal_weight">1RM visé (kg)</label>
            <input id="goal_weight" name="goal_weight" type="text" inputMode="decimal" required onInput={clearValidity} />
          </div>
          <div className="field">
            <label htmlFor="goal_date">Échéance (facultatif)</label>
            <input id="goal_date" name="goal_date" type="date" min={today} />
          </div>
          <button type="submit">Ajouter</button>
        </form>
      </section>

      {isMe && (
        <button type="button" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
      )}
    </div>
  )
}
