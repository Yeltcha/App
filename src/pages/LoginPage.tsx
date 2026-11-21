import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { ErrorMessage } from '../components/Feedback'

export function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [mode, setMode] = useState<'login' | 'reset'>('login')

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email'))
    setError(null)
    setInfo(null)
    setPending(true)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: String(form.get('password')),
      })
      if (error) setError(error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : error.message)
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) setError(error.message)
      else setInfo('Si un compte existe pour cet email, un lien de réinitialisation vient d’être envoyé.')
    }
    setPending(false)
  }

  return (
    <main className="page narrow auth-page">
      <h1>Muscu</h1>
      <p className="muted">Suivi d’entraînement entre coach et athlètes.</p>
      <form onSubmit={onSubmit} aria-labelledby="login-title" className="card stack">
        <h2 id="login-title">{mode === 'login' ? 'Connexion' : 'Mot de passe oublié'}</h2>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" required
            autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint={mode === 'login' ? 'next' : 'send'} />
        </div>
        {mode === 'login' && (
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required enterKeyHint="go" />
          </div>
        )}
        <ErrorMessage error={error} />
        {info && <p role="status" className="success">{info}</p>}
        <button type="submit" className="primary" disabled={pending}>
          {mode === 'login' ? 'Se connecter' : 'Envoyer le lien'}
        </button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'reset' : 'login'); setError(null); setInfo(null) }}>
          {mode === 'login' ? 'Mot de passe oublié ?' : 'Retour à la connexion'}
        </button>
      </form>
      <p className="muted small">Pas de compte ? Demande une invitation à ton coach.</p>
    </main>
  )
}
