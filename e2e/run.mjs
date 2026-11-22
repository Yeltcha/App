// Test de bout en bout : parcours coach puis athlète sur la base Supabase locale.
// Prérequis : `npx supabase start`, puis `npm run build`.
// Lance : `npm run test:e2e` (la base locale est réinitialisée).
import { execSync, spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { chromium, devices } from 'playwright'

const API = 'http://127.0.0.1:54321'
const MAILPIT = 'http://127.0.0.1:54324'
const APP = 'http://127.0.0.1:5173'
// Clé service_role de l'instance locale, lue depuis la CLI Supabase
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ??
  JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' }).match(/\{[\s\S]*\}/)[0]).SERVICE_ROLE_KEY
const SHOTS = process.env.SHOTS_DIR ?? 'e2e/screenshots'
mkdirSync(SHOTS, { recursive: true })

const COACH = { email: 'coach@exemple.fr', password: 'motdepasse-coach', name: 'Youri Coach' }
const ATHLETE = { email: 'athlete@exemple.fr', password: 'motdepasse-athlete', name: 'Alex Athlète' }

const step = (label) => console.log(`\n▶ ${label}`)
function assert(cond, message) {
  if (!cond) throw new Error(`Échec : ${message}`)
  console.log(`  ✓ ${message}`)
}

execSync('npx supabase db reset', { stdio: 'ignore' })
await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' })

const admin = createClient(API, SERVICE_KEY, { auth: { persistSession: false } })
const created = await admin.auth.admin.createUser({
  email: COACH.email, password: COACH.password, email_confirm: true, user_metadata: { full_name: COACH.name },
})
if (created.error) throw created.error

const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { stdio: 'ignore' })
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(APP)).ok) break } catch { /* pas encore prêt */ }
  await new Promise((r) => setTimeout(r, 200))
}

const browser = await chromium.launch()
const errors = []
async function newPage(options = {}) {
  const context = await browser.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', ...options })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  return page
}
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })

