# Design de Muscu

Notes de design tenues à jour à chaque passe, pour ne pas refaire deux fois la même chose.

## Sujet, public, tâche principale

- **Sujet** : un carnet d’entraînement de musculation, utilisé sur le plateau, téléphone dans une main, entre deux séries.
- **Public** : des athlètes suivis par un coach, et le coach qui prépare les programmes sur ordinateur.
- **Tâche principale** : noter une série (charge, répétitions, faite) en un geste, puis savoir ce qui vient ensuite.

## Palette

Passe 3 : Youri a demandé un fond plus foncé et neutre, et une surbrillance neutre elle aussi. Le vert Deep Forest et le volt sont abandonnés.

| Nom | Hex | Rôle |
| --- | --- | --- |
| Graphite | `#141516` | Fond principal |
| Ardoise | `#1F2022` | Panneaux, barre d’onglets |
| Acier | `#2C2D30` | Contrôles secondaires |
| Blanc | `#F2F2F0` | Texte principal |
| Cendre | `#A4A7AB` | Texte secondaire (6,8:1 sur Ardoise) |
| Surbrillance | `#E6E6E3` | Action et réussite : bouton principal, série faite, minuteur |

Bordures de champs `#6C6F74` (3,2:1 sur Ardoise). Série faite `#3A3B3D`. Erreur `#FF9D8C`.

## Typographie

Une seule famille, **Archivo** (variable, axes graisse et largeur, auto-hébergée, licence OFL). La largeur porte le sens :

- **Étroite et grasse** (`font-stretch: 78%`, 800) pour les titres et tous les chiffres d’effort : charges, répétitions, minuteur, indicateurs. Chiffres tabulaires.
- **Large** (`125%`, 800) pour le nom « Muscu » seulement.
- **Normale** (`100%`, 400 à 600) pour le texte courant.

Échelle (base 16 px, d’après Bringhurst) : 14 · 16 · 18 · 24 · 36 · 48 px.

## Mise en page

Colonne unique alignée à gauche, 48 rem max. Sur téléphone, les actions principales sont pleine largeur, à portée de pouce.

```
Accueil                         Séance en cours
┌────────────────────────┐      ┌────────────────────────┐
│ Muscu            Alex  │      │ Jambes                 │
│                        │      │ Salle Centre   12 min  │
│ Prochaine séance       │      │ ▓▓▓▓▓▓▓░░░░  3 sur 5   │
│ JAMBES (titre 48 px)   │      │                        │
│ Programme : Force 5x5  │      │ Squat barre            │
│ Squat barre      3 × 5 │      │ Dernière fois 100 × 5  │
│ Presse          2 × 10 │      │  1  [102,5] [ 5 ] [✓]  │
│ [ Démarrer Jambes    ] │      │  2  [100  ] [ 5 ] [ ]  │
│ Séance libre           │      │  + Ajouter une série   │
│                        │      │                        │
│ Dernières séances      │      │ ┌ Repos 1:31 ───────┐  │
│ Jambes     1 h 05  24  │      │ └ −15 s +15 s Passer┘  │
└────────────────────────┘      └────────────────────────┘
```

## Principes

1. **Les chiffres sont le héros.** Charges, répétitions et repos s’affichent grands, étroits, tabulaires. C’est l’endroit où le design ose.
2. **La surbrillance veut dire « agir » ou « fait ».** Bouton principal, série validée, minuteur, onglet actif. Jamais en décoration.
3. **La hiérarchie vient du ton, pas des cadres.** Fond, panneau, contrôle : trois tons de gris. Pas d’ombre, sauf le minuteur qui flotte. Rayons différents selon le niveau (panneau 20 px, ligne 12 px, champ 10 px, bouton en pilule).
4. **Pas de chaînes « A · B · C ».** Les métadonnées sont posées en colonnes ou en lignes séparées.
5. **Mouvement seulement en réponse à un geste** : validation d’une série, ouverture d’une boîte de dialogue. Respect de `prefers-reduced-motion`.

## Revue du plan face au brief

- *Fond sombre + un seul accent vert acide* est un réflexe connu. Le fond est imposé par le brief, donc on le garde, mais le volt est restreint aux actions et aux séries faites pour qu’il signifie quelque chose. Le logo passe en Craie, en Archivo large, sans capitales.
- *Kit de cartes identiques* : la version précédente encadrait tout. Remplacé par des panneaux tonaux sans bordure et des listes en lignes.
- *Police système* : remplacée par Archivo, choisie pour son axe de largeur qui rappelle les tableaux d’affichage de salle et les maillots.

## Historique des passes

- **Passe 1 (palette)** : Deep Forest + volt, police système, cartes bordées partout.
- **Passe 2** : Archivo, chiffres étroits, volt réservé à l’action, panneaux tonaux, lignes de série en grand format, minuteur avec jauge.
- **Passe 3** : palette graphite neutre et surbrillance blanc cassé, à la demande de Youri (le vert ne lui convenait pas). Typographie et mise en page inchangées.
