// Fonction serveur : un coach ou un administrateur invite un athlète par email.
// La clé service_role reste côté serveur ; le client n'envoie que son jeton.
// Aucune dépendance : appels directs aux API Auth et REST de Supabase.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Non authentifié' }, 401)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const asCaller = { apikey: anonKey, Authorization: authHeader, 'Content-Type': 'application/json' }
  const asService = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }

  // Qui appelle ? (jeton vérifié par Supabase Auth)
  const userRes = await fetch(`${url}/auth/v1/user`, { headers: asCaller })
  if (!userRes.ok) return json({ error: 'Non authentifié' }, 401)
  const caller = (await userRes.json()) as { id: string }

  // Son rôle, vérifié par la base (fonction is_staff)
  const roleRes = await fetch(`${url}/rest/v1/rpc/is_staff`, { method: 'POST', headers: asCaller, body: '{}' })
  if (!roleRes.ok || (await roleRes.json()) !== true) {
    return json({ error: 'Réservé aux coachs et administrateurs' }, 403)
  }

  let payload: { email?: string; fullName?: string; redirectTo?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Requête invalide' }, 400)
  }
  const email = payload.email?.trim().toLowerCase() ?? ''
  const fullName = payload.fullName?.trim() ?? ''
  if (!EMAIL_RE.test(email)) return json({ error: 'Adresse email invalide' }, 400)

  const inviteUrl = new URL(`${url}/auth/v1/invite`)
  if (payload.redirectTo) inviteUrl.searchParams.set('redirect_to', payload.redirectTo)
  const inviteRes = await fetch(inviteUrl, {
    method: 'POST',
    headers: asService,
    body: JSON.stringify({ email, data: { full_name: fullName } }),
  })
  const invited = await inviteRes.json()
  if (!inviteRes.ok) {
    const message = String(invited.msg ?? invited.message ?? invited.error_description ?? 'Invitation impossible')
    if (inviteRes.status === 422 || message.toLowerCase().includes('already')) {
      return json({ error: 'Un compte existe déjà pour cet email' }, 409)
    }
    return json({ error: message }, 400)
  }

  // Rattache l'athlète au coach qui l'a invité
  await fetch(`${url}/rest/v1/profiles?id=eq.${invited.id}`, {
    method: 'PATCH',
    headers: { ...asService, Prefer: 'return=minimal' },
    body: JSON.stringify({ coach_id: caller.id, full_name: fullName }),
  })

  return json({ id: invited.id, email })
})
