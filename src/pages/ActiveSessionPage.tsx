import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/auth'
import { supabase, unwrap } from '../lib/supabase'
import { byId, useEquipment, useExercises, useGymExercises, useGyms } from '../lib/queries'
import { ACTIVE_SESSION_KEY, lastSessionSets, useActiveSession } from '../lib/sessions'
import type { PreviousSet } from '../lib/lastSession'
import { MUSCLE_LABELS, type Exercise, type Session, type SessionExerciseNote, type SessionSet, type WorkoutExercise } from '../lib/types'
import { decimalText, formatNumber, parseDecimal } from '../lib/numbers'
import { formatDuration, formatShortDate } from '../lib/dates'
import { groupByExercise } from '../lib/sessionSets'
import { machineLabel, matchesExercise } from '../lib/machines'
import { ConfirmDialog, Dialog } from '../components/Dialog'
import { StartSessionPicker } from '../components/StartSessionPicker'
import { Empty, ErrorMessage, Loading } from '../components/Feedback'
import { RestTimer } from '../components/RestTimer'
import { BarLoad } from '../components/BarLoad'
import { CollapseButton } from '../components/Icon'
import { useCollapsed } from '../lib/collapsed'
import { ProgressRing } from '../components/ProgressRing'
import { isBarbellExercise } from '../lib/plates'
import { readRestEnd, writeRestEnd } from '../lib/restStorage'
import { restsAfter, sessionSupersets, slotLabel } from '../lib/superset'
import { formatRpe, percentOf1RM, RPE_VALUES, rirFor } from '../lib/rpe'
import { SET_KIND_LABELS } from '../lib/setPlan'
import { dropAnchor, planDropSet, setLabels } from '../lib/dropSet'

export default function ActiveSessionPage() {
  const { profile } = useAuth()
  const active = useActiveSession(profile?.id)

  if (active.isPending) return <Loading />
  if (active.error) return <ErrorMessage error={active.error} />
  if (!active.data) {
    return (
      <div className="stack">
        <h1>Démarrer une séance</h1>
        {profile && <StartSessionPicker athleteId={profile.id} />}
      </div>
    )
  }
  return <SessionRunner session={active.data} />
}

