# Design de Praug

Notes de design tenues à jour à chaque passe, pour ne pas refaire deux fois la même chose.

## Sujet, public, tâche principale

- **Praug** : à la fois le prénom d’un assistant et un clin d’œil à « prog » (programmation).
- **Sujet** : un carnet d’entraînement de musculation, utilisé sur le plateau, téléphone en main, entre deux séries.
- **Public** : des athlètes suivis par un coach, et le coach qui prépare les programmes sur ordinateur.
- **Tâche principale** : noter une série en un geste, savoir quoi charger sur la barre et ce qui vient ensuite.

## Brief de Youri (passe 4)

- Salle idéale : un hangar brut mais propre, avec de belles machines.
- Références : Gymshark (fitness performance), Nike running performance.
- Fond foncé, ton entre sobre et brut/direct.
- Direction choisie : « Disques calibrés ».

## Inspirations de Youri (passe 6)

- **Typographie « Aveton »** : sans-serif géométrique arrondie et lourde, sur fond noir traversé de volutes de soie cuivre et orange. Elle donne la police, les effets (lueurs, dégradés) et les couleurs.
- **Application d’entraînement sombre** : tuiles de verre arrondies en grille, anneaux de progression, calendrier en points, boutons ronds, barre d’onglets flottante. On en garde l’esprit, pas le contenu.
- **Tableau de bord en verre dépoli** : cartes givrées, carte objectif en dégradé avec jauge, bouton « + » central flottant.

## Palette

| Nom | Hex | Rôle |
| --- | --- | --- |
| Noir | `#0B0A0A` | Fond principal, avec deux lueurs cuivre fixes en arrière-plan |
| Verre | blanc 4 à 9 % | Cartes et tuiles, flou 24 px, bord blanc 10 %, reflet intérieur |
| Texte | `#F4F1EE` | Texte principal (blanc chaud) |
| Texte 2 | `#A9A29C` | Texte secondaire |
| Cuivre clair | `#F6A65D` | Début du dégradé, liens actifs |
| Cuivre | `#E8813A` | Accent principal |
| Cuivre foncé | `#B5461B` | Fin du dégradé |
| Braise | `#6B250C` | Lueurs de fond |

Le **dégradé cuivre** (135°, clair → cuivre → foncé) est réservé à l’action et à la progression : bouton principal, bouton séance central, anneaux, jauges, séries faites, jours entraînés.
Les couleurs des disques calibrés restent **réservées aux charges** (schéma de barre) :
rouge 25 kg `#E23A2E`, bleu 20 kg `#2F6BF0`, jaune 15 kg `#F4C21B`, vert 10 kg `#23A55A`, blanc 5 kg `#E9E9E6`.

## Typographie

- **Outfit** (variable, 300 à 800) pour tout : géométrique et arrondie, dans l’esprit de la typographie Aveton. Titres en 700 serrés (approche négative), chiffres d’effort en grand, texte courant en 400.
- Polices auto-hébergées, licence OFL.

## Motifs

1. **Le verre** : cartes, tuiles, lignes de séance et barre d’onglets sont des plaques de verre dépoli aux angles très arrondis (26 px pour les tuiles, 18 px pour les lignes).
2. **La grille de tuiles** (accueil) : la séance du jour en grande tuile, puis poids de corps, volume de la semaine et régularité.
3. **L’anneau de progression** : séance N sur le cycle du programme à l’accueil, séries faites pendant la séance.
4. **Le calendrier en points** : 13 semaines, un point par jour, allumé en cuivre les jours d’entraînement.
5. **La barre d’onglets flottante** : une capsule de verre, icônes seules, et le bouton séance au centre en disque cuivre.
6. **La barre chargée** : schéma des disques à mettre de chaque côté pour les mouvements à la barre.
7. **Boutons en pilules** : verre pour le secondaire, dégradé cuivre lumineux pour l’action principale. Les actions tertiaires restent du texte souligné cuivre.
8. Pas de chaînes « A · B · C ». Mouvement seulement en réponse à un geste, et coupé si l’utilisateur réduit les animations.

## Historique des passes

- **Passe 1** : Deep Forest + volt, police système, cartes bordées partout.
- **Passe 2** : Archivo, chiffres étroits, volt réservé à l’action, panneaux tonaux, lignes de série en grand format, minuteur avec jauge.
- **Passe 3** : palette graphite neutre, surbrillance blanc cassé. Jugé « trop IA, lisse, sans identité ».
- **Passe 4** : Praug. Disques calibrés, Big Shoulders et pochoir, schéma de barre chargée, piste de séries.
- **Passe 5** : encadrés, boutons et police jugés encore génériques. Coin coupé, angles vifs, boutons en capitales, champs soulignés, Familjen Grotesk, numéros de poste, bande moletée.
- **Passe 6** : d’après trois inspirations fournies par Youri. Outfit, noir et cuivre, verre dépoli, tuiles, anneaux, calendrier en points, barre d’onglets flottante, nouvelle icône.
- **Passe 7** : connexion et choix du mot de passe alignés sur l’app (marque avec point cuivre, titre en deux tons, barre chargée en signature, carte de verre). Menu coach en menu déroulant sur téléphone. Séances d’un programme et exercices d’une séance repliables. Encadré « Consignes » cuivré en séance.
