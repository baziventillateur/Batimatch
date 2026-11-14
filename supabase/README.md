# Installer la base Supabase de Batimatch

À faire une seule fois, dans le projet Supabase `batimatch`.

## 1. Créer les tables et les règles d'accès

1. Ouvrez **SQL Editor → New query**.
2. Copiez tout le contenu de [`schema.sql`](./schema.sql), collez-le, puis cliquez sur **Run**.
3. Le message « Success. No rows returned » confirme l'installation.

Le script peut être relancé sans risque après une mise à jour : il ne supprime aucune donnée.

## 2. Régler l'authentification

**Authentication → URL Configuration**

- *Site URL* : `https://baziventillateur.github.io/Batimatch/`
- *Redirect URLs* : ajoutez la même adresse (et `http://localhost:5173/` pour le développement).

**Authentication → Sign In / Providers → Email**

- Pour tester rapidement, désactivez **Confirm email** : les comptes sont utilisables tout de suite.
- En production, réactivez-le et configurez un service d'envoi d'emails (SMTP) : le service intégré de
  Supabase n'envoie que quelques emails par heure.

## Ce que garantissent les règles (RLS)

- Une entreprise ne voit un projet qu'après avoir saisi son code d'accès.
- Elle ne voit ni le budget, ni les offres des autres entreprises, ni les notes et commentaires internes.
- Son brouillon reste invisible de l'acheteur jusqu'à l'envoi ; elle peut modifier son offre jusqu'à la
  date de rendu (heure de Paris), puis l'offre est verrouillée.
- L'acheteur ne peut pas modifier une offre déposée par une entreprise ; il peut saisir des offres reçues
  par mail (offres « manuelles »).
- Chaque utilisateur ne peut déposer de logo que dans son propre dossier.

Ces règles sont vérifiées par `supabase/test/rls.test.mjs` (`npm test`), sur un Postgres local qui simule
Supabase.