function SessionRunner({ session }: { session: Session }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const exercises = useExercises()
  const gyms = useGyms()
  const equipment = useEquipment()
  const exerciseMap = byId(exercises.data)
  const equipmentMap = byId(equipment.data)
  const gym = gyms.data?.find((g) => g.id === session.gym_id)
  const [error, setError] = useState<unknown>(null)
  const [picking, setPicking] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [abandoning, setAbandoning] = useState(false)
  const [restEndsAt, setRestEndsAtState] = useState<number | null>(readRestEnd)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const setRestEndsAt = useCallback((value: number | null) => {
    writeRestEnd(value)
    setRestEndsAtState(value)
  }, [])

  const setsKey = ['session-sets', session.id]
  const sets = useQuery({
    queryKey: setsKey,
    queryFn: async () =>
      unwrap(
        await supabase.from('session_sets').select('*').eq('session_id', session.id)
          .order('exercise_position').order('set_number'),
      ) as SessionSet[],
  })

  // Consignes de la séance programmée, dans l'ordre des exercices
  const plan = useQuery({
    queryKey: ['session-plan', session.workout_id],
    enabled: Boolean(session.workout_id),
    queryFn: async () =>
      unwrap(await supabase.from('workout_exercises').select('exercise_id, position, notes, notes_visible')
        .eq('workout_id', session.workout_id!).order('position')) as Pick<WorkoutExercise, 'exercise_id' | 'position' | 'notes' | 'notes_visible'>[],
  })
  // Consignes par exercice (l'ordre peut changer pendant la séance)
  const planByExercise = useMemo(() => {
    const map = new Map<string, Pick<WorkoutExercise, 'notes' | 'notes_visible'>>()
    for (const p of plan.data ?? []) if (!map.has(p.exercise_id)) map.set(p.exercise_id, p)
    return map
  }, [plan.data])

  // Commentaires de l'athlète, par exercice de la séance
  const notesKey = ['session-notes', session.id]
  const notes = useQuery({
    queryKey: notesKey,
    queryFn: async () => new Map((unwrap(await supabase.from('session_exercise_notes').select('*')
      .eq('session_id', session.id)) as SessionExerciseNote[]).map((n) => [n.exercise_position, n.note])),
  })
  const [reordering, setReordering] = useState(false)
  const folded = useCollapsed(`praug:seance-repliee:${session.id}`, 'session')

  const exerciseIds = useMemo(
    () => [...new Set((sets.data ?? []).map((s) => s.exercise_id))],
    [sets.data],
  )
  const previous = useQuery({
    queryKey: ['last-session', session.athlete_id, exerciseIds],
    enabled: exerciseIds.length > 0,
    queryFn: () => lastSessionSets(session.athlete_id, exerciseIds),
  })

  const groups = useMemo(() => groupByExercise(sets.data ?? []), [sets.data])
  const supersets = useMemo(
    () => sessionSupersets(groups.map(([position, group]) => ({ position, group: group[0].superset_group }))),
    [groups],
  )

  function patchLocal(id: string, patch: Partial<SessionSet>) {
    queryClient.setQueryData<SessionSet[]>(setsKey, (old) => old?.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  async function updateSet(id: string, patch: Partial<SessionSet>) {
    patchLocal(id, patch)
    const { error } = await supabase.from('session_sets').update(patch).eq('id', id)
    if (error) {
      setError(error.message)
      await sets.refetch()
    }
  }

  async function toggleDone(set: SessionSet) {
    const done = !set.done
    await updateSet(set.id, { done, completed_at: done ? new Date().toISOString() : null })
    // Superset : on enchaîne l'exercice suivant sans repos
    if (done && set.rest_sec > 0 && restsAfter(supersets.get(set.exercise_position))) setRestEndsAt(Date.now() + set.rest_sec * 1000)
  }

  async function addSet(group: SessionSet[]) {
    const last = group.at(-1)!
    // La même série la dernière fois, si elle existe ; sinon on recopie la série précédente
    const before = previous.data?.get(last.exercise_id)?.sets[last.set_number]
    const { error } = await supabase.from('session_sets').insert({
      session_id: session.id,
      exercise_id: last.exercise_id,
      equipment_id: last.equipment_id,
      exercise_position: last.exercise_position,
      set_number: last.set_number + 1,
      reps: before?.reps ?? last.reps,
      weight_kg: before?.weight_kg ?? last.weight_kg,
      rest_sec: last.rest_sec,
      specialty: last.specialty,
      target_rpe: last.target_rpe,
      set_kind: last.set_kind === 'top' ? 'backoff' : last.set_kind,
      superset_group: last.superset_group,
    })
    if (error) setError(error.message)
    await sets.refetch()
  }

  async function removeSet(set: SessionSet) {
    const { error } = await supabase.from('session_sets').delete().eq('id', set.id)
    if (error) setError(error.message)
    await sets.refetch()
  }

  async function addDropSet(group: SessionSet[]) {
    const anchor = dropAnchor(group)
    if (!anchor) return
    const { renumber, chainEnd, drop } = planDropSet(group, anchor)
    // On enchaîne tout de suite : pas de repos avant le drop
    setRestEndsAt(null)
    const results = await Promise.all([
      ...renumber.map((r) => supabase.from('session_sets').update({ set_number: r.set_number }).eq('id', r.id)),
      supabase.from('session_sets').update({ rest_sec: 0 }).eq('id', chainEnd.id),
    ])
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      setError(failed.error.message)
      return sets.refetch()
    }
    const { error } = await supabase.from('session_sets').insert({
      session_id: session.id,
      exercise_id: chainEnd.exercise_id,
      equipment_id: chainEnd.equipment_id,
      exercise_position: chainEnd.exercise_position,
      specialty: chainEnd.specialty,
      superset_group: chainEnd.superset_group,
      set_kind: 'drop',
      ...drop,
    })
    if (error) setError(error.message)
    await sets.refetch()
  }

  async function moveExercise(index: number, delta: -1 | 1) {
    const a = groups[index]?.[0]
    const b = groups[index + delta]?.[0]
    if (a === undefined || b === undefined) return
    const { error } = await supabase.rpc('swap_session_exercises', { p_session: session.id, p_a: a, p_b: b })
    if (error) setError(error.message)
    await Promise.all([sets.refetch(), notes.refetch()])
  }

  async function saveNote(position: number, text: string) {
    const note = text.trim()
    const current = notes.data?.get(position) ?? ''
    if (note === current) return
    const { error } = note
      ? await supabase.from('session_exercise_notes').upsert({ session_id: session.id, exercise_position: position, note, updated_at: new Date().toISOString() })
      : await supabase.from('session_exercise_notes').delete().eq('session_id', session.id).eq('exercise_position', position)
    if (error) setError(error.message)
    await queryClient.invalidateQueries({ queryKey: notesKey })
  }

  async function addExercise(exercise: Exercise) {
    setPicking(false)
    const position = groups.length ? groups[groups.length - 1][0] + 1 : 0
    // On reprend les séries de la dernière fois (charges et répétitions), modifiables
    const before = (await lastSessionSets(session.athlete_id, [exercise.id])).get(exercise.id)?.sets
    const model = before?.length ? before : [{ reps: 10, weight_kg: 0 }]
    const { error } = await supabase.from('session_sets').insert(model.map((s, i) => ({
      session_id: session.id,
      exercise_id: exercise.id,
      exercise_position: position,
      set_number: i + 1,
      reps: s.reps,
      weight_kg: s.weight_kg,
      rest_sec: 90,
    })))
    if (error) setError(error.message)
    await sets.refetch()
  }

  async function finish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const rpe = Number(form.get('rpe'))
    const notes = String(form.get('notes') ?? '').trim()
    setError(null)
    // Les séries non cochées ne sont pas conservées
    const del = await supabase.from('session_sets').delete().eq('session_id', session.id).eq('done', false)
    if (del.error) return setError(del.error.message)
    const { error } = await supabase.from('sessions')
      .update({ ended_at: new Date().toISOString(), rpe, notes: notes || null })
      .eq('id', session.id)
    if (error) return setError(error.message)
    setRestEndsAt(null)
    await queryClient.invalidateQueries()
    navigate(`/historique/${session.id}`)
  }

  async function abandon() {
    setAbandoning(false)
    const { error } = await supabase.from('sessions').delete().eq('id', session.id)
    if (error) return setError(error.message)
    setRestEndsAt(null)
    await queryClient.invalidateQueries({ queryKey: ACTIVE_SESSION_KEY })
    navigate('/')
  }

  const doneCount = sets.data?.filter((s) => s.done).length ?? 0
  const total = sets.data?.length ?? 0

  return (
    <div className="stack-lg session-runner">
      <header className="page-head">
        <h1>{session.name}</h1>
        <p className="meta">
          <span>{gym ? gym.name : 'Aucune salle précise'}</span>
          <span>Commencée il y a {formatDuration(Date.parse(session.started_at), now)}</span>
        </p>
        <div className="session-progress">
          <ProgressRing value={doneCount} max={total} size={52} label={`${doneCount} séries faites sur ${total}`}>
            {doneCount}
          </ProgressRing>
          <output aria-live="polite">{doneCount} sur {total} séries</output>
        </div>
      </header>
      <ErrorMessage error={error} />

      {sets.isPending && <Loading />}
      {groups.length === 0 && !sets.isPending && <Empty>Ajoute un premier exercice pour commencer.</Empty>}
      {groups.length > 1 && (
        <div className="fold-all">
          <button type="button" className="link" onClick={() => setReordering(true)}>Changer l’ordre</button>
          <button type="button" className="link" onClick={() => folded.setAll(folded.count ? [] : groups.map(([p]) => String(p)))}>
            {folded.count ? 'Tout déplier' : 'Tout replier'}
          </button>
        </div>
      )}

      {groups.map(([position, group], index) => {
        const exercise = exerciseMap.get(group[0].exercise_id)
        const eq = group[0].equipment_id ? equipmentMap.get(group[0].equipment_id) : undefined
        const prev = previous.data?.get(group[0].exercise_id)
        const nextSet = group.find((s) => !s.done) ?? group.at(-1)!
        const headingId = `ex-${position}`
        const specialty = group[0].specialty
        const cardio = specialty === 'cardio'
        // RPE : cible et ressenti sur les exercices de force (ou dès qu'un RPE cible est fixé)
        const withRpe = specialty === 'force' || group.some((s) => s.target_rpe !== null)
        // Cible de la prochaine série à faire (elle peut changer d'une série à l'autre)
        const targetRpe = nextSet.target_rpe !== null ? Number(nextSet.target_rpe) : null
        const varied = group.some((s) => s.set_kind !== 'normal' || Number(s.target_rpe) !== Number(group[0].target_rpe))
        const targetPercent = targetRpe !== null ? percentOf1RM(nextSet.reps, targetRpe) : null
        const slot = supersets.get(position)
        const nextInSuperset = slot && slot.order < slot.size ? groups[index + 1] : undefined
        const collapsed = folded.isCollapsed(String(position))
        const bodyId = `ex-body-${position}`
        const doneHere = group.filter((s) => s.done).length
        const planned = planByExercise.get(group[0].exercise_id)
        const showNotes = planned?.notes_visible ?? true
        const labels = setLabels(group)
        const anchor = dropAnchor(group)
        const supersetClass = slot ? ` in-superset${slot.order === 1 ? ' superset-first' : ''}${slot.order === slot.size ? ' superset-last' : ''}` : ''
        return (
          <section key={position} className={`card exercise-block${supersetClass}${collapsed ? ' collapsed' : ''}`} aria-labelledby={headingId}>
            <div className="block-head">
              <h2 id={headingId}>
                <span className="station" aria-hidden="true">{slot ? slotLabel(slot) : String(index + 1).padStart(2, '0')}</span>
                {exercise?.name ?? 'Exercice'}
              </h2>
              {collapsed && <span className="muted small fold-summary">{doneHere} / {group.length} {cardio ? 'blocs' : 'séries'}</span>}
              <CollapseButton label={exercise?.name ?? 'l’exercice'} collapsed={collapsed} controls={bodyId} onToggle={() => folded.toggle(String(position))} />
            </div>
            <div id={bodyId} className="block-body" hidden={collapsed}>
            {slot && (
              <p className="superset-note">
                <span className="superset-tag">Superset {slot.letter}</span>
                {nextInSuperset
                  ? `Enchaîne avec ${exerciseMap.get(nextInSuperset[1][0].exercise_id)?.name ?? 'l’exercice suivant'}, sans repos`
                  : `Repos ${group[0].rest_sec} s après cette série, puis retour à ${exerciseMap.get(groups.find(([p]) => p === slot.group)?.[1][0].exercise_id ?? '')?.name ?? 'au premier exercice'}`}
              </p>
            )}
            <p className="muted small exercise-meta">
              {eq && <span>{machineLabel(eq)}</span>}
              <span>{prev?.sets.length
                ? `Dernière fois${prev.date ? ` (${formatShortDate(prev.date)})` : ''} : ${prev.sets.map((p) => `${formatNumber(p.weight_kg)} × ${p.reps}`).join(' · ')}`
                : 'Première fois sur cet exercice'}</span>
            </p>
            {showNotes && (planned?.notes || exercise?.description) && (
              <div className="coach-notes">
                <span className="coach-notes-label">Consignes</span>
                {planned?.notes && <p>{planned.notes}</p>}
                {exercise?.description && <p className="muted">{exercise.description}</p>}
              </div>
            )}
            {targetRpe !== null && (
              <p className="rpe-target">
                <span className="rpe-target-value">RPE {formatRpe(targetRpe)}</span>
                <span>{varied ? `cible de la série ${nextSet.set_number}` : 'cible'}, soit {formatRpe(rirFor(targetRpe))} rép. en réserve{targetPercent !== null ? ` · ${formatNumber(targetPercent)} % du 1RM` : ''}</span>
              </p>
            )}
            {!cardio && isBarbellExercise(exercise?.name) && <BarLoad weightKg={Number(nextSet.weight_kg)} />}
            <table className={withRpe ? 'sets-table with-rpe' : 'sets-table'}>
              <caption className="visually-hidden">Séries de {exercise?.name}</caption>
              <thead>
                <tr>
                  <th scope="col">Série</th>
                  <th scope="col">kg</th>
                  <th scope="col">{cardio ? 'Min' : 'Reps'}</th>
                  {withRpe && <th scope="col"><abbr title="RPE ressenti">RPE</abbr></th>}
                  <th scope="col">Faite</th>
                  <th scope="col"><span className="visually-hidden">Supprimer</span></th>
                </tr>
              </thead>
              <tbody>
                {group.map((set) => (
                  <SetRow key={set.id} set={set} exerciseName={exercise?.name ?? ''} cardio={cardio} withRpe={withRpe} showTarget={varied}
                    label={labels.get(set.id)!}
                    before={set.set_kind === 'drop' ? undefined : prev?.sets[labels.get(set.id)!.number - 1]}
                    onUpdate={(patch) => updateSet(set.id, patch)}
                    onToggle={() => toggleDone(set)}
                    onRemove={() => removeSet(set)} />
                ))}
              </tbody>
            </table>
            <div className="set-actions">
              <button type="button" className="add-set" onClick={() => addSet(group)}>+ Ajouter une série</button>
              {!cardio && anchor && (
                <button type="button" className="add-set" onClick={() => addDropSet(group)}>
                  + Drop set après la série {labels.get(anchor.id)!.number}
                </button>
              )}
            </div>
            <ExerciseNote key={`${position}:${notes.data?.get(position) ?? ''}`} exerciseName={exercise?.name ?? 'l’exercice'} position={position}
              note={notes.data?.get(position) ?? ''} onSave={(text) => saveNote(position, text)} />
            </div>
          </section>
        )
      })}

      <div className="session-actions">
        <button type="button" onClick={() => setPicking(true)}>+ Ajouter un exercice</button>
        <button type="button" className="primary cta" onClick={() => setFinishing(true)}>Terminer la séance</button>
        <div className="secondary-actions">
          <button type="button" className="danger-link" onClick={() => setAbandoning(true)}>Abandonner</button>
        </div>
      </div>

      <RestTimer endsAt={restEndsAt} onChange={setRestEndsAt} />

      <Dialog open={reordering} onClose={() => setReordering(false)} title="Ordre des exercices">
        <ol className="plain-list reorder-list">
          {groups.map(([position, group], index) => {
            const name = exerciseMap.get(group[0].exercise_id)?.name ?? 'Exercice'
            return (
              <li key={position}>
                <span className="station" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span className="reorder-name">{name}</span>
                <button type="button" className="icon-button" aria-label={`Monter ${name}`} disabled={index === 0} onClick={() => moveExercise(index, -1)}>↑</button>
                <button type="button" className="icon-button" aria-label={`Descendre ${name}`} disabled={index === groups.length - 1} onClick={() => moveExercise(index, 1)}>↓</button>
              </li>
            )
          })}
        </ol>
        <button type="button" className="primary" onClick={() => setReordering(false)}>Terminé</button>
      </Dialog>

      <Dialog open={picking} onClose={() => setPicking(false)} title="Ajouter un exercice">
        <ExercisePicker gymId={session.gym_id} onPick={addExercise} />
      </Dialog>

      <Dialog open={finishing} onClose={() => setFinishing(false)} title="Terminer la séance">
        <form onSubmit={finish} className="stack">
          <RpeField />
          <div className="field">
            <label htmlFor="notes">Notes (facultatif)</label>
            <textarea id="notes" name="notes" rows={3} />
          </div>
          {sets.data && doneCount < sets.data.length && (
            <p className="hint">Les {sets.data.length - doneCount} séries non cochées ne seront pas enregistrées.</p>
          )}
          <button type="submit" className="primary" autoFocus>Enregistrer la séance</button>
        </form>
      </Dialog>

      <ConfirmDialog open={abandoning} title="Abandonner la séance ?"
        message="La séance en cours et toutes ses séries seront supprimées."
        confirmLabel="Abandonner" onConfirm={abandon} onCancel={() => setAbandoning(false)} />
    </div>
  )
}