try {
  // ------------------------------------------------------------------ Coach
  step('Connexion du coach (premier compte = administrateur)')
  const coach = await newPage({ viewport: { width: 1280, height: 860 } })
  await coach.goto(APP)
  await shot(coach, '01-connexion')
  await coach.getByLabel('Email').fill(COACH.email)
  await coach.getByLabel('Mot de passe').fill(COACH.password)
  await coach.getByRole('button', { name: 'Se connecter' }).click()
  await coach.getByRole('heading', { name: /Bonjour Youri/ }).waitFor()
  assert(await coach.getByRole('navigation', { name: 'Espace coach' }).isVisible(), 'le coach voit l’espace coach')

  step('Bibliothèque : salle, machine, exercice lié')
  await coach.getByRole('link', { name: 'Bibliothèque' }).click()
  await coach.getByRole('button', { name: 'Salles et machines' }).click()
  await coach.getByLabel('Nom', { exact: true }).fill('Salle Centre')
  await coach.getByRole('button', { name: 'Ajouter la salle' }).click()
  await coach.getByRole('heading', { name: 'Salle Centre' }).waitFor()
  await coach.getByLabel('Nom', { exact: true }).fill('Salle Garage')
  await coach.getByRole('button', { name: 'Ajouter la salle' }).click()
  await coach.getByRole('heading', { name: 'Salle Garage' }).waitFor()
  const centre = coach.getByRole('article').filter({ has: coach.getByRole('heading', { name: 'Salle Centre' }) })
  await centre.getByRole('textbox', { name: 'Machine' }).fill('Presse à cuisses 45°')
  await centre.getByRole('textbox', { name: 'Marque' }).fill('Technogym')
  await centre.getByRole('button', { name: 'Ajouter' }).click()
  await centre.getByText('Presse à cuisses 45°').waitFor()
  await shot(coach, '02-salles-machines')
  await coach.getByRole('button', { name: 'Exercices', exact: true }).click()
  await coach.getByRole('searchbox').fill('presse')
  await coach.getByRole('listitem').filter({ hasText: 'Presse à cuisses' }).getByRole('button', { name: 'Modifier' }).click()
  await coach.getByRole('checkbox', { name: /Presse à cuisses 45°/ }).check()
  await coach.getByRole('button', { name: 'Enregistrer l’exercice' }).click()
  await coach.getByRole('dialog').waitFor({ state: 'hidden' })
  assert(true, 'la presse est liée à la machine de la Salle Centre')

  step('Invitation d’un athlète par email')
  await coach.getByRole('link', { name: 'Athlètes' }).click()
  await coach.getByLabel('Nom').fill(ATHLETE.name)
  await coach.getByLabel('Email').fill(ATHLETE.email)
  await coach.getByRole('button', { name: 'Envoyer l’invitation' }).click()
  await coach.getByText(`Invitation envoyée à ${ATHLETE.email}.`).waitFor()
  await coach.getByRole('rowheader', { name: ATHLETE.name }).waitFor()
  await shot(coach, '03-athletes')
  assert(true, 'invitation envoyée et athlète listé')

  step('Programme attribué à l’athlète')
  await coach.getByRole('link', { name: 'Programmes' }).click()
  await coach.getByRole('button', { name: '+ Nouveau programme' }).click()
  await coach.getByLabel('Nom du programme').fill('Force 5x5')
  await coach.getByLabel('Attribuer à').selectOption({ label: ATHLETE.name })
  await coach.getByRole('button', { name: 'Créer et ajouter les séances' }).click()
  await coach.getByRole('heading', { name: 'Force 5x5' }).waitFor()
  for (const name of ['Jambes', 'Haut du corps']) {
    await coach.getByRole('button', { name: '+ Ajouter une séance' }).click()
    await coach.getByLabel('Nom de la séance').fill(name)
    if (name === 'Jambes') await coach.getByLabel('Salle (facultatif)').selectOption({ label: 'Salle Centre' })
    await coach.getByRole('button', { name: 'Ajouter', exact: true }).click()
    await coach.getByRole('heading', { name: new RegExp(name) }).waitFor()
  }
  const jambes = coach.getByRole('listitem').filter({ has: coach.getByRole('heading', { name: '1. Jambes' }) })
  await jambes.getByRole('button', { name: '+ Ajouter un exercice' }).click()
  await coach.getByLabel('Exercice').selectOption({ label: 'Squat barre' })
  await coach.getByRole('dialog').locator('label', { hasText: /^Force$/ }).click()
  assert(await coach.getByLabel('Force', { exact: true }).isChecked(), 'spécialité Force choisie')
  await coach.getByLabel('Séries').fill('3')
  await coach.getByLabel('Répétitions min.').fill('5')
  await coach.getByLabel('RPE cible (facultatif)').selectOption('8')
  await coach.getByText('Aucun 1RM connu pour cet exercice').waitFor()
  assert(true, 'sans 1RM, la charge au RPE n’est pas calculée')
  await coach.getByLabel('Charge cible en kg (facultatif)').fill('100')
  await coach.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click()
  await jambes.getByText('Squat barre').waitFor()
  await jambes.getByText('3 × 5 @ RPE 8, 100 kg').waitFor()
  assert(true, 'spécialité Force et RPE cible enregistrés')
  await jambes.getByRole('button', { name: '+ Ajouter un exercice' }).click()
  await coach.getByLabel('Exercice').selectOption({ label: 'Presse à cuisses' })
  await coach.getByLabel('Machine').selectOption({ label: 'Presse à cuisses 45° (Technogym)' })
  await coach.getByLabel('Séries').fill('2')
  await coach.getByLabel('Répétitions min.').fill('10')
  await coach.getByLabel('Répétitions max. (facultatif)').fill('12')
  await coach.getByLabel('Charge cible en kg (facultatif)').fill('140')
  await coach.getByLabel('Repos (s)').fill('60')
  await coach.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click()
  await jambes.getByText('Presse à cuisses', { exact: true }).waitFor()
  await shot(coach, '04-programme')
  assert(true, 'programme « Force 5x5 » créé avec 2 séances')

  // --------------------------------------------------------------- Athlète
  step('L’athlète accepte l’invitation')
  const mails = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('to:' + ATHLETE.email)}`)).json()
  assert(mails.messages?.length === 1, 'email d’invitation reçu')
  const mail = await (await fetch(`${MAILPIT}/api/v1/message/${mails.messages[0].ID}`)).json()
  const link = mail.HTML.match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&')
  const athlete = await newPage({ ...devices['iPhone 13'] })
  await athlete.goto(link)
  await athlete.getByRole('heading', { name: 'Choisis ton mot de passe' }).waitFor()
  await athlete.getByLabel('Nouveau mot de passe').fill(ATHLETE.password)
  await athlete.getByLabel('Confirme le mot de passe').fill(ATHLETE.password)
  await athlete.getByRole('button', { name: 'Enregistrer' }).click()
  await athlete.getByRole('heading', { name: /Bonjour Alex/ }).waitFor()
  assert(!(await athlete.getByRole('navigation', { name: 'Espace coach' }).count()), 'l’athlète ne voit pas l’espace coach')

  step('Suggestion de la prochaine séance et démarrage')
  await athlete.getByText('Programme : Force 5x5').waitFor()
  assert(await athlete.getByRole('button', { name: 'Démarrer Jambes' }).isVisible(), 'séance suggérée : Jambes')
  await shot(athlete, '05-accueil-athlete')
  await athlete.getByRole('button', { name: 'Démarrer Jambes' }).click()
  assert(await athlete.getByLabel('Dans quelle salle es-tu ?').inputValue() !== '', 'la salle de la séance est présélectionnée')
  await athlete.getByRole('button', { name: 'C’est parti' }).click()
  await athlete.getByRole('heading', { name: 'Jambes', level: 1 }).waitFor()
  // Les séries se chargent après le titre : on attend le premier exercice au lieu de lire son état tout de suite
  await athlete.getByRole('heading', { name: 'Squat barre' }).waitFor()
  assert(true, 'les exercices du programme sont chargés')

  step('Saisie des séries et minuteur de repos')
  const weight1 = athlete.getByLabel('Charge, Squat barre, série 1')
  assert(await weight1.inputValue() === '100', 'charge cible préremplie (100 kg)')
  await athlete.getByText('RPE 8', { exact: true }).waitFor()
  assert(true, 'RPE cible affiché sur l’exercice de force')
  await weight1.fill('102,5')
  await weight1.blur()
  await athlete.getByLabel('RPE ressenti, Squat barre, série 1').selectOption('8.5')
  assert(!(await athlete.getByLabel('RPE ressenti, Presse à cuisses, série 1').count()), 'pas de RPE sur un exercice bodybuilding sans cible')
  for (let i = 1; i <= 3; i++) await athlete.getByLabel(`Série faite, Squat barre, série ${i}`).check()
  await athlete.getByRole('timer').waitFor()
  assert(await athlete.getByRole('group', { name: 'Minuteur de repos' }).isVisible(), 'le minuteur de repos démarre')
  await shot(athlete, '06-seance-en-cours')
  await athlete.getByRole('button', { name: 'Passer' }).click()
  await athlete.getByLabel('Série faite, Presse à cuisses, série 1').check()
  await athlete.getByRole('button', { name: 'Passer' }).click()

  step('Ajout d’un exercice filtré par salle')
  await athlete.getByRole('button', { name: '+ Ajouter un exercice' }).click()
  await athlete.getByRole('searchbox').fill('presse')
  await athlete.getByRole('dialog').getByRole('button', { name: /Presse à cuisses/ }).waitFor()
  assert(true, 'la presse est proposée à la Salle Centre')
  await athlete.getByRole('searchbox').fill('curl marteau')
  await athlete.getByRole('dialog').getByRole('button', { name: /Curl marteau/ }).click()
  await athlete.getByRole('heading', { name: 'Curl marteau' }).waitFor()
  await athlete.getByLabel('Charge, Curl marteau, série 1').fill('14')
  await athlete.getByLabel('Charge, Curl marteau, série 1').blur()
  await athlete.getByLabel('Série faite, Curl marteau, série 1').check()

  step('Fin de séance')
  await athlete.getByRole('button', { name: 'Terminer la séance' }).click()
  await athlete.getByText('1 séries non cochées').waitFor()
  await athlete.getByRole('button', { name: 'Enregistrer la séance' }).click()
  await athlete.getByText('102,5 kg × 5').waitFor()
  await athlete.getByText(/1RM estimé : 119,6/).waitFor()
  await athlete.getByText('RPE 8,5 (cible 8)').waitFor()
  assert(true, 'RPE ressenti et cible conservés dans l’historique')
  assert(true, 'détail de séance avec 1RM estimé')
  await shot(athlete, '07-detail-seance')

  step('Prochaine séance suggérée = Haut du corps')
  await athlete.getByRole('link', { name: 'Accueil' }).click()
  await athlete.getByRole('button', { name: 'Démarrer Haut du corps' }).waitFor()
  assert(true, 'le cycle du programme avance')

  step('Profil : poids, 1RM et objectif')
  await athlete.getByRole('link', { name: 'Profil' }).click()
  await athlete.getByLabel('Poids (kg)').fill('82,4')
  await athlete.getByRole('form', { name: 'Ajouter une pesée' }).getByRole('button', { name: 'Ajouter' }).click()
  await athlete.getByText('Poids enregistré.').waitFor()
  await athlete.getByLabel('Exercice').last().selectOption({ label: 'Squat barre' })
  await athlete.getByLabel('1RM visé (kg)').fill('150')
  await athlete.getByRole('form', { name: 'Ajouter un objectif' }).getByRole('button', { name: 'Ajouter' }).click()
  await athlete.getByText('Objectif ajouté.').waitFor()
  await shot(athlete, '08-profil')

  step('Statistiques')
  await athlete.getByRole('link', { name: 'Stats' }).click()
  await athlete.getByRole('button', { name: '☆ Mettre en avant' }).waitFor()
  await athlete.getByLabel('Exercice', { exact: true }).selectOption({ label: 'Squat barre' })
  await athlete.getByRole('button', { name: '☆ Mettre en avant' }).click()
  await athlete.getByRole('heading', { name: 'Exercices mis en avant' }).waitFor()
  await athlete.getByText('Objectif 150 kg : 80 %').waitFor()
  assert(true, 'progression vers l’objectif affichée')
  const kpi = await athlete.locator('.kpi dd').first().textContent()
  assert(kpi === '1', 'une séance comptée sur 30 jours')
  await shot(athlete, '09-stats')

  step('Cloisonnement : l’athlète ne peut pas modifier la bibliothèque')
  await athlete.goto(`${APP}/bibliotheque`)
  await athlete.getByRole('heading', { name: /Bonjour/ }).waitFor()
  assert(true, 'la route coach redirige vers l’accueil')

  step('Le coach voit les stats de l’athlète')
  await coach.goto(`${APP}/stats`)
  await coach.getByLabel('Athlète').selectOption({ label: ATHLETE.name })
  await coach.getByRole('heading', { name: 'Exercices mis en avant' }).waitFor()
  assert(true, 'le coach consulte la progression de l’athlète')

  step('Charge calculée au RPE à partir du 1RM')
  await coach.getByRole('link', { name: 'Programmes' }).click()
  await coach.getByRole('link', { name: /Force 5x5/ }).click()
  const haut = coach.getByRole('listitem').filter({ has: coach.getByRole('heading', { name: '2. Haut du corps' }) })
  await haut.getByRole('button', { name: '+ Ajouter un exercice' }).click()
  await coach.getByLabel('Exercice').selectOption({ label: 'Squat barre' })
  await coach.getByRole('dialog').locator('label', { hasText: /^Force$/ }).click()
  assert(await coach.getByLabel('Force', { exact: true }).isChecked(), 'spécialité Force choisie')
  await coach.getByLabel('Répétitions min.').fill('5')
  await coach.getByLabel('RPE cible (facultatif)').selectOption('8')
  // 1RM estimé 119,6 kg × 81,1 % (5 reps à RPE 8) = 97 kg, arrondi à 97,5 kg
  await coach.getByRole('dialog').getByRole('status').getByText('97,5 kg').waitFor()
  await coach.getByText('Table RPE, RIR et % du 1RM').click()
  await coach.getByRole('cell', { name: /^81,1/ }).and(coach.locator('[aria-current]')).waitFor()
  assert(true, 'charge calculée depuis le 1RM et case de la table mise en avant')
  await shot(coach, '10-programme-rpe')
  await coach.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click()
  await haut.getByText('3 × 5 @ RPE 8, ≈ 97,5 kg').waitFor()
  assert(true, 'charge calculée affichée dans le programme')

  step('Réglage série par série : montée en RPE')
  await haut.getByRole('button', { name: 'Modifier' }).click()
  await coach.getByLabel('Régler série par série').check()
  await coach.getByLabel('Séries').fill('4')
  await coach.getByRole('button', { name: 'Montée en RPE (+0,5)' }).click()
  assert(await coach.getByLabel('RPE cible, série 4').inputValue() === '9.5', 'RPE 8 → 9,5 sur 4 séries')
  await coach.getByLabel('Répétitions min., série 4').fill('3')
  await coach.getByLabel('Type, série 4').selectOption('top')
  // 3 reps à RPE 9,5 = 90,7 % de 119,6 kg = 108,5 → 107,5 kg
  await coach.getByLabel('Charge calculée, série 4').getByText('107,5').waitFor()
  assert(true, 'charge calculée série par série')
  await shot(coach, '11-series-par-serie')
  await coach.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click()
  await haut.getByText('4 séries réglées une par une').waitFor()
  await haut.getByText(/3 @ RPE 9,5, ≈ 107,5/).waitFor()
  assert(true, 'plan série par série enregistré')

  step('L’athlète retrouve chaque série dans sa séance')
  await athlete.goto(APP)
  await athlete.getByRole('button', { name: 'Démarrer Haut du corps' }).click()
  await athlete.getByRole('button', { name: 'C’est parti' }).click()
  await athlete.getByRole('heading', { name: 'Squat barre' }).waitFor()
  assert(await athlete.getByLabel('Charge, Squat barre, série 1').inputValue() === '97,5', 'série 1 : 97,5 kg')
  assert(await athlete.getByLabel('Charge, Squat barre, série 4').inputValue() === '107,5', 'série 4 : 107,5 kg')
  assert(await athlete.getByLabel('Répétitions, Squat barre, série 4').inputValue() === '3', 'série 4 : 3 répétitions')
  await athlete.getByText('cible de la série 1').waitFor()
  await athlete.getByLabel('Série faite, Squat barre, série 1').check()
  await athlete.getByText('cible de la série 2').waitFor()
  assert(true, 'le RPE cible suit la prochaine série')
  await athlete.getByRole('button', { name: 'Passer' }).click()
  await shot(athlete, '12-seance-series')

  const relevant = errors.filter((e) => !e.includes('favicon'))
  assert(relevant.length === 0, `aucune erreur JavaScript${relevant.length ? ' : ' + relevant.join(' | ') : ''}`)
  console.log('\n✅ Parcours de bout en bout réussi')
} catch (error) {
  for (const [i, ctx] of browser.contexts().entries()) {
    for (const p of ctx.pages()) await p.screenshot({ path: `${SHOTS}/erreur-${i}.png`, fullPage: true }).catch(() => {})
  }
  console.error(error)
  console.error('Erreurs navigateur :', errors)
  process.exitCode = 1
} finally {
  await browser.close()
  server.kill()
}
