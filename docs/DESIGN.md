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

## Palette

| Nom | Hex | Rôle |
| --- | --- | --- |
| Hangar | `#101112` | Fond principal |
| Béton | `#1B1C1E` | Panneaux, barre d’onglets |
| Acier | `#2A2B2E` | Contrôles secondaires |
| Blanc | `#F2F2EF` | Texte principal, bouton principal, série faite |
| Cendre | `#A2A5A9` | Texte secondaire |

Les couleurs des disques calibrés sont **réservées aux charges** (schéma de barre, marque) :
rouge 25 kg `#E23A2E`, bleu 20 kg `#2F6BF0`, jaune 15 kg `#F4C21B`, vert 10 kg `#23A55A`, blanc 5 kg `#E9E9E6`.
Les petits disques reprennent la même couleur (2,5 rouge, 2 bleu, 1,5 jaune, 1 vert, 0,5 blanc).

## Typographie

- **Big Shoulders Stencil** (900) : la marque PRAUG et le nom de la prochaine séance, comme un marquage au pochoir sur un mur de hangar.
- **Big Shoulders** (700 à 850) : titres et tous les chiffres d’effort. Les titres de page sont en capitales, à la manière des affiches Nike.
- **Familjen Grotesk** : le texte courant (passe 5), pour ses formes singulières (a à un étage, pièges à encre) à la place d'Archivo jugée trop générique.

Polices auto-hébergées, licence OFL.

## Motifs

1. **La barre chargée** : pour les mouvements à la barre olympique, un schéma montre les disques à mettre de chaque côté (« 25 + 15 par côté »), calculé à partir de la charge. Il se met à jour dès que la charge change.
2. **La piste de séries** : une case par série de la séance, remplie quand la série est faite.
3. **Le noir et blanc d’abord** : l’interface reste noir, gris et blanc. La couleur n’apparaît que là où elle porte une information (le poids d’un disque).
4. **Le coin coupé** : panneaux et boutons ont des angles vifs et un coin coupé en haut à droite, comme une plaque d’acier découpée. Pas de cartes arrondies.
5. **Les boutons comme un marquage** : capitales Big Shoulders, espacées. Les actions secondaires restent du texte souligné.
6. **Champs soulignés** et cases carrées. Onglets avec une barre pleine sous l’onglet actif.
7. **Numéros de poste** (01, 02…) devant les exercices d’une séance : c’est une vraie séquence.
8. **Bande moletée** en tête de la séance du jour, comme la prise d’une barre (seul motif décoratif).
9. Pas de chaînes « A · B · C ». Mouvement seulement en réponse à un geste.

## Historique des passes

- **Passe 1** : Deep Forest + volt, police système, cartes bordées partout.
- **Passe 2** : Archivo, chiffres étroits, volt réservé à l’action, panneaux tonaux, lignes de série en grand format, minuteur avec jauge.
- **Passe 3** : palette graphite neutre, surbrillance blanc cassé. Jugé « trop IA, lisse, sans identité ».
- **Passe 4** : Praug. Disques calibrés, Big Shoulders et pochoir, schéma de barre chargée, piste de séries.
- **Passe 5** : encadrés, boutons et police jugés encore génériques. Coin coupé, angles vifs, boutons en capitales, champs soulignés, Familjen Grotesk, numéros de poste, bande moletée.
