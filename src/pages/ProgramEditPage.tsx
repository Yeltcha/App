import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../lib/supabase'
import { byId, useEquipment, useExerciseEquipment, useGymExercises, useGyms, useProfiles } from '../lib/queries'
import type { Program, Workout, WorkoutExercise } from '../lib/types'
import { parseDecimal } from '../lib/numbers'
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
                    <PlanRow key={we.id} item={we} index={ei} count={w.exercises.length}
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

function PlanRow({ item, index, count, onEdit, onMove, onDelete }: {
  item: WorkoutExercise; index: number; count: number
  onEdit: () => void; onMove: (d: -1 | 1) => void; onDelete: () => void
}) {
  const exercises = byId(useGymExercises(null).data)
  const name = exercises.get(item.exercise_id)?.name ?? 'Exercice'
  const reps = item.rep_max ? `${item.rep_min}–${item.rep_max}` : `${item.rep_min}`
  return (
    <li className="row between wrap plan-row">
      <span>
        <strong>{name}</strong>
        <span className="muted small"> · {item.target_sets} × {reps}{item.target_weight_kg ? ` @ ${String(item.target_weight_kg).replace('.', ',')} kg` : ''} · repos {item.rest_sec} s</span>
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

function PlanForm({ workout, item, nextPosition, onDone }: {
  workout: Workout; item: WorkoutExercise | null; nextPosition: number; onDone: () => void
}) {
  const exercises = useGymExercises(workout.gym_id)
  const equipment = useEquipment()
  const links = useExerciseEquipment()
  const [exerciseId, setExerciseId] = useState(item?.exercise_id ?? '')
  const [error, setError] = useState<string | null>(null)

  const linkedEquipment = (equipment.data ?? []).filter((eq) =>
    links.data?.some((l) => l.exercise_id === exerciseId && l.equipment_id === eq.id) &&
    (!workout.gym_id || eq.gym_id === workout.gym_id))

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const repMin = Number(f.get('rep_min'))
    const repMaxRaw = String(f.get('rep_max'))
    const weightRaw = String(f.get('weight'))
    const weight = weightRaw ? parseDecimal(weightRaw) : null
    if (weightRaw && weight === null) return setError('Charge invalide.')
    const values = {
      workout_id: workout.id,
      exercise_id: String(f.get('exercise')),
      equipment_id: String(f.get('equipment') ?? '') || null,
      target_sets: Number(f.get('sets')),
      rep_min: repMin,
      rep_max: repMaxRaw ? Number(repMaxRaw) : null,
      target_weight_kg: weight,
      rest_sec: Number(f.get('rest')),
      notes: String(f.get('notes')).trim() || null,
    }
    if (values.rep_max !== null && values.rep_max < repMin) return setError('Le maximum de répétitions doit être supérieur au minimum.')
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
      {linkedEquipment.length > 0 && (
        <div className="field">
          <label htmlFor="pf-eq">Machine</label>
          <select id="pf-eq" name="equipment" defaultValue={item?.equipment_id ?? ''}>
            <option value="">Indifférent</option>
            {linkedEquipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name}{eq.brand ? ` (${eq.brand})` : ''}</option>)}
          </select>
        </div>
      )}
      <div className="grid-2">
        <div className="field">
          <label htmlFor="pf-sets">Séries</label>
          <input id="pf-sets" name="sets" type="number" min={1} max={20} defaultValue={item?.target_sets ?? 3} required />
        </div>
        <div className="field">
          <label htmlFor="pf-rest">Repos (s)</label>
          <input id="pf-rest" name="rest" type="number" min={0} max={900} step={15} defaultValue={item?.rest_sec ?? 90} required />
        </div>
        <div className="field">
          <label htmlFor="pf-min">Répétitions min.</label>
          <input id="pf-min" name="rep_min" type="number" min={1} max={100} defaultValue={item?.rep_min ?? 8} required />
        </div>
        <div className="field">
          <label htmlFor="pf-max">Répétitions max. (facultatif)</label>
          <input id="pf-max" name="rep_max" type="number" min={1} max={100} defaultValue={item?.rep_max ?? ''} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="pf-weight">Charge cible en kg (facultatif)</label>
        <input id="pf-weight" name="weight" type="text" inputMode="decimal" defaultValue={item?.target_weight_kg ?? ''} aria-describedby="pf-weight-help" />
        <span id="pf-weight-help" className="hint">Vide : on reprend la dernière charge de l’athlète.</span>
      </div>
      <div className="field">
        <label htmlFor="pf-notes">Consignes (facultatif)</label>
        <input id="pf-notes" name="notes" defaultValue={item?.notes ?? ''} />
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" className="primary">Enregistrer</button>
    </form>
  )
}
