import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { byId, useEquipment, useExerciseEquipment, useExercises, useGymBrands, useGyms } from '../lib/queries'
import { machinesFor } from '../lib/machines'
import {
  EQUIPMENT_LABELS, MUSCLE_LABELS,
  type Equipment, type EquipmentKind, type Exercise, type Gym, type GymBrand, type MuscleGroup,
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
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const values = {
      name: String(f.get('name')).trim(),
      muscle_group: String(f.get('muscle_group')) as MuscleGroup,
      requires_equipment: f.get('requires_equipment') === 'on',
      description: String(f.get('description')).trim() || null,
    }
    setPending(true)
    setError(null)
    const { error } = exercise
      ? await supabase.from('exercises').update(values).eq('id', exercise.id)
      : await supabase.from('exercises').insert(values)
    if (error) {
      setPending(false)
      return setError(friendlyError(error.message))
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
        <input type="checkbox" name="requires_equipment" defaultChecked={exercise?.requires_equipment ?? false} />
        Se fait sur une machine ou une poulie
      </label>
      <p className="hint">
        Un exercice sur machine n’est proposé dans une séance que si la salle de la séance a une machine qui le permet.
        Les machines s’ajoutent dans « Salles et machines ».
      </p>
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

type Deleting =
  | { kind: 'gym'; item: Gym }
  | { kind: 'brand'; item: GymBrand }
  | { kind: 'equipment'; item: Equipment }

const DELETE_TEXT: Record<Deleting['kind'], { title: string; message: (name: string) => string }> = {
  gym: { title: 'Supprimer la salle ?', message: (n) => `« ${n} », ses marques et toutes ses machines seront supprimées.` },
  brand: { title: 'Supprimer la marque ?', message: (n) => `« ${n} » sera retirée de la salle. Ses machines restent, sans marque.` },
  equipment: { title: 'Supprimer la machine ?', message: (n) => `« ${n} » sera supprimée.` },
}

const DELETE_TABLE = { gym: 'gyms', brand: 'gym_brands', equipment: 'equipment' } as const

function GymsSection() {
  const gyms = useGyms()
  const brands = useGymBrands()
  const equipment = useEquipment()
  const links = useExerciseEquipment()
  const exercises = useExercises()
  const queryClient = useQueryClient()
  const [error, setError] = useState<unknown>(null)
  const [deleting, setDeleting] = useState<Deleting | null>(null)
  const [linking, setLinking] = useState<Equipment | null>(null)
  const exerciseById = byId(exercises.data)

  async function addGym(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const { error } = await supabase.from('gyms').insert({ name: String(f.get('gym_name')).trim(), address: String(f.get('gym_address')).trim() || null })
    if (error) return setError(error.message)
    setError(null)
    form.reset()
    await queryClient.invalidateQueries({ queryKey: ['gyms'] })
  }

  async function addBrand(e: FormEvent<HTMLFormElement>, gymId: string) {
    e.preventDefault()
    const form = e.currentTarget
    const name = String(new FormData(form).get('brand_name')).trim()
    if (!name) return
    const duplicate = `La marque « ${name} » existe déjà dans cette salle.`
    const key = name.toLocaleLowerCase('fr')
    if (brands.data?.some((b) => b.gym_id === gymId && b.name.toLocaleLowerCase('fr') === key)) return setError(duplicate)
    const { error } = await supabase.from('gym_brands').insert({ gym_id: gymId, name })
    if (error) return setError(error.message.includes('duplicate key') ? duplicate : error.message)
    setError(null)
    form.reset()
    await queryClient.invalidateQueries({ queryKey: ['gym_brands'] })
  }

  async function addEquipment(e: FormEvent<HTMLFormElement>, gymId: string) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const { data, error } = await supabase.from('equipment').insert({
      gym_id: gymId,
      name: String(f.get('eq_name')).trim(),
      brand_id: String(f.get('eq_brand')) || null,
      kind: String(f.get('eq_kind')) as EquipmentKind,
    }).select().single()
    if (error) return setError(error.message)
    const exerciseId = String(f.get('eq_exercise'))
    if (exerciseId) {
      const { error } = await supabase.from('exercise_equipment').insert({ exercise_id: exerciseId, equipment_id: (data as Equipment).id })
      if (error) return setError(error.message)
    }
    setError(null)
    form.reset()
    await queryClient.invalidateQueries({ queryKey: ['equipment'] })
    await queryClient.invalidateQueries({ queryKey: ['exercise_equipment'] })
    await queryClient.invalidateQueries({ queryKey: ['gym_exercises'] })
  }

  async function confirmDelete() {
    if (!deleting) return
    const target = deleting
    setDeleting(null)
    const { error } = await supabase.from(DELETE_TABLE[target.kind]).delete().eq('id', target.item.id)
    if (error) return setError(friendlyError(error.message))
    setError(null)
    await queryClient.invalidateQueries()
  }

  return (
    <section className="stack-lg" aria-label="Salles et machines">
      <p className="hint">Crée une salle, ajoute les marques présentes, puis les machines de chaque marque et les exercices qu’elles permettent.</p>
      <ErrorMessage error={error} />
      {gyms.isPending && <Loading />}
      {gyms.data?.length === 0 && <Empty>Aucune salle. Ajoute la salle où tu t’entraînes.</Empty>}
      {gyms.data?.map((gym) => {
        const gymBrands = (brands.data ?? []).filter((b) => b.gym_id === gym.id)
        const machines = (equipment.data ?? []).filter((eq) => eq.gym_id === gym.id)
        const groups = [
          ...gymBrands.map((b) => ({ key: b.id, label: b.name, items: machines.filter((eq) => eq.brand_id === b.id) })),
          { key: 'none', label: 'Sans marque', items: machines.filter((eq) => !eq.brand_id) },
        ].filter((g) => g.items.length > 0)
        return (
          <article key={gym.id} className="card stack" aria-labelledby={`gym-${gym.id}`}>
            <div className="row between wrap">
              <div>
                <h2 id={`gym-${gym.id}`}>{gym.name}</h2>
                {gym.address && <p className="muted small">{gym.address}</p>}
              </div>
              <button type="button" className="danger-link" onClick={() => setDeleting({ kind: 'gym', item: gym })}>Supprimer la salle</button>
            </div>

            <section className="stack-sm" aria-label={`Marques de ${gym.name}`}>
              <h3>Marques</h3>
              {gymBrands.length === 0 ? <p className="muted small">Aucune marque pour cette salle.</p> : (
                <ul className="plain-list brand-chips">
                  {gymBrands.map((b) => (
                    <li key={b.id}>
                      {b.name}
                      <button type="button" className="icon-button" aria-label={`Supprimer la marque ${b.name}`} onClick={() => setDeleting({ kind: 'brand', item: b })}>
                        <span aria-hidden="true">✕</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <form onSubmit={(e) => addBrand(e, gym.id)} className="row wrap end-items" aria-label={`Ajouter une marque à ${gym.name}`}>
                <div className="field grow">
                  <label htmlFor={`brand-name-${gym.id}`}>Nouvelle marque</label>
                  <input id={`brand-name-${gym.id}`} name="brand_name" required maxLength={60} placeholder="Technogym" />
                </div>
                <button type="submit">Ajouter la marque</button>
              </form>
            </section>

            <section className="stack-sm" aria-label={`Machines de ${gym.name}`}>
              <h3>Machines</h3>
              {groups.length === 0 && <p className="muted small">Aucune machine pour cette salle.</p>}
              {groups.map((group) => (
                <div key={group.key} className="stack-sm machine-group">
                  <strong className="machine-brand small">{group.label}</strong>
                  <ul className="plain-list stack-sm">
                    {group.items.map((eq) => {
                      const linked = (links.data ?? []).filter((l) => l.equipment_id === eq.id)
                        .map((l) => exerciseById.get(l.exercise_id)?.name).filter(Boolean)
                        .sort((a, b) => a!.localeCompare(b!, 'fr'))
                      return (
                        <li key={eq.id} className="row between wrap machine-row">
                          <span className="item-text">
                            <span>{eq.name} <span className="badge">{EQUIPMENT_LABELS[eq.kind]}</span></span>
                            <span className="muted small">{linked.length ? linked.join(', ') : 'Aucun exercice associé'}</span>
                          </span>
                          <span className="row">
                            <button type="button" onClick={() => setLinking(eq)} aria-label={`Exercices de ${eq.name}`}>Exercices</button>
                            <button type="button" className="icon-button" aria-label={`Supprimer ${eq.name}`} onClick={() => setDeleting({ kind: 'equipment', item: eq })}>
                              <span aria-hidden="true">✕</span>
                            </button>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
              <form onSubmit={(e) => addEquipment(e, gym.id)} className="stack-sm add-machine" aria-label={`Ajouter une machine à ${gym.name}`}>
                <div className="row wrap end-items">
                  <div className="field grow">
                    <label htmlFor={`eq-name-${gym.id}`}>Machine</label>
                    <input id={`eq-name-${gym.id}`} name="eq_name" required placeholder="Pec deck" />
                  </div>
                  <div className="field">
                    <label htmlFor={`eq-brand-${gym.id}`}>Marque</label>
                    <select id={`eq-brand-${gym.id}`} name="eq_brand" defaultValue={gymBrands[0]?.id ?? ''} key={gymBrands.map((b) => b.id).join()}>
                      {gymBrands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      <option value="">Sans marque</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`eq-kind-${gym.id}`}>Type</label>
                    <select id={`eq-kind-${gym.id}`} name="eq_kind" defaultValue="machine">
                      {Object.entries(EQUIPMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <div className="row wrap end-items">
                  <div className="field grow">
                    <label htmlFor={`eq-ex-${gym.id}`}>Exercice sur cette machine</label>
                    <select id={`eq-ex-${gym.id}`} name="eq_exercise" defaultValue="">
                      <option value="">Plus tard</option>
                      <ExerciseOptions exercises={exercises.data ?? []} />
                    </select>
                  </div>
                  <button type="submit">Ajouter la machine</button>
                </div>
              </form>
            </section>
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

      <Dialog open={linking !== null} onClose={() => setLinking(null)} title={`Exercices sur ${linking?.name ?? ''}`} lightDismiss={false}>
        {linking && <MachineExercisesForm machine={linking} onDone={() => setLinking(null)} />}
      </Dialog>
      <ConfirmDialog open={deleting !== null}
        title={deleting ? DELETE_TEXT[deleting.kind].title : ''}
        message={deleting ? DELETE_TEXT[deleting.kind].message(deleting.item.name) : ''}
        confirmLabel="Supprimer" onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
    </section>
  )
}

/** Exercices sur machine d'abord, puis les autres. */
function ExerciseOptions({ exercises }: { exercises: Exercise[] }) {
  const onMachine = exercises.filter((x) => x.requires_equipment)
  const others = exercises.filter((x) => !x.requires_equipment)
  return (
    <>
      <optgroup label="Sur machine">{onMachine.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>
      <optgroup label="Autres">{others.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>
    </>
  )
}

/** Choix des exercices réalisables sur une machine. */
function MachineExercisesForm({ machine, onDone }: { machine: Equipment; onDone: () => void }) {
  const exercises = useExercises()
  const links = useExerciseEquipment()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const linked = new Set((links.data ?? []).filter((l) => l.equipment_id === machine.id).map((l) => l.exercise_id))
  const list = [...(exercises.data ?? [])].sort((a, b) => Number(b.requires_equipment) - Number(a.requires_equipment))

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const checked = new Set(new FormData(e.currentTarget).getAll('exercise').map(String))
    const added = [...checked].filter((id) => !linked.has(id))
    const removed = [...linked].filter((id) => !checked.has(id))
    setPending(true)
    const results = await Promise.all([
      added.length ? supabase.from('exercise_equipment').insert(added.map((exercise_id) => ({ exercise_id, equipment_id: machine.id }))) : null,
      removed.length ? supabase.from('exercise_equipment').delete().eq('equipment_id', machine.id).in('exercise_id', removed) : null,
    ])
    const failed = results.find((r) => r?.error)
    if (failed?.error) {
      setPending(false)
      return setError(failed.error.message)
    }
    await queryClient.invalidateQueries({ queryKey: ['exercise_equipment'] })
    await queryClient.invalidateQueries({ queryKey: ['gym_exercises'] })
    onDone()
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <p className="hint">Coche les exercices qui se font sur cette machine{machine.brand ? ` ${machine.brand}` : ''}.</p>
      {exercises.isPending && <Loading />}
      <fieldset className="stack-sm machine-exercises">
        <legend className="visually-hidden">Exercices</legend>
        {list.map((x) => (
          <label key={x.id} className="check-row">
            <input type="checkbox" name="exercise" value={x.id} defaultChecked={linked.has(x.id)} />
            {x.name}
            {x.requires_equipment && <span className="muted small"> · sur machine</span>}
          </label>
        ))}
      </fieldset>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" className="primary" disabled={pending}>Enregistrer</button>
    </form>
  )
}
