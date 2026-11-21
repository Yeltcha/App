import { useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../lib/auth'
import { supabase, unwrap } from '../lib/supabase'
import { byId, useGyms, useProfiles } from '../lib/queries'
import type { SessionSummary } from '../lib/types'
import { SessionRow } from '../components/SessionRow'
import { Empty, ErrorMessage, Loading } from '../components/Feedback'

export default function HistoryPage() {
  const { profile, isStaff } = useAuth()
  const [params, setParams] = useSearchParams()
  const athleteId = (isStaff && params.get('athlete')) || profile?.id
  const profiles = useProfiles(isStaff)
  const gyms = byId(useGyms().data)

  const summaries = useQuery({
    queryKey: ['summaries', athleteId, 'all'],
    enabled: Boolean(athleteId),
    queryFn: async () =>
      unwrap(await supabase.from('session_summaries').select('*').eq('athlete_id', athleteId!)
        .order('started_at', { ascending: false }).limit(200)) as SessionSummary[],
  })

  return (
    <div className="stack-lg">
      <h1>Historique</h1>
      {isStaff && profiles.data && (
        <div className="field">
          <label htmlFor="athlete">Athlète</label>
          <select id="athlete" value={athleteId} onChange={(e) => setParams({ athlete: e.target.value })}>
            {profiles.data.map((p) => <option key={p.id} value={p.id}>{p.full_name || 'Sans nom'}</option>)}
          </select>
        </div>
      )}
      {summaries.isPending && <Loading />}
      <ErrorMessage error={summaries.error} />
      {summaries.data?.length === 0 && <Empty>Aucune séance terminée pour l’instant. Termine ta première séance pour la retrouver ici.</Empty>}
      <ul className="plain-list session-list">
        {summaries.data?.map((s) => (
          <li key={s.session_id}>
            <SessionRow summary={s} detailed gymName={s.gym_id ? gyms.get(s.gym_id)?.name : undefined} />
          </li>
        ))}
      </ul>
    </div>
  )
}
