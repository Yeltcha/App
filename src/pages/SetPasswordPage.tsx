import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ErrorMessage } from '../components/Feedback'
import { AuthBrand } from '../components/AuthBrand'

export function SetPasswordPage() {
  const { clearMustSetPassword, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const password = String(form.get('password'))
    const confirm = String(form.get('confirm'))
    const fullName = String(form.get('full_name')).trim()
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      ;(e.currentTarget.elements.namedItem('confirm') as HTMLInputElement).focus()
      return
    }
    setPending(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setPending(false)
      return
    }
    if (profile && fullName && fullName !== profile.full_name) {
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', profile.id)
      refreshProfile()
    }
    history.replaceState(null, '', '/')
    clearMustSetPassword()
    navigate('/', { replace: true })
  }

  return (
    <main className="page narrow auth-page">
      <AuthBrand />
      <div className="auth-hero">
        <h1 className="auth-title">Bienvenue <span>dans l’équipe.</span></h1>
        <p className="auth-tagline">Dernière étape avant ta première séance.</p>
      </div>
      <form onSubmit={onSubmit} aria-labelledby="pw-title" className="card stack auth-card">
        <h2 id="pw-title">Choisis ton mot de passe</h2>
        <div className="field">
          <label htmlFor="full_name">Nom affiché</label>
          <input id="full_name" name="full_name" autoComplete="name" defaultValue={profile?.full_name ?? ''} required />
        </div>
        <div className="field">
          <label htmlFor="password">Nouveau mot de passe</label>
          <input id="password" name="password" type="password" autoComplete="new-password"
            minLength={8} required aria-describedby="pw-help" />
          <span id="pw-help" className="hint">8 caractères minimum.</span>
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirme le mot de passe</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <ErrorMessage error={error} />
        <button type="submit" className="primary" disabled={pending}>Enregistrer</button>
      </form>
    </main>
  )
}
