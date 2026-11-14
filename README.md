# Batimatch

**DPGF, saisie rapide des offres et comparatif décisionnel pour les consultations BTP.**

Batimatch sert à mener une consultation d'entreprises de bout en bout : on saisit le DPGF, on tape (ou on colle) les prix
unitaires de chaque offre reçue, et l'application produit le comparatif qui aide à arbitrer : classement, écarts au
budget, prix anormaux, lignes oubliées, variantes, notes pondérées.

> MVP. Les données sont enregistrées dans le navigateur (localStorage). Pensez à exporter une sauvegarde JSON.

## Ce que fait l'application

### 1. DPGF
- Chapitres et lignes : n°, désignation, unité, quantité.
- Lignes de **base** ou **PSE** (prestations supplémentaires éventuelles, intégrables au comparatif à la demande).
- **Collage depuis Excel** : Batimatch reconnaît les colonnes (n°, désignation, unité, quantité) et crée les chapitres.
- Renumérotation automatique, export d'un **DPGF vierge (CSV)** à envoyer aux entreprises.
- Date limite de remise des offres et budget objectif du lot.

### 2. Offres
- Une offre par entreprise, avec **plusieurs versions** (V1 initiale, V2 après négociation…) : le comparatif retient la
  dernière, et mesure le gain obtenu.
- Grille de saisie pensée pour la vitesse : `Entrée` / `↓` pour passer à la ligne suivante, `i` pour « inclus »,
  collage d'une colonne Excel directement dans une case (remplit les lignes suivantes, avec annulation).
- Contrôle en direct : chaque prix est comparé à la médiane des autres entreprises (faute de frappe, oubli d'unité).
- Remise commerciale, délai d'exécution, validité, note technique /20, réserves et exclusions.
- **Variantes** (écart par rapport à la base, négatif si économie) et **options** (plus-values hors DPGF), à intégrer ou
  non au comparatif.

### 3. Comparatif
- **Verdict** : moins-disant après remise à niveau, écart au 2e et à la moyenne, tenue du budget.
- **Remise à niveau** des lignes non chiffrées (au prix médian ou au plus haut) pour comparer des périmètres identiques :
  l'offre qui paraît la moins chère parce qu'elle a oublié des lignes est démasquée.
- **Indicateurs** : écart 1er/2e, moins-disant vs budget, dispersion, potentiel de négociation (optimum théorique ligne à
  ligne), lignes non chiffrées, gain des négociations.
- **Points de vigilance** générés automatiquement : oublis, offres expirées, réserves, prix hors norme (±30 % de la
  médiane), lignes déclarées « incluses » qui pèsent lourd, offres anormalement basses.
- **Note globale** pondérée prix / technique (note prix = 20 × offre la plus basse ÷ offre).
- Synthèse par entreprise, carte des écarts **par chapitre**, **détail ligne à ligne** (meilleur prix surligné, filtres
  prix anormaux / non chiffrés), **postes qui pèsent 80 %** du montant, évolution des versions.
- Décision : « Retenir cette offre ». Export CSV (Excel, format français) et impression / PDF.

Un **exemple complet** (lot VRD, trois entreprises fictives) se charge depuis l'accueil.

## Démarrer

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # tests du moteur de calcul
npm run build    # version de production dans dist/
```

Le dossier `dist/` est statique (routes en `#/…`) : il se déploie tel quel sur Netlify, Vercel ou n'importe quel
hébergement de fichiers. À chaque push sur `main`, le workflow `.github/workflows/pages.yml` teste, construit et publie
l'application sur GitHub Pages (Settings → Pages → Source : « GitHub Actions »).

## Organisation du code

```
src/
  lib/
    types.ts      modèle : consultation, lignes DPGF, offres, variantes, réglages
    calc.ts       moteur d'analyse : totaux, remise à niveau, médianes, anomalies, notes, Pareto, vigilance
    parse.ts      lecture des nombres « à la française » et des collages Excel
    io.ts         sauvegarde / import JSON, export CSV du DPGF et du comparatif
    demo.ts       consultation d'exemple
  store.ts        état de l'application (Zustand, persistance locale)
  pages/          Accueil, DPGF, Offres, Saisie d'une offre, Comparatif
  components/     composants d'interface et graphiques
```

Stack : React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, Vitest. Graphiques en HTML/SVG natifs, sans dépendance.

## Pistes pour la suite

- Comptes et base partagée (Supabase) pour travailler à plusieurs et retrouver ses consultations sur tous ses appareils.
- Lien de réponse envoyé aux entreprises : elles remplissent leurs prix elles-mêmes.
- Import natif des DPGF et offres au format `.xlsx`, export Excel mis en forme et rapport d'analyse PDF.
- Quantités re-métrées par l'entreprise (comparaison « nos quantités » / « leurs quantités »).
- Alimentation d'une base de prix à partir des offres reçues.