function RpeField() {
  const [value, setValue] = useState(7)
  return (
    <div className="field">
      <label htmlFor="rpe">Intensité ressentie (RPE) : <output htmlFor="rpe">{value}/10</output></label>
      <input id="rpe" name="rpe" type="range" min={1} max={10} step={1} value={value}
        onChange={(e) => setValue(Number(e.target.value))} aria-describedby="rpe-help" />
      <span id="rpe-help" className="hint">1 = très facile, 10 = effort maximal.</span>
    </div>
  )
}

interface SetRowProps {
  set: SessionSet
  exerciseName: string
  cardio: boolean
  /** Affiche la saisie du RPE ressenti */
  withRpe: boolean
  /** Les séries diffèrent : on affiche le type et le RPE cible de chacune */
  showTarget: boolean
  /** Numéro affiché ; un drop set porte le numéro de sa série */
  label: { number: number; drop: number | null }
  /** La même série lors de la dernière séance */
  before: PreviousSet | undefined
  onUpdate: (patch: Partial<SessionSet>) => void
  onToggle: () => void
  onRemove: () => void
}

const KIND_SHORT: Record<SessionSet['set_kind'], string> = { normal: '', warmup: 'Éch.', top: 'Top', backoff: 'B-off', drop: '' }

function SetRow({ set, exerciseName, cardio, withRpe, showTarget, label: shown, before, onUpdate, onToggle, onRemove }: SetRowProps) {
  // État local pour que la case réagisse immédiatement, avant la réponse du serveur
  const [done, setDone] = useState(set.done)
  const [syncedDone, setSyncedDone] = useState(set.done)
  if (set.done !== syncedDone) {
    setSyncedDone(set.done)
    setDone(set.done)
  }
  const label = shown.drop ? `${exerciseName}, drop set ${shown.drop} de la série ${shown.number}` : `${exerciseName}, série ${shown.number}`
  function commitWeight(input: HTMLInputElement) {
    const value = parseDecimal(input.value)
    if (value === null || value > 1000) {
      input.setCustomValidity('Saisis une charge valide, par exemple 62,5')
      input.reportValidity()
      return
    }
    input.setCustomValidity('')
    if (value !== Number(set.weight_kg)) onUpdate({ weight_kg: value })
  }
  function commitReps(input: HTMLInputElement) {
    const value = Number(input.value)
    if (!Number.isInteger(value) || value < 0 || value > 1000) {
      input.setCustomValidity('Saisis un nombre entier de répétitions')
      input.reportValidity()
      return
    }
    input.setCustomValidity('')
    if (value !== set.reps) onUpdate({ reps: value })
  }
  return (
    <tr className={[done && 'done', shown.drop && 'drop-row'].filter(Boolean).join(' ') || undefined}>
      <th scope="row">
        {shown.drop ? <span className="drop-label" title="Drop set : enchaîné sans repos, charge réduite"><span aria-hidden="true">↳ </span>Drop</span> : shown.number}
        {showTarget && !shown.drop && (
          <span className="set-target">
            {KIND_SHORT[set.set_kind] && <span title={SET_KIND_LABELS[set.set_kind]}>{KIND_SHORT[set.set_kind]}</span>}
            {set.target_rpe !== null && <span>@{formatRpe(Number(set.target_rpe))}</span>}
          </span>
        )}
      </th>
      <td>
        <input type="text" inputMode="decimal" enterKeyHint="next" aria-label={`Charge, ${label}`}
          defaultValue={decimalText(set.weight_kg)}
          onInput={(e) => e.currentTarget.setCustomValidity('')}
          onBlur={(e) => commitWeight(e.currentTarget)} />
        {before && !cardio && (
          <span className="set-before" title="La même série, la dernière fois">
            <span className="visually-hidden">La dernière fois : </span>{formatNumber(before.weight_kg)} × {before.reps}
          </span>
        )}
      </td>
      <td>
        <input type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" aria-label={`${cardio ? 'Minutes' : 'Répétitions'}, ${label}`}
          defaultValue={set.reps}
          onInput={(e) => e.currentTarget.setCustomValidity('')}
          onBlur={(e) => commitReps(e.currentTarget)} />
      </td>
      {withRpe && (
        <td>
          <select className="rpe-select" aria-label={`RPE ressenti, ${label}`}
            value={set.rpe !== null ? String(Number(set.rpe)) : ''}
            onChange={(e) => onUpdate({ rpe: e.target.value ? Number(e.target.value) : null })}>
            <option value="">–</option>
            {[5, 5.5, ...RPE_VALUES].map((r) => <option key={r} value={String(r)}>{formatRpe(r)}</option>)}
          </select>
        </td>
      )}
      <td>
        <label className="check">
          <input type="checkbox" checked={done} onChange={() => { setDone(!done); onToggle() }} />
          <span className="visually-hidden">Série faite, {label}</span>
        </label>
      </td>
      <td>
        <button type="button" className="icon-button" onClick={onRemove} aria-label={`Supprimer ${label}`}>
          <span aria-hidden="true">✕</span>
        </button>
      </td>
    </tr>
  )
}

