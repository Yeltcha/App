import { lazy, Suspense } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router'
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
        {isStaff && (
          <nav aria-label="Espace coach" className="staff-nav">
            {STAFF_NAV.map((item) => (
              <NavLink key={item.to} to={item.to}>
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        )}
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
