# Batimatch

**Consultations d'entreprises pour le BTP : DPGF en ligne, réponses des entreprises, comparatif et aide à la décision.**

L'acheteur crée un projet et ses lots (une DPGF et une date de rendu par lot) puis partage le code du projet.
Les entreprises s'inscrivent, saisissent le code et répondent en ligne. Le comparatif et l'aide à la
décision se construisent automatiquement.

En ligne : https://batimatch.paceapp.fr/

## Parcours

### Acheteur
- **Projets** avec code d'accès à 6 caractères, lien d'invitation et message prêt à envoyer.
- **Lots** : DPGF (collage depuis Excel, chapitres, PSE), date de rendu, budget objectif (jamais visible des entreprises).
- **Offres** : celles envoyées par les entreprises arrivent seules ; on peut aussi saisir une offre reçue par mail
  ou une version négociée. Contact, logo, réserves et message de l'entreprise sont affichés.
- **Comparatif** : remise à niveau des lignes non chiffrées, écarts au budget, prix anormaux, carte des écarts par
  chapitre, détail ligne à ligne, postes qui pèsent 80 %, évolution des versions.
- **Décision** : podium multicritère, critères pondérés personnalisables (prix et délai notés automatiquement,
  critères qualitatifs notés sur 20), fiche par entreprise (points forts / de vigilance), avis (favori, à négocier,
  écartée), commentaires internes, choix de l'offre retenue.
- **Synthèse à présenter** : note imprimable ou en PDF pour faire valider le choix.

### Entreprise
- Inscription (nom, prénom, entreprise, téléphone, email) et logo affiché à côté du nom de l'entreprise.
- Accès à un projet par son code ou par le lien d'invitation.
- Réponse lot par lot : prix unitaires (saisie au clavier ou collage Excel), variantes et options, délai, validité,
  réserves, message. Brouillon enregistré au fil de l'eau, offre modifiable jusqu'à la date de rendu.

## Technique

- React 19, TypeScript, Vite, Tailwind CSS 4, Zustand.
- **Supabase** : authentification, base Postgres avec règles RLS, stockage des logos.
  Installation : voir [`supabase/README.md`](supabase/README.md).
- Déploiement GitHub Pages à chaque push sur `main` (`.github/workflows/pages.yml`).

```bash
npm install
npm run dev        # application branchée sur Supabase
npm run dev:demo   # mode démonstration : données dans le navigateur, sans Supabase
npm test           # moteur de calcul + règles de sécurité de la base
npm run build
```

Le mode démonstration est aussi accessible en ligne en ajoutant `?demo` à l'adresse.

## Organisation du code

```
supabase/schema.sql   tables, règles RLS, stockage des logos, rejoindre un projet par code
src/data/             client Supabase, backend de démonstration, synchronisation automatique
src/lib/              calc (comparatif), decision (notation multicritère), parse (Excel), types
src/pages/            Connexion, Projets, Projet, Lot (DPGF, Offres, Comparatif, Décision, Synthèse), Réponse entreprise
src/components/       interface, graphiques
```
