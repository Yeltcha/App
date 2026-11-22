import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { byId, useEquipment, useExerciseEquipment, useExercises, useGyms } from '../lib/queries'
import { machinesFor } from '../lib/machines'
import {
  EQUIPMENT_LABELS, MUSCLE_LABELS,
  type Equipment, type EquipmentKind, type Exercise, type Gym, type MuscleGroup,
} from '../lib/types'
import { ConfirmDialog, Dialog } from '../components/Dialog'
import { Empty, ErrorMessage, Loading } from '../components/Feedback'

type Tab = 'exercices' | 'salles'

function friendlyError(message: string) {
  if (message.includes('violates foreign key')) return 'Impossible : cet élément est utilisé dans des séances ou des programmes.'
  if (message.includes('duplicate key')) return 'Un exercice porte déjà ce nom.'
  return message
}

export default function LibraryPage() {
  const [tab, setTab] = useState<Tab>('exercices')
  return (
    <div className="stack-lg">
      <h1>Bibliothèque</h1>
      <div className="segmented" role="group" aria-label="Section">
        <button type="button" aria-pressed={tab === 'exercices'} onClick={() => setTab('exercices')}>Exercices</button>
        <button type="button" aria-pressed={tab === 'salles'} onClick={() => setTab('salles')}>Salles et machines</button>
      </div>
      {tab === 'exercices' ? <ExercisesSection /> : <GymsSection />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Exercices
// ---------------------------------------------------------------------------

function ExercisesSection() {
  const exercises = useExercises()
  const equipment = useEquipment()
  const links = useExerciseEquipment()
  const gyms = byId(useGyms().data)
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Exercise | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [filter, setFilter] = useState('')
  const queryClient = useQueryClient()

  const q = filter.trim().toLocaleLowerCase('fr')
  const list = (exercises.data ?? []).filter(
    (e) => !q || e.name.toLocaleLowerCase('fr').includes(q) || MUSCLE_LABELS[e.muscle_group].toLocaleLowerCase('fr').includes(q),
  )

  async function remove(ex: Exercise) {
    setDeleting(null)
    const { error } = await supabase.from('exercises').delete().eq('id', ex.id)
    if (error) return setError(friendlyError(error.message))
    await queryClient.invalidateQueries()
  }

  return (
    <section className="stack" aria-label="Exercices">
      <div className="row wrap between">
        <search className="grow">
          <label htmlFor="lib-search" className="visually-hidden">Rechercher un exercice</label>
          <input id="lib-search" type="search" placeholder="Rechercher…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </search>
        <button type="button" className="primary" onClick={() => setEditing('new')}>+ Nouvel exercice</button>
      </div>
      <ErrorMessage error={error} />
      {exercises.isPending && <Loading />}
      {exercises.data?.length === 0 && <Empty>La bibliothèque est vide. Ajoute ton premier exercice.</Empty>}
      <ul className="plain-list stack">
        {list.map((ex) => (
          <li key={ex.id} className="card row between wrap">
            <span className="item-text">
              <strong>{ex.name}</strong>
              <span className="muted small">{MUSCLE_LABELS[ex.muscle_group]}{ex.requires_equipment ? ', machine requise' : ''}</span>
              <MachineList machines={machinesFor(ex.id, equipment.data ?? [], links.data ?? [])} gymName={(id) => gyms.get(id)?.name ?? ''} />
            </span>
            <span className="row">
              <button type="button" onClick={() => setEditing(ex)}>Modifier</button>
              <button type="button" className="danger-link" onClick={() => setDeleting(ex)}>Supprimer</button>
            </span>
          </li>
        ))}
      </ul>
      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nouvel exercice' : 'Modifier l’exercice'} lightDismiss={false}>
        {editing !== null && <ExerciseForm exercise={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      </Dialog>
      <ConfirmDialog open={deleting !== null} title="Supprimer l’exercice ?" message={`« ${deleting?.name} » sera retiré de la bibliothèque.`}
        confirmLabel="Supprimer" onConfirm={() => deleting && remove(deleting)} onCancel={() => setDeleting(null)} />
    </section>
  )
}

/** Machines d'un exercice : nom, marque et salle. */
function MachineList({ machines, gymName }: { machines: Equipment[]; gymName: (id: string) => string }) {
  if (machines.length === 0) return null
  return (
    <ul className="plain-list machine-list" aria-label="Machines associées">
      {machines.map((eq) => (
        <li key={eq.id}>
          <span className="machine-brand">{eq.brand ?? 'Sans marque'}</span>
          <span>{eq.name}</span>
          <span className="muted">{gymName(eq.gym_id)}</span>
        </li>
      ))}
    </ul>
  )
}

function ExerciseForm({ exercise, onDone }: { exercise: Exercise | null; onDone: () => void }) {
  const gyms = useGyms()
  const equipment = useEquipment()
  const links = useExerciseEquipment()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [requiresEquipment, setRequiresEquipment] = useState(exercise?.requires_equipment ?? false)
  const linked = new Set(links.data?.filter((l) => l.exercise_id === exercise?.id).map((l) => l.equipment_id))

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const values = {
      name: String(f.get('name')).trim(),
      muscle_group: String(f.get('muscle_group')) as MuscleGroup,
      requires_equipment: f.get('requires_equipment') === 'on',
      description: String(f.get('description')).trim() || null,
    }
    const equipmentIds = f.getAll('equipment').map(String)
    setPending(true)
    setError(null)
    const saved = exercise
      ? await supabase.from('exercises').update(values).eq('id', exercise.id).select().single()
      : await supabase.from('exercises').insert(values).select().single()
    if (saved.error) {
      setPending(false)
      return setError(friendlyError(saved.error.message))
    }
    const id = (saved.data as Exercise).id
    await supabase.from('exercise_equipment').delete().eq('exercise_id', id)
    if (equipmentIds.length > 0) {
      const { error } = await supabase.from('exercise_equipment').insert(equipmentIds.map((equipment_id) => ({ exercise_id: id, equipment_id })))
      if (error) {
        setPending(false)
        return setError(error.message)
      }
    }
    await queryClient.invalidateQueries()
    onDone()
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <div className="field">
        <label htmlFor="ex-name">Nom de l’exercice</label>
        <input id="ex-name" name="name" defaultValue={exercise?.name} required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="ex-muscle">Muscle principal</label>
        <select id="ex-muscle" name="muscle_group" defaultValue={exercise?.muscle_group ?? 'pectoraux'}>
          {Object.entries(MUSCLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <label className="check-row">
        <input type="checkbox" name="requires_equipment" checked={requiresEquipment} onChange={(e) => setRequiresEquipment(e.target.checked)} />
        Nécessite une machine ou une poulie précise
      </label>
      <fieldset className="stack">
        <legend>Machines associées</legend>
        <p className="hint">
          {requiresEquipment
            ? 'L’exercice ne sera proposé que dans les salles où l’une de ces machines est cochée.'
            : 'Facultatif : indique sur quelles machines l’exercice peut se faire.'}
        </p>
        {(gyms.data ?? []).map((gym) => {
          const items = (equipment.data ?? []).filter((eq) => eq.gym_id === gym.id)
          if (items.length === 0) return null
          return (
            <div key={gym.id} className="stack-sm">
              <strong className="small">{gym.name}</strong>
              {items.map((eq) => (
                <label key={eq.id} className="check-row">
                  <input type="checkbox" name="equipment" value={eq.id} defaultChecked={linked.has(eq.id)} />
                  {eq.name}{eq.brand ? ` (${eq.brand})` : ''}
                </label>
              ))}
            </div>
          )
        })}
        {equipment.data?.length === 0 && <p className="muted small">Aucune machine enregistrée. Ajoute-les dans « Salles et machines ».</p>}
      </fieldset>
      <div className="field">
        <label htmlFor="ex-desc">Consignes (facultatif)</label>
        <textarea id="ex-desc" name="description" rows={3} defaultValue={exercise?.description ?? ''} />
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" className="primary" disabled={pending}>Enregistrer l’exercice</button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Salles et machines
// ---------------------------------------------------------------------------

function GymsSection() {
  const gyms = useGyms()
  const equipment = useEquipment()
  const queryClient = useQueryClient()
  const [error, setError] = useState<unknown>(null)
  const [deleting, setDeleting] = useState<{ kind: 'gym'; item: Gym } | { kind: 'equipment'; item: Equipment } | null>(null)

  async function addGym(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const { error } = await supabase.from('gyms').insert({ name: String(f.get('gym_name')).trim(), address: String(f.get('gym_address')).trim() || null })
    if (error) return setError(error.message)
    form.reset()
    await queryClient.invalidateQueries({ queryKey: ['gyms'] })
  }

  async function addEquipment(e: FormEvent<HTMLFormElement>, gymId: string) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const { error } = await supabase.from('equipment').insert({
      gym_id: gymId,
      name: String(f.get('eq_name')).trim(),
      brand: String(f.get('eq_brand')).trim() || null,
      kind: String(f.get('eq_kind')) as EquipmentKind,
    })
    if (error) return setError(error.message)
    form.reset()
    await queryClient.invalidateQueries({ queryKey: ['equipment'] })
  }

  async function confirmDelete() {
    if (!deleting) return
    const table = deleting.kind === 'gym' ? 'gyms' : 'equipment'
    setDeleting(null)
    const { error } = await supabase.from(table).delete().eq('id', deleting.item.id)
    if (error) return setError(friendlyError(error.message))
    await queryClient.invalidateQueries()
  }

  return (
    <section className="stack-lg" aria-label="Salles et machines">
      <ErrorMessage error={error} />
      {gyms.isPending && <Loading />}
      {gyms.data?.length === 0 && <Empty>Aucune salle. Ajoute la salle où tu t’entraînes.</Empty>}
      {gyms.data?.map((gym) => {
        const items = (equipment.data ?? []).filter((eq) => eq.gym_id === gym.id)
        return (
          <article key={gym.id} className="card stack" aria-labelledby={`gym-${gym.id}`}>
            <div className="row between wrap">
              <div>
                <h2 id={`gym-${gym.id}`}>{gym.name}</h2>
                {gym.address && <p className="muted small">{gym.address}</p>}
              </div>
              <button type="button" className="danger-link" onClick={() => setDeleting({ kind: 'gym', item: gym })}>Supprimer la salle</button>
            </div>
            {items.length === 0 ? <p className="muted small">Aucune machine pour cette salle.</p> : (
              <ul className="plain-list">
                {items.map((eq) => (
                  <li key={eq.id} className="row between">
                    <span>{eq.name}{eq.brand && <span className="muted"> ({eq.brand})</span>} <span className="badge">{EQUIPMENT_LABELS[eq.kind]}</span></span>
                    <button type="button" className="icon-button" aria-label={`Supprimer ${eq.name}`} onClick={() => setDeleting({ kind: 'equipment', item: eq })}>
                      <span aria-hidden="true">✕</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={(e) => addEquipment(e, gym.id)} className="row wrap end-items" aria-label={`Ajouter une machine à ${gym.name}`}>
              <div className="field grow">
                <label htmlFor={`eq-name-${gym.id}`}>Machine</label>
                <input id={`eq-name-${gym.id}`} name="eq_name" required placeholder="Presse à cuisses 45°" />
              </div>
              <div className="field">
                <label htmlFor={`eq-brand-${gym.id}`}>Marque</label>
                <input id={`eq-brand-${gym.id}`} name="eq_brand" placeholder="Technogym" />
              </div>
              <div className="field">
                <label htmlFor={`eq-kind-${gym.id}`}>Type</label>
                <select id={`eq-kind-${gym.id}`} name="eq_kind" defaultValue="machine">
                  {Object.entries(EQUIPMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <button type="submit">Ajouter</button>
            </form>
          </article>
        )
      })}

      <form onSubmit={addGym} className="card stack" aria-labelledby="new-gym">
        <h2 id="new-gym">Nouvelle salle</h2>
        <div className="field">
          <label htmlFor="gym_name">Nom</label>
          <input id="gym_name" name="gym_name" required />
        </div>
        <div className="field">
          <label htmlFor="gym_address">Adresse (facultatif)</label>
          <input id="gym_address" name="gym_address" autoComplete="street-address" />
        </div>
        <button type="submit" className="primary">Ajouter la salle</button>
      </form>

      <ConfirmDialog open={deleting !== null}
        title={deleting?.kind === 'gym' ? 'Supprimer la salle ?' : 'Supprimer la machine ?'}
        message={deleting?.kind === 'gym' ? `« ${deleting.item.name} » et toutes ses machines seront supprimées.` : `« ${deleting?.item.name} » sera supprimée.`}
        confirmLabel="Supprimer" onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
    </section>
  )
}
