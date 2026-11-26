import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router'
import { useAuth } from './lib/auth'
import { Icon, type IconName } from './components/Icon'
import { Loading } from './components/Feedback'
import { LoginPage } from './pages/LoginPage'
import { SetPasswordPage } from './pages/SetPasswordPage'
import { HomePage } from './pages/HomePage'

const ActiveSessionPage = lazy(() => import('./pages/ActiveSessionPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const SessionDetailPage = lazy(() => import('./pages/SessionDetailPage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const LibraryPage = lazy(() => import('./pages/LibraryPage'))
const ProgramsPage = lazy(() => import('./pages/ProgramsPage'))
const ProgramEditPage = lazy(() => import('./pages/ProgramEditPage'))
const AthletesPage = lazy(() => import('./pages/AthletesPage'))

const MAIN_NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Accueil', icon: 'home' },
  { to: '/seance', label: 'Séance', icon: 'dumbbell' },
  { to: '/historique', label: 'Historique', icon: 'history' },
  { to: '/stats', label: 'Stats', icon: 'chart' },
  { to: '/profil', label: 'Profil', icon: 'user' },
]

const STAFF_NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/programmes', label: 'Programmes', icon: 'list' },
  { to: '/bibliotheque', label: 'Bibliothèque', icon: 'book' },
  { to: '/athletes', label: 'Athlètes', icon: 'users' },
]

function initials(name: string | undefined): string {
  if (!name) return ''
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toLocaleUpperCase('fr')).join('')
}

/** Menu coach : en ligne sur grand écran, menu déroulant sur téléphone. */
function StaffMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const current = STAFF_NAV.find((item) => pathname.startsWith(item.to))

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div className="staff-menu" ref={ref}>
      <button type="button" className="menu-toggle" aria-expanded={open} aria-controls="staff-nav" onClick={() => setOpen(!open)}>
        <Icon name={open ? 'close' : 'menu'} />
        <span>{current?.label ?? 'Espace coach'}</span>
      </button>
      <nav id="staff-nav" aria-label="Espace coach" className={open ? 'staff-nav open' : 'staff-nav'}>
        {STAFF_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function App() {
  const { session, loading, mustSetPassword, isStaff, profile } = useAuth()

  if (loading) return <main className="page"><Loading /></main>
  if (!session) return <LoginPage />
  if (mustSetPassword) return <SetPasswordPage />

  return (
    <div className="shell">
      <header className="top-bar">
        <a href="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Praug
        </a>
        {isStaff && <StaffMenu />}
        <span className="user-name" role="img" title={profile?.full_name} aria-label={profile?.full_name}>{initials(profile?.full_name)}</span>
      </header>

      <main className="page" id="contenu">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/seance" element={<ActiveSessionPage />} />
            <Route path="/historique" element={<HistoryPage />} />
            <Route path="/historique/:id" element={<SessionDetailPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/profil" element={<ProfilePage />} />
            {isStaff && (
              <>
                <Route path="/programmes" element={<ProgramsPage />} />
                <Route path="/programmes/:id" element={<ProgramEditPage />} />
                <Route path="/bibliotheque" element={<LibraryPage />} />
                <Route path="/athletes" element={<AthletesPage />} />
              </>
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      <nav aria-label="Navigation principale" className="tab-bar">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={item.to === '/seance' ? 'tab-main' : undefined}>
            <Icon name={item.icon} />
            <span className="visually-hidden">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
