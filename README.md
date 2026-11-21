# Praug : programmation et suivi d'entraînement coach / athlètes

Application web (PWA installable sur téléphone) pour construire des programmes de musculation, suivre les séances en direct et visualiser la progression.

## Fonctions

| Partie | Contenu |
| --- | --- |
| **Comptes et rôles** | Administrateur et coach : tous les droits. Athlète : ses propres données et les programmes qui lui sont attribués. Pas d'inscription publique : le coach invite ses athlètes par email. Le premier compte créé devient administrateur. |
| **Bibliothèque** | Exercices (muscle principal, consignes, « machine requise »), salles, machines avec marque et type. Un exercice lié à une machine n'est proposé que dans les salles qui la possèdent. 34 exercices courants sont fournis au départ. |
| **Programmation** | Programmes attribués à un athlète (ou modèles), séances ordonnées formant un cycle, séances spécifiques à une salle, exercices avec séries, répétitions (fourchette), charge cible, repos et machine. Duplication d'un programme. |
| **Séance en cours** | Suggestion de la prochaine séance du cycle, ou séance libre. Choix de la salle au démarrage. Charges préremplies (cible ou dernière charge), saisie des séries, minuteur de repos, ajout d'exercices filtrés par salle, intensité ressentie (RPE) en fin de séance. |
| **Statistiques** | Séances sur 30 jours, durée moyenne, intensité moyenne, volume moyen. Courbes par exercice (1RM estimé, charge max, volume), exercices mis en avant, progression vers l'objectif. |
| **Profil athlète** | Évolution du poids, 1RM testés, objectifs par mouvement (ex. squat à 150 kg). Le coach peut consulter le profil, l'historique et les stats de chaque athlète. |

## Stack

- **Front** : React 19, TypeScript, Vite, React Router, TanStack Query, Recharts, PWA (vite-plugin-pwa).
- **Back** : [Supabase](https://supabase.com) (PostgreSQL, authentification, règles RLS par rôle, une fonction serveur pour les invitations).
- Bonnes pratiques web suivies avec les guides [Modern Web Guidance](https://developer.chrome.com/docs/modern-web-guidance) de Chrome : `<dialog>` natif, thème clair/sombre avec `light-dark()`, cibles tactiles de 44 px, zones de sécurité des écrans, `Temporal` (avec polyfill chargé seulement si besoin), formulaires accessibles.

## Démarrer en local

Prérequis : Node 22+, Docker (pour Supabase en local).

```sh
npm install
npx supabase start          # base, auth, emails de test (http://127.0.0.1:54324)
cp .env.example .env.local  # puis colle l'URL API et la clé "anon" affichées par la commande précédente
npm run dev                 # http://127.0.0.1:5173
```

Crée ton compte administrateur dans Supabase Studio local (Authentication > Add user) ou avec l'API admin : le premier compte devient automatiquement administrateur.

## Tests

```sh
npm run typecheck   # TypeScript
npm run lint        # oxlint
npm test            # tests unitaires (Vitest)
npm run test:db     # règles de sécurité de la base (Supabase local démarré)
npm run build && npm run test:e2e   # parcours complet coach puis athlète dans Chromium (réinitialise la base locale)
```

## Mise en production

1. **Supabase** : crée un projet sur [supabase.com](https://supabase.com) (offre gratuite).
2. Relie le dépôt et applique le schéma :
   ```sh
   npx supabase login
   npx supabase link --project-ref <ref-du-projet>
   npx supabase db push
   npx supabase functions deploy invite-athlete
   ```
3. Dans le tableau de bord Supabase :
   - **Authentication > Sign In / Providers** : désactive « Allow new users to sign up ».
   - **Authentication > URL Configuration** : mets l'URL du site (ex. `https://muscu.vercel.app`) dans *Site URL* et dans *Redirect URLs*.
   - **Authentication > Users > Add user** : crée ton compte. C'est le premier, il devient administrateur.
   - Pour envoyer de vrais emails d'invitation en volume, configure un SMTP (Authentication > Emails > SMTP Settings).
4. **Vercel** : importe le dépôt GitHub, framework « Vite », et ajoute les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Supabase > Project Settings > API). Le fichier `vercel.json` gère les routes de l'application.

La clé « anon » est publique par conception : la sécurité repose sur les règles RLS de la base. Ne mets jamais la clé `service_role` dans le front.

## Organisation du code

```
src/
  pages/          un fichier par écran
  components/     dialogues, minuteur, graphique…
  lib/            client Supabase, authentification, requêtes, dates, nombres
supabase/
  migrations/     schéma, règles de sécurité, vues de statistiques, exercices de départ
  functions/      invite-athlete (invitation par email, réservée au staff)
  tests/          tests SQL des règles de sécurité
e2e/              parcours de bout en bout (Playwright)
```