function ExercisePicker({ gymId, onPick }: { gymId: string | null; onPick: (e: Exercise) => void }) {
  const available = useGymExercises(gymId)
  const [query, setQuery] = useState('')
  const normalized = query.trim().toLocaleLowerCase('fr')
  const list = (available.data ?? []).filter((e) => matchesExercise(e, normalized))
  return (
    <div className="stack">
      <search>
        <label htmlFor="ex-search">Rechercher un exercice ou un muscle</label>
        <input id="ex-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          autoComplete="off" autoCorrect="off" spellCheck={false} autoFocus />
      </search>
      <p className="hint">{gymId
        ? 'Exercices sans machine et exercices des machines de cette salle.'
        : 'Aucune salle choisie : seuls les exercices sans machine sont proposés.'}</p>
      {available.isPending && <Loading />}
      <ul className="plain-list picker-list">
        {list.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => onPick(e)}>
              <strong>{e.name}</strong>
              <span className="muted small">{MUSCLE_LABELS[e.muscle_group]}</span>
            </button>
          </li>
        ))}
      </ul>
      {!available.isPending && list.length === 0 && <Empty>Aucun exercice ne correspond.</Empty>}
    </div>
  )
}

function ExerciseNote({ exerciseName, position, note, onSave }: { exerciseName: string; position: number; note: string; onSave: (text: string) => void }) {
  const [open, setOpen] = useState(note !== '')
  const id = `note-${position}`
  if (!open) {
    return <button type="button" className="link add-note" onClick={() => setOpen(true)}>+ Ajouter un commentaire</button>
  }
  return (
    <div className="field exercise-note">
      <label htmlFor={id}>Commentaire (facultatif)</label>
      <textarea id={id} rows={2} defaultValue={note} maxLength={1000} autoFocus={note === ''}
        aria-label={`Commentaire (facultatif), ${exerciseName}`}
        placeholder="Ressenti, douleur, machine occupée…"
        onBlur={(e) => {
          onSave(e.currentTarget.value)
          if (!e.currentTarget.value.trim()) setOpen(false)
        }} />
    </div>
  )
}
