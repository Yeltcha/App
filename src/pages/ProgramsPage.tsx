import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase, unwrap } from '../lib/supabase'
import { byId, useProfiles } from '../lib/queries'
import type { Program } from '../lib/types'
import { Dialog } from '../components/Dialog'
import { Empty, ErrorMessage, Loading } from '../components/Feedback'

export default function ProgramsPage() {
  const navigate = useNavigate()
  const profiles = useProfiles()
  const people = byId(profiles.data)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const programs = useQuery({
    queryKey: ['programs'],
    queryFn: async () =>
      unwrap(await supabase.from('programs').select('*').order('updated_at', { ascending: false })) as Program[],
  })

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const { data, error } = await supabase.from('programs').insert({
      name: String(f.get('name')).trim(),
      athlete_id: String(f.get('athlete')) || null,
    }).select().single()
    if (error) return setError(error.message)
    navigate(`/programmes/${(data as Program).id}`)
  }

  return (
    <div className="stack-lg">
      <div className="row between wrap">
        <h1>Programmes</h1>
        <button type="button" className="primary" onClick={() => setCreating(true)}>+ Nouveau programme</button>
      </div>
      {programs.isPending && <Loading />}
      <ErrorMessage error={programs.error} />
      {programs.data?.length === 0 && <Empty>Aucun programme. Crée-en un, par exemple « Push / Pull / Legs ».</Empty>}
      <ul className="plain-list stack">
        {programs.data?.map((p) => (
          <li key={p.id}>
            <Link to={`/programmes/${p.id}`} className="card link-card">
              <strong>{p.name}</strong>
              <span className="muted small">
                {p.athlete_id ? `Attribué à ${people.get(p.athlete_id)?.full_name ?? '…'}` : 'Modèle non attribué'}
                {!p.is_active && ' · inactif'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Dialog open={creating} onClose={() => setCreating(false)} title="Nouveau programme">
        <form onSubmit={create} className="stack">
          <div className="field">
            <label htmlFor="p-name">Nom du programme</label>
            <input id="p-name" name="name" required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="p-athlete">Attribuer à</label>
            <select id="p-athlete" name="athlete" defaultValue="">
              <option value="">Personne (modèle)</option>
              {profiles.data?.map((p) => <option key={p.id} value={p.id}>{p.full_name || 'Sans nom'}</option>)}
            </select>
          </div>
          {error && <p role="alert" className="error">{error}</p>}
          <button type="submit" className="primary">Créer et ajouter les séances</button>
        </form>
      </Dialog>
    </div>
  )
}
