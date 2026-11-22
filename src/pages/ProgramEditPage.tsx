import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../lib/supabase'
import { byId, useEquipment, useExerciseEquipment, useGymExercises, useGyms, useProfiles } from '../lib/queries'
import { SPECIALTY_LABELS, type Program, type Specialty, type Workout, type WorkoutExercise } from '../lib/types'
import { formatKg, formatNumber, parseDecimal } from '../lib/numbers'
import { plannedRpeLoad, referenceMaxes, type ReferenceMax } from '../lib/oneRepMax'
import { formatRpe, RPE_VALUES, rirFor } from '../lib/rpe'
import { formatShortDate } from '../lib/dates'
import { brandsOf, machinesFor } from '../lib/machines'
import { describeSet, plannedSetLoad, plannedSets, rampRpe, SET_KIND_LABELS, SET_KINDS, type PlannedSet, type SetKind } from '../lib/setPlan'
import { RpeTable } from '../components/RpeTable'
import { ConfirmDialog, Dialog } from '../components/Dialog'
import { Empty, ErrorMessage, Loading } from '../components/Feedback'

interface ProgramData {
  program: Program
  workouts: (Workout & { exercises: WorkoutExercise[] })[]
}

export default function ProgramEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const profiles = useProfiles()
  const gyms = useGyms()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState('')
  const [addingWorkout, setAddingWorkout] = useState(false)
  const [editingExercise, setEditingExercise] = useState<{ workout: Workout; item: WorkoutExercise | null } | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; message: string; action: () => Promise<void> } | null>(null)
  const [duplicating, setDuplicating] = useState(false)

  const key = ['program', id]
  const data = useQuery({
    queryKey: key,
    queryFn: async (): Promise<ProgramData> => {
      const program = unwrap(await supabase.from('programs').select('*').eq('id', id!).single()) as Program
      const workouts = unwrap(await supabase.from('workouts').select('*, exercises:workout_exercises(*)')
        .eq('program_id', id!).order('position')) as ProgramData['workouts']
      for (const w of workouts) w.exercises.sort((a, b) => a.position - b.position)
      return { program, workouts }
    },
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  // 1RM de l'athlète à qui le programme est attribué, pour calculer les charges au RPE
  const athleteId = data.data?.program.athlete_id ?? null
  const maxes = useQuery({
    queryKey: ['reference-max', athleteId],
    enabled: Boolean(athleteId),
    queryFn: () => referenceMaxes(athleteId!),
  })

  async function check(result: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await result
    if (error) {
      setError(error.message)
      return false
    }
    setError(null)
    return true
  }

  if (data.isPending) return <Loading />
  if (data.error) return <ErrorMessage error={data.error} />
  const { program, workouts } = data.data

  async function saveProgram(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const ok = await check(supabase.from('programs').update({
      name: String(f.get('name')).trim(),
      description: String(f.get('description')).trim() || null,
      athlete_id: String(f.get('athlete')) || null,
      is_active: f.get('active') === 'on',
    }).eq('id', program.id))
    if (ok) {
      setSaved('Programme enregistré.')
      await queryClient.invalidateQueries({ queryKey: ['programs'] })
      await refresh()
    }
  }

  async function addWorkout(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const position = workouts.length ? Math.max(...workouts.map((w) => w.position)) + 1 : 0
    if (await check(supabase.from('workouts').insert({
      program_id: program.id, name: String(f.get('w_name')).trim(), gym_id: String(f.get('w_gym')) || null, position,
    }))) {
      setAddingWorkout(false)
      await refresh()
    }
  }

  async function swap<T extends { id: string; position: number }>(table: 'workouts' | 'workout_exercises', list: T[], index: number, delta: -1 | 1) {
    const order = [...list]
    const [moved] = order.splice(index, 1)
    order.splice(index + delta, 0, moved)
    const results = await Promise.all(order.map((item, i) =>
      item.position === i ? null : supabase.from(table).update({ position: i }).eq('id', item.id)))
    const failed = results.find((r) => r?.error)
    setError(failed?.error ? failed.error.message : null)
    await refresh()
  }

  async function duplicate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const { data: copy, error } = await supabase.from('programs').insert({
      name: String(f.get('copy_name')).trim(), description: program.description, athlete_id: String(f.get('copy_athlete')) || null,
    }).select().single()
    if (error) return setError(error.message)
    for (const w of workouts) {
      const { data: nw, error: we } = await supabase.from('workouts').insert({
        program_id: (copy as Program).id, name: w.name, position: w.position, gym_id: w.gym_id, notes: w.notes,
      }).select().single()
      if (we) return setError(we.message)
      if (w.exercises.length) {
        const { error: ee } = await supabase.from('workout_exercises').insert(w.exercises.map(({ id: _id, workout_id: _w, ...rest }) => ({ ...rest, workout_id: (nw as Workout).id })))
        if (ee) return setError(ee.message)
      }
    }
    setDuplicating(false)
    await queryClient.invalidateQueries({ queryKey: ['programs'] })
    navigate(`/programmes/${(copy as Program).id}`)
  }

  return (
    <div className="stack-lg" key={program.id}>
      <h1>{program.name}</h1>
      {error && <p role="alert" className="error">{error}</p>}
      <p role="status" className="success">{saved}</p>

      <form onSubmit={saveProgram} className="card stack" aria-labelledby="prog-info">
        <h2 id="prog-info">Paramètres</h2>
        <div className="field">
          <label htmlFor="name">Nom</label>
          <input id="name" name="name" defaultValue={program.name} required />
        </div>
        <div className="field">
          <label htmlFor="athlete">Athlète</label>
          <select id="athlete" name="athlete" defaultValue={program.athlete_id ?? ''}>
            <option value="">Personne (modèle)</option>
            {profiles.data?.map((p) => <option key={p.id} value={p.id}>{p.full_name || 'Sans nom'}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" rows={2} defaultValue={program.description ?? ''} />
        </div>
        <label className="check-row">
          <input type="checkbox" name="active" defaultChecked={program.is_active} />
          Programme actif (sert à suggérer la prochaine séance)
        </label>
        <div className="row wrap">
          <button type="submit" className="primary">Enregistrer</button>
          <button type="button" onClick={() => setDuplicating(true)}>Dupliquer</button>
          <button type="button" className="danger-link" onClick={() => setConfirm({
            title: 'Supprimer le programme ?', message: 'Le programme et ses séances seront supprimés. L’historique des athlètes est conservé.',
            action: async () => {
              if (await check(supabase.from('programs').delete().eq('id', program.id))) {
                await queryClient.invalidateQueries({ queryKey: ['programs'] })
                navigate('/programmes')
              }
            },
          })}>Supprimer</button>
        </div>
      </form>

      <section className="stack" aria-labelledby="workouts-title">
        <div className="row between wrap">
          <h2 id="workouts-title">Séances du programme</h2>
          <button type="button" className="primary" onClick={() => setAddingWorkout(true)}>+ Ajouter une séance</button>
        </div>
        <p className="hint">L’ordre des séances définit le cycle : après la dernière, on revient à la première.</p>
        {workouts.length === 0 && <Empty>Aucune séance. Ajoute par exemple « Push », « Pull » et « Legs ».</Empty>}
        <ol className="plain-list stack">
          {workouts.map((w, wi) => (
            <li key={w.id} className="card stack">
              <div className="row between wrap">
                <h3>{wi + 1}. {w.name}</h3>
                <div className="row">
                  <button type="button" className="icon-button" aria-label={`Monter ${w.name}`} disabled={wi === 0} onClick={() => swap('workouts', workouts, wi, -1)}>↑</button>
                  <button type="button" className="icon-button" aria-label={`Descendre ${w.name}`} disabled={wi === workouts.length - 1} onClick={() => swap('workouts', workouts, wi, 1)}>↓</button>
                  <button type="button" className="icon-button" aria-label={`Supprimer ${w.name}`} onClick={() => setConfirm({
                    title: 'Supprimer la séance ?', message: `« ${w.name} » et ses exercices seront supprimés du programme.`,
                    action: async () => { if (await check(supabase.from('workouts').delete().eq('id', w.id))) await refresh() },
                  })}>✕</button>
                </div>
              </div>
              <WorkoutGymField workout={w} gyms={gyms.data ?? []} onSaved={refresh} />
              {w.exercises.length === 0 ? <p className="muted small">Aucun exercice.</p> : (
                <ol className="plain-list exercise-plan">
                  {w.exercises.map((we, ei) => (
                    <PlanRow key={we.id} item={we} index={ei} count={w.exercises.length} max={maxes.data?.get(we.exercise_id)}
                      onEdit={() => setEditingExercise({ workout: w, item: we })}
                      onMove={(d) => swap('workout_exercises', w.exercises, ei, d)}
                      onDelete={async () => { if (await check(supabase.from('workout_exercises').delete().eq('id', we.id))) await refresh() }} />
                  ))}
                </ol>
              )}
              <button type="button" onClick={() => setEditingExercise({ workout: w, item: null })}>+ Ajouter un exercice</button>
            </li>
          ))}
        </ol>
      </section>

      <Dialog open={addingWorkout} onClose={() => setAddingWorkout(false)} title="Nouvelle séance">
        <form onSubmit={addWorkout} className="stack">
          <div className="field">
            <label htmlFor="w_name">Nom de la séance</label>
            <input id="w_name" name="w_name" required autoFocus placeholder="Push" />
          </div>
          <div className="field">
            <label htmlFor="w_gym">Salle (facultatif)</label>
            <select id="w_gym" name="w_gym" defaultValue="">
              <option value="">Toutes les salles</option>
              {gyms.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <button type="submit" className="primary">Ajouter</button>
        </form>
      </Dialog>

      <Dialog open={editingExercise !== null} onClose={() => setEditingExercise(null)}
        title={editingExercise?.item ? 'Modifier l’exercice' : `Ajouter à ${editingExercise?.workout.name ?? ''}`} lightDismiss={false}>
        {editingExercise && (
          <PlanForm workout={editingExercise.workout} item={editingExercise.item}
            assigned={Boolean(athleteId)} maxes={maxes.data}
            nextPosition={(workouts.find((w) => w.id === editingExercise.workout.id)?.exercises.length ?? 0)}
            onDone={async () => { setEditingExercise(null); await refresh() }} />
        )}
      </Dialog>

      <Dialog open={duplicating} onClose={() => setDuplicating(false)} title="Dupliquer le programme">
        <form onSubmit={duplicate} className="stack">
          <div className="field">
            <label htmlFor="copy_name">Nom de la copie</label>
            <input id="copy_name" name="copy_name" defaultValue={`${program.name} (copie)`} required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="copy_athlete">Attribuer à</label>
            <select id="copy_athlete" name="copy_athlete" defaultValue="">
              <option value="">Personne (modèle)</option>
              {profiles.data?.map((p) => <option key={p.id} value={p.id}>{p.full_name || 'Sans nom'}</option>)}
            </select>
          </div>
          <button type="submit" className="primary">Dupliquer</button>
        </form>
      </Dialog>

      <ConfirmDialog open={confirm !== null} title={confirm?.title ?? ''} message={confirm?.message ?? ''} confirmLabel="Supprimer"
        onConfirm={async () => { const c = confirm; setConfirm(null); await c?.action() }} onCancel={() => setConfirm(null)} />
    </div>
  )
}

function WorkoutGymField({ workout, gyms, onSaved }: { workout: Workout; gyms: { id: string; name: string }[]; onSaved: () => void }) {
  return (
    <div className="field inline">
      <label htmlFor={`gym-${workout.id}`}>Salle</label>
      <select id={`gym-${workout.id}`} defaultValue={workout.gym_id ?? ''}
        onChange={async (e) => {
          await supabase.from('workouts').update({ gym_id: e.target.value || null }).eq('id', workout.id)
          onSaved()
        }}>
        <option value="">Toutes les salles</option>
        {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
    </div>
  )
}

function PlanRow({ item, index, count, max, onEdit, onMove, onDelete }: {
  item: WorkoutExercise; index: number; count: number; max: ReferenceMax | undefined
  onEdit: () => void; onMove: (d: -1 | 1) => void; onDelete: () => void
}) {
  const exercises = byId(useGymExercises(null).data)
  const equipment = byId(useEquipment().data)
  const name = exercises.get(item.exercise_id)?.name ?? 'Exercice'
  const machine = item.equipment_id ? equipment.get(item.equipment_id) : undefined
  const machineText = machine ? `${machine.name}${machine.brand ? ` (${machine.brand})` : ''}` : item.equipment_brand ?? ''
  const sets = plannedSets(item)
  const varied = item.set_plan !== null
  const first = sets[0]
  const summary = varied
    ? `${sets.length} ${item.specialty === 'cardio' ? 'blocs' : 'séries'} réglées une par une`
    : `${item.target_sets} × ${describeSet(first, item.specialty, plannedSetLoad(first, item.specialty, max))}`
  return (
    <li className="row between wrap plan-row">
      <span className="item-text">
        <strong>{name}</strong>
        <span className="muted small">
          <span className={`specialty-tag ${item.specialty}`}>{SPECIALTY_LABELS[item.specialty]}</span>
          {summary}, repos {item.rest_sec} s
        </span>
        {machineText && <span className="muted small machine-line">{machineText}</span>}
        {varied && (
          <ol className="plan-sets small">
            {sets.map((set, i) => (
              <li key={i} className={set.kind}>
                {set.kind !== 'normal' && <span className="set-kind">{SET_KIND_LABELS[set.kind]}</span>}
                {describeSet(set, item.specialty, plannedSetLoad(set, item.specialty, max))}
              </li>
            ))}
          </ol>
        )}
      </span>
      <span className="row">
        <button type="button" className="icon-button" aria-label={`Monter ${name}`} disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
        <button type="button" className="icon-button" aria-label={`Descendre ${name}`} disabled={index === count - 1} onClick={() => onMove(1)}>↓</button>
        <button type="button" onClick={onEdit}>Modifier</button>
        <button type="button" className="icon-button" aria-label={`Retirer ${name}`} onClick={onDelete}>✕</button>
      </span>
    </li>
  )
}

const SPECIALTIES: Specialty[] = ['force', 'bodybuilding', 'cardio']

interface RowState { kind: SetKind; repMin: string; repMax: string; rpe: string; weight: string }

const kgText = (kg: number | null | undefined) => (kg == null ? '' : String(Number(kg)).replace('.', ','))
const toRow = (s: PlannedSet): RowState => ({
  kind: s.kind, repMin: String(s.rep_min), repMax: s.rep_max == null ? '' : String(s.rep_max),
  rpe: s.target_rpe == null ? '' : String(s.target_rpe), weight: kgText(s.target_weight_kg),
})

function PlanForm({ workout, item, nextPosition, assigned, maxes, onDone }: {
  workout: Workout; item: WorkoutExercise | null; nextPosition: number
  /** Le programme est attribué à un athlète */
  assigned: boolean
  maxes: Map<string, ReferenceMax> | undefined
  onDone: () => void
}) {
  const exercises = useGymExercises(workout.gym_id)
  const equipment = useEquipment()
  const links = useExerciseEquipment()
  const [exerciseId, setExerciseId] = useState(item?.exercise_id ?? '')
  const [specialty, setSpecialty] = useState<Specialty>(item?.specialty ?? 'bodybuilding')
  const [setCount, setSetCount] = useState(String(item?.target_sets ?? 3))
  const [repMin, setRepMin] = useState(String(item?.rep_min ?? 8))
  const [repMax, setRepMax] = useState(item?.rep_max != null ? String(item.rep_max) : '')
  const [rpe, setRpe] = useState(item?.target_rpe != null ? String(Number(item.target_rpe)) : '')
  const [weightText, setWeightText] = useState(kgText(item?.target_weight_kg))
  const [perSet, setPerSet] = useState(Boolean(item?.set_plan))
  const [rows, setRows] = useState<RowState[]>(() => (item?.set_plan ? plannedSets(item).map(toRow) : []))
  const [error, setError] = useState<string | null>(null)
  const cardio = specialty === 'cardio'
  const targetRpe = !cardio && rpe ? Number(rpe) : null
  const max = maxes?.get(exerciseId)
  const rpeLoad = targetRpe !== null ? plannedRpeLoad({ specialty, target_rpe: targetRpe, rep_min: Number(repMin) }, max) : null

  const gyms = useGyms()
  const [brand, setBrand] = useState(item?.equipment_brand ?? '')
  const [equipmentId, setEquipmentId] = useState(item?.equipment_id ?? '')
  const allEquipment = equipment.data ?? []
  const allLinks = links.data ?? []
  const exercise = exercises.data?.find((x) => x.id === exerciseId)
  // Machines de l'exercice dans la salle de la séance (toutes les salles si elle n'en a pas)
  const inGym = machinesFor(exerciseId, allEquipment, allLinks, { gymId: workout.gym_id })
  const machineOptions = machinesFor(exerciseId, allEquipment, allLinks, { gymId: workout.gym_id, brand })
  const showMachine = Boolean(exerciseId) && (exercise?.requires_equipment || inGym.length > 0
    || machinesFor(exerciseId, allEquipment, allLinks).length > 0 || Boolean(brand))
  const gymName = (id: string) => gyms.data?.find((g) => g.id === id)?.name ?? ''

  const commonRow = (): RowState => ({ kind: 'normal', repMin, repMax, rpe, weight: weightText })

  function resize(list: RowState[], count: number): RowState[] {
    if (!(count >= 1 && count <= 20)) return list
    if (list.length >= count) return list.slice(0, count)
    const model = list.at(-1) ?? commonRow()
    return [...list, ...Array.from({ length: count - list.length }, () => ({ ...model, kind: model.kind === 'top' ? 'backoff' as const : model.kind }))]
  }

  function togglePerSet(on: boolean) {
    setPerSet(on)
    // Première ouverture : chaque série reprend les valeurs communes
    if (on) setRows(resize(rows, Number(setCount)))
  }

  function changeCount(value: string) {
    setSetCount(value)
    if (perSet) setRows((list) => resize(list, Number(value)))
  }

  const patchRow = (index: number, patch: Partial<RowState>) =>
    setRows((list) => list.map((r, i) => (i === index ? { ...r, ...patch } : r)))

  function rampUp() {
    const ramped = rampRpe(rows.map((r) => ({ ...r, target_rpe: r.rpe ? Number(r.rpe) : null })))
    setRows(ramped.map(({ target_rpe, ...r }) => ({ ...r, rpe: target_rpe === null ? '' : String(target_rpe) })))
  }

  function topAndBackoff() {
    setRows((list) => list.map((r, i) => ({ ...r, kind: i === 0 ? 'top' : 'backoff' })))
  }

  function parseRow(r: RowState, index: number): PlannedSet | string {
    const min = Number(r.repMin)
    if (!Number.isInteger(min) || min < 1 || min > 100) return `Série ${index + 1} : nombre de ${cardio ? 'minutes' : 'répétitions'} invalide.`
    const maxReps = !cardio && r.repMax ? Number(r.repMax) : null
    if (maxReps !== null && !(maxReps >= min && maxReps <= 100)) return `Série ${index + 1} : le maximum de répétitions doit être supérieur au minimum.`
    const weight = !cardio && r.weight.trim() ? parseDecimal(r.weight) : null
    if (!cardio && r.weight.trim() && weight === null) return `Série ${index + 1} : charge invalide.`
    return { kind: r.kind, rep_min: min, rep_max: maxReps, target_rpe: !cardio && r.rpe ? Number(r.rpe) : null, target_weight_kg: weight }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    let plan: PlannedSet[] | null = null
    let first: PlannedSet
    if (perSet) {
      const parsed = rows.map(parseRow)
      const invalid = parsed.find((p): p is string => typeof p === 'string')
      if (invalid) return setError(invalid)
      plan = parsed as PlannedSet[]
      // Les champs communs reprennent la première série de travail (affichages résumés)
      first = plan.find((p) => p.kind !== 'warmup') ?? plan[0]
    } else {
      const parsed = parseRow(commonRow(), 0)
      if (typeof parsed === 'string') return setError(parsed.replace('Série 1 : ', ''))
      first = parsed
    }
    const values = {
      workout_id: workout.id,
      exercise_id: String(f.get('exercise')),
      equipment_id: showMachine && equipmentId ? equipmentId : null,
      equipment_brand: showMachine ? brand.trim() || null : null,
      specialty,
      target_sets: plan ? plan.length : Number(setCount),
      rep_min: first.rep_min,
      rep_max: first.rep_max,
      target_weight_kg: first.target_weight_kg,
      target_rpe: first.target_rpe,
      set_plan: plan,
      rest_sec: Number(f.get('rest')),
      notes: String(f.get('notes')).trim() || null,
    }
    const { error } = item
      ? await supabase.from('workout_exercises').update(values).eq('id', item.id)
      : await supabase.from('workout_exercises').insert({ ...values, position: nextPosition })
    if (error) return setError(error.message)
    onDone()
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <div className="field">
        <label htmlFor="pf-ex">Exercice</label>
        <select id="pf-ex" name="exercise" required value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} autoFocus>
          <option value="" disabled>Choisir…</option>
          {exercises.data?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        {workout.gym_id && <span className="hint">Liste limitée aux exercices disponibles dans la salle de cette séance.</span>}
      </div>
      {showMachine && (
        <fieldset className="stack-sm equipment-fields">
          <legend>Équipement</legend>
          <p className="hint">
            Salle : {workout.gym_id ? gymName(workout.gym_id) : 'toutes les salles'} (elle se règle sur la séance).
            Indique une marque, une machine précise, ou les deux.
          </p>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="pf-brand">Marque (facultatif)</label>
              <input id="pf-brand" list="pf-brands" value={brand} autoComplete="off" maxLength={60}
                onChange={(e) => {
                  const value = e.target.value
                  setBrand(value)
                  const current = allEquipment.find((eq) => eq.id === equipmentId)
                  if (current && value.trim() && current.brand?.toLocaleLowerCase('fr') !== value.trim().toLocaleLowerCase('fr')) setEquipmentId('')
                }} />
              <datalist id="pf-brands">
                {brandsOf(inGym.length ? inGym : allEquipment).map((b) => <option key={b} value={b} />)}
              </datalist>
            </div>
            <div className="field">
              <label htmlFor="pf-eq">Machine</label>
              <select id="pf-eq" value={equipmentId}
                onChange={(e) => {
                  setEquipmentId(e.target.value)
                  const picked = allEquipment.find((eq) => eq.id === e.target.value)
                  if (picked?.brand) setBrand(picked.brand)
                }}>
                <option value="">Indifférente</option>
                {machineOptions.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name}{eq.brand ? ` (${eq.brand})` : ''}{workout.gym_id ? '' : ` · ${gymName(eq.gym_id)}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {brand.trim() && machineOptions.length === 0 && (
            <p className="hint">Aucune machine {brand.trim()} enregistrée pour cet exercice{workout.gym_id ? ' dans cette salle' : ''} : la marque sera indiquée à l’athlète.</p>
          )}
        </fieldset>
      )}
      <fieldset className="segmented">
        <legend>Spécialité</legend>
        {SPECIALTIES.map((sp) => (
          <label key={sp}>
            <input type="radio" name="specialty" value={sp} checked={specialty === sp} onChange={() => setSpecialty(sp)} />
            {SPECIALTY_LABELS[sp]}
          </label>
        ))}
      </fieldset>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="pf-sets">{cardio ? 'Blocs' : 'Séries'}</label>
          <input id="pf-sets" name="sets" type="number" min={1} max={20} value={setCount} onChange={(e) => changeCount(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="pf-rest">Repos (s)</label>
          <input id="pf-rest" name="rest" type="number" min={0} max={900} step={15} defaultValue={item?.rest_sec ?? 90} required />
        </div>
        {!perSet && (
          <div className="field">
            <label htmlFor="pf-min">{cardio ? 'Minutes par bloc' : 'Répétitions min.'}</label>
            <input id="pf-min" name="rep_min" type="number" min={1} max={100} value={repMin}
              onChange={(e) => setRepMin(e.target.value)} required />
          </div>
        )}
        {!perSet && !cardio && (
          <div className="field">
            <label htmlFor="pf-max">Répétitions max. (facultatif)</label>
            <input id="pf-max" name="rep_max" type="number" min={1} max={100} value={repMax} onChange={(e) => setRepMax(e.target.value)} />
          </div>
        )}
      </div>
      <label className="check-row">
        <input type="checkbox" checked={perSet} onChange={(e) => togglePerSet(e.target.checked)} />
        Régler série par série
      </label>
      {perSet ? (
        <SetPlanEditor rows={rows} cardio={cardio} specialty={specialty} max={max} assigned={assigned}
          onPatch={patchRow} onRamp={rampUp} onTopBackoff={topAndBackoff} />
      ) : !cardio && (
        <>
          <div className="field">
            <label htmlFor="pf-rpe">RPE cible (facultatif)</label>
            <select id="pf-rpe" name="rpe" value={rpe} onChange={(e) => setRpe(e.target.value)} aria-describedby="pf-rpe-help">
              <option value="">Aucun</option>
              {RPE_VALUES.map((r) => (
                <option key={r} value={String(r)}>RPE {formatRpe(r)} · RIR {formatRpe(rirFor(r))}</option>
              ))}
            </select>
            <span id="pf-rpe-help" className="hint">RIR : répétitions encore possibles en fin de série (RIR = 10 − RPE).</span>
          </div>
          <div className="field">
            <label htmlFor="pf-weight">Charge cible en kg (facultatif)</label>
            <input id="pf-weight" name="weight" type="text" inputMode="decimal" value={weightText}
              onChange={(e) => setWeightText(e.target.value)} aria-describedby="pf-weight-help" />
            <span id="pf-weight-help" className="hint">
              {targetRpe === null
                ? 'Vide : on reprend la dernière charge de l’athlète.'
                : 'Vide : charge calculée au RPE à partir du 1RM de l’athlète.'}
            </span>
          </div>
          {targetRpe !== null && !weightText.trim() && (
            <RpeLoadPreview assigned={assigned} max={max} reps={Number(repMin)} rpe={targetRpe} load={rpeLoad} />
          )}
        </>
      )}
      {!cardio && (targetRpe !== null || perSet) && (
        <details className="rpe-details">
          <summary>Table RPE, RIR et % du 1RM</summary>
          <RpeTable reps={perSet ? undefined : Number(repMin)} rpe={perSet ? undefined : targetRpe} oneRepMaxKg={max?.kg} />
        </details>
      )}
      <div className="field">
        <label htmlFor="pf-notes">Consignes (facultatif)</label>
        <input id="pf-notes" name="notes" defaultValue={item?.notes ?? ''} />
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" className="primary">Enregistrer</button>
    </form>
  )
}

function SetPlanEditor({ rows, cardio, specialty, max, assigned, onPatch, onRamp, onTopBackoff }: {
  rows: RowState[]; cardio: boolean; specialty: Specialty; max: ReferenceMax | undefined; assigned: boolean
  onPatch: (index: number, patch: Partial<RowState>) => void; onRamp: () => void; onTopBackoff: () => void
}) {
  const usesRpe = rows.some((r) => r.rpe && !r.weight.trim())
  return (
    <fieldset className="set-plan stack">
      <legend>Séries une par une</legend>
      {!cardio && (
        <div className="row wrap">
          <button type="button" onClick={onRamp}>Montée en RPE (+0,5)</button>
          <button type="button" onClick={onTopBackoff}>Top set + back-off</button>
        </div>
      )}
      <ol className="plain-list set-plan-list">
        {rows.map((r, i) => {
          const n = i + 1
          const parsedWeight = r.weight.trim() ? parseDecimal(r.weight) : null
          const load = cardio ? null : plannedSetLoad({
            kind: r.kind, rep_min: Number(r.repMin), rep_max: null,
            target_rpe: r.rpe ? Number(r.rpe) : null, target_weight_kg: parsedWeight,
          }, specialty, max)
          return (
            <li key={i} className={`set-plan-row ${r.kind}`}>
              <div className="set-plan-head">
                <span className="set-plan-num" aria-hidden="true">{n}</span>
                <select aria-label={`Type, série ${n}`} value={r.kind} onChange={(e) => onPatch(i, { kind: e.target.value as SetKind })}>
                  {SET_KINDS.map((k) => <option key={k} value={k}>{SET_KIND_LABELS[k]}</option>)}
                </select>
                {load !== null && !r.weight.trim() && <span className="set-plan-load" aria-label={`Charge calculée, série ${n}`}>≈ {formatKg(load)}</span>}
              </div>
              <div className={cardio ? 'set-plan-fields cardio' : 'set-plan-fields'}>
                <label>
                  <span>{cardio ? 'Min' : 'Reps'}</span>
                  <input type="number" min={1} max={100} required value={r.repMin} aria-label={`${cardio ? 'Minutes' : 'Répétitions min.'}, série ${n}`}
                    onChange={(e) => onPatch(i, { repMin: e.target.value })} />
                </label>
                {!cardio && (
                  <>
                    <label>
                      <span>Max</span>
                      <input type="number" min={1} max={100} value={r.repMax} aria-label={`Répétitions max., série ${n}`}
                        onChange={(e) => onPatch(i, { repMax: e.target.value })} />
                    </label>
                    <label>
                      <span>RPE</span>
                      <select value={r.rpe} aria-label={`RPE cible, série ${n}`} onChange={(e) => onPatch(i, { rpe: e.target.value })}>
                        <option value="">–</option>
                        {RPE_VALUES.map((v) => <option key={v} value={String(v)}>{formatRpe(v)}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>kg</span>
                      <input type="text" inputMode="decimal" value={r.weight} aria-label={`Charge, série ${n}`}
                        onChange={(e) => onPatch(i, { weight: e.target.value })} />
                    </label>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {!cardio && (
        <p className="hint">
          kg vide : charge calculée au RPE depuis le 1RM, sinon la dernière charge de l’athlète.
          {usesRpe && !assigned && ' Programme non attribué : le calcul se fera avec le 1RM de l’athlète au démarrage.'}
          {usesRpe && assigned && !max && ' Aucun 1RM connu pour cet exercice.'}
        </p>
      )}
    </fieldset>
  )
}

function RpeLoadPreview({ assigned, max, reps, rpe, load }: {
  assigned: boolean; max: ReferenceMax | undefined; reps: number; rpe: number
  load: ReturnType<typeof plannedRpeLoad>
}) {
  let text: string
  if (!assigned) text = 'Programme non attribué : la charge sera calculée avec le 1RM de l’athlète au démarrage de la séance.'
  else if (!max) text = 'Aucun 1RM connu pour cet exercice : l’athlète reprendra sa dernière charge. Renseigne un 1RM dans son profil.'
  else if (!load) text = `La table couvre 1 à 12 répétitions : pas de calcul pour ${reps} répétitions.`
  else text = ''
  return (
    <div className="rpe-load" role="status">
      {load && max ? (
        <>
          <span className="rpe-load-kg">{formatKg(load.kg)}</span>
          <span className="small">
            {reps} rép. à RPE {formatRpe(rpe)} = {formatNumber(load.percent)} % du 1RM ({formatKg(max.kg)}, {max.source === 'test' ? 'testé' : 'estimé'} le {formatShortDate(max.date)}), arrondi à 2,5 kg
          </span>
        </>
      ) : <span className="small">{text}</span>}
    </div>
  )
}
