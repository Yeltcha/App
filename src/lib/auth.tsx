import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from './supabase'
import type { Profile } from './types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isStaff: boolean
  isAdmin: boolean
  /** Vrai quand l'utilisateur arrive d'un lien d'invitation ou de réinitialisation */
  mustSetPassword: boolean
  clearMustSetPassword: () => void
  refreshProfile: () => void
}

const AuthContext = createContext<AuthState | null>(null)

function linkTypeFromUrl(): string | null {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const search = new URLSearchParams(window.location.search)
  return hash.get('type') ?? search.get('type')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [mustSetPassword, setMustSetPassword] = useState(() => {
    const type = linkTypeFromUrl()
    return type === 'invite' || type === 'recovery'
  })

  const queryClient = useQueryClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setMustSetPassword(true)
      if (event === 'SIGNED_OUT') queryClient.clear()
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  const userId = session?.user.id
  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async () =>
      unwrap(await supabase.from('profiles').select('*').eq('id', userId!).single()) as Profile,
  })

  const profile = profileQuery.data ?? null
  const value: AuthState = {
    session,
    profile,
    loading: sessionLoading || (Boolean(userId) && profileQuery.isPending),
    isStaff: profile?.role === 'admin' || profile?.role === 'coach',
    isAdmin: profile?.role === 'admin',
    mustSetPassword,
    clearMustSetPassword: () => setMustSetPassword(false),
    refreshProfile: () => void profileQuery.refetch(),
  }

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthState {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}
