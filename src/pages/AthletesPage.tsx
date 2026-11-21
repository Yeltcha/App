import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { byId, useProfiles } from '../lib/queries'
import { ROLE_LABELS, type AppRole } from '../lib/types'
import { ErrorMessage, Loading } from '../components/Feedback'

export default function AthletesPage() {
  const { isAdmin, profile: me } = useAuth()
  const profiles = useProfiles()
  const people = byId(profiles.data)
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState('')
  const [pending, setPending] = useState(false)

  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    setPending(true)
    setError(null)
    setInfo('')
    const { data, error } = await supabase.functions.invoke('invite-athlete', {
      body: { email: String(f.get('email')), fullName: String(f.get('full_name')), redirectTo: window.location.origin },
    })
    setPending(false)
    if (error) {
      let message = error.message
      try { message = (await error.context.json()).error ?? message } catch { /* réponse non JSON */ }
      return setError(message)
    }
    form.reset()
    setInfo(`Invitation envoyée à ${data.email}.`)
    await queryClient.invalidateQueries({ queryKey: ['profiles'] })
  }

  async function changeRole(id: string, role: AppRole) {
    setError(null)
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (error) return setError(error.message)
    setInfo('Rôle mis à jour.')
    await queryClient.invalidateQueries({ queryKey: ['profiles'] })
  }

  return (
    <div className="stack-lg">
      <h1>Athlètes</h1>

      <form onSubmit={invite} className="card stack" aria-labelledby="invite-title">
        <h2 id="invite-title">Inviter un athlète</h2>
        <p className="muted small">Il reçoit un email pour choisir son mot de passe. Il est rattaché à toi comme coach.</p>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="full_name">Nom</label>
            <input id="full_name" name="full_name" autoComplete="off" required />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
          </div>
        </div>
        {error && <p role="alert" className="error">{error}</p>}
        <p role="status" className="success">{info}</p>
        <button type="submit" className="primary" disabled={pending}>Envoyer l’invitation</button>
      </form>

      <section aria-labelledby="list-title" className="stack">
        <h2 id="list-title">Membres</h2>
        {profiles.isPending && <Loading />}
        <ErrorMessage error={profiles.error} />
        <div className="table-scroll" role="region" aria-labelledby="list-title" tabIndex={0}>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Nom</th>
                <th scope="col">Rôle</th>
                <th scope="col">Coach</th>
                <th scope="col">Suivi</th>
              </tr>
            </thead>
            <tbody>
              {profiles.data?.map((p) => {
                const canEdit = p.id !== me?.id && (isAdmin || p.role !== 'admin')
                return (
                  <tr key={p.id}>
                    <th scope="row">{p.full_name || 'Sans nom'}</th>
                    <td>
                      {canEdit ? (
                        <select aria-label={`Rôle de ${p.full_name}`} value={p.role} onChange={(e) => changeRole(p.id, e.target.value as AppRole)}>
                          {(Object.keys(ROLE_LABELS) as AppRole[]).filter((r) => isAdmin || r !== 'admin').map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      ) : ROLE_LABELS[p.role]}
                    </td>
                    <td>{p.coach_id ? people.get(p.coach_id)?.full_name ?? '–' : '–'}</td>
                    <td className="row wrap">
                      <Link to={`/stats?athlete=${p.id}`}>Stats</Link>
                      <Link to={`/historique?athlete=${p.id}`}>Séances</Link>
                      <Link to={`/profil?athlete=${p.id}`}>Profil</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
