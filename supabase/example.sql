-- ═══════════════════════════════════════════════════════════════════════════
-- Batimatch : projet exemple (entreprises fictives et modèle du projet)
-- Fichier généré depuis src/lib/example.ts par src/lib/example.test.ts : ne pas le modifier à la main
-- (après une modification de l'exemple : npx vitest run -u).
-- À exécuter après schema.sql, dans Supabase → SQL Editor. Peut être relancé sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- Comptes des entreprises fictives : sans mot de passe, adresse non confirmée et bloqués jusqu'en 2999.
-- Personne ne peut s'y connecter ; ils servent seulement d'auteurs aux offres de l'exemple.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at, banned_until, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'claire.morel@vexin-tp.example', '', '{"provider":"email","providers":["email"]}', '{"role":"company","first_name":"Claire","last_name":"Morel","company_name":"Vexin TP","phone":"01 99 00 10 01"}', now(), now(), '2999-12-31 00:00:00+00', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'karim.benali@reseaux-parisis.example', '', '{"provider":"email","providers":["email"]}', '{"role":"company","first_name":"Karim","last_name":"Benali","company_name":"Réseaux du Parisis","phone":"01 99 00 10 02"}', now(), now(), '2999-12-31 00:00:00+00', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'hugo.perrin@atlas-voirie.example', '', '{"provider":"email","providers":["email"]}', '{"role":"company","first_name":"Hugo","last_name":"Perrin","company_name":"Atlas Voirie","phone":"01 99 00 10 03"}', now(), now(), '2999-12-31 00:00:00+00', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'nathalie.garnier@batisseurs-oise.example', '', '{"provider":"email","providers":["email"]}', '{"role":"company","first_name":"Nathalie","last_name":"Garnier","company_name":"Bâtisseurs de l’Oise","phone":"01 99 00 20 01"}', now(), now(), '2999-12-31 00:00:00+00', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'paulo.fernandes@maconnerie-fernandes.example', '', '{"provider":"email","providers":["email"]}', '{"role":"company","first_name":"Paulo","last_name":"Fernandes","company_name":"Maçonnerie Fernandes","phone":"01 99 00 20 02"}', now(), now(), '2999-12-31 00:00:00+00', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'thomas.lebrun@structures-seine.example', '', '{"provider":"email","providers":["email"]}', '{"role":"company","first_name":"Thomas","last_name":"Lebrun","company_name":"Structures Seine Béton","phone":"01 99 00 20 03"}', now(), now(), '2999-12-31 00:00:00+00', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'kevin.roux@bati-express.example', '', '{"provider":"email","providers":["email"]}', '{"role":"company","first_name":"Kevin","last_name":"Roux","company_name":"Bati-Express 95","phone":"01 99 00 20 04"}', now(), now(), '2999-12-31 00:00:00+00', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'michel.dumas@constructions-dumas.example', '', '{"provider":"email","providers":["email"]}', '{"role":"company","first_name":"Michel","last_name":"Dumas","company_name":"Constructions Dumas","phone":"01 99 00 20 05"}', now(), now(), '2999-12-31 00:00:00+00', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'sophie.marchand@toits-terrasses.example', '', '{"provider":"email","providers":["email"]}', '{"role":"company","first_name":"Sophie","last_name":"Marchand","company_name":"Toits & Terrasses","phone":"01 99 00 30 01"}', now(), now(), '2999-12-31 00:00:00+00', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-0000-4000-8000-000000000010', 'authenticated', 'authenticated', 'julien.faure@hydro-toit.example', '', '{"provider":"email","providers":["email"]}', '{"role":"company","first_name":"Julien","last_name":"Faure","company_name":"Hydro-Toit","phone":"01 99 00 30 02"}', now(), now(), '2999-12-31 00:00:00+00', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'antoine.lemoine@couverture-lemoine.example', '', '{"provider":"email","providers":["email"]}', '{"role":"company","first_name":"Antoine","last_name":"Lemoine","company_name":"Couverture Lemoine","phone":"01 99 00 30 03"}', now(), now(), '2999-12-31 00:00:00+00', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'ines.haddad@alu-concept.example', '', '{"provider":"email","providers":["email"]}', '{"role":"company","first_name":"Inès","last_name":"Haddad","company_name":"Alu Concept Menuiseries","phone":"01 99 00 50 01"}', now(), now(), '2999-12-31 00:00:00+00', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-0000-4000-8000-000000000013', 'authenticated', 'authenticated', 'mehdi.saidi@platrerie-francilienne.example', '', '{"provider":"email","providers":["email"]}', '{"role":"company","first_name":"Mehdi","last_name":"Saidi","company_name":"Plâtrerie Francilienne","phone":"01 99 00 70 01"}', now(), now(), '2999-12-31 00:00:00+00', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-0000-4000-8000-000000000014', 'authenticated', 'authenticated', 'elodie.bertin@cloisons-bertin.example', '', '{"provider":"email","providers":["email"]}', '{"role":"company","first_name":"Élodie","last_name":"Bertin","company_name":"Cloisons Bertin","phone":"01 99 00 70 02"}', now(), now(), '2999-12-31 00:00:00+00', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-0000-4000-8000-000000000015', 'authenticated', 'authenticated', 'romain.girard@elec-lumiere.example', '', '{"provider":"email","providers":["email"]}', '{"role":"company","first_name":"Romain","last_name":"Girard","company_name":"Elec Lumière Services","phone":"01 99 00 11 01"}', now(), now(), '2999-12-31 00:00:00+00', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-0000-4000-8000-000000000016', 'authenticated', 'authenticated', 'camille.noel@voltais.example', '', '{"provider":"email","providers":["email"]}', '{"role":"company","first_name":"Camille","last_name":"Noël","company_name":"Voltaïs Électricité","phone":"01 99 00 11 02"}', now(), now(), '2999-12-31 00:00:00+00', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-0000-4000-8000-000000000017', 'authenticated', 'authenticated', 'david.lambert@courant-continu.example', '', '{"provider":"email","providers":["email"]}', '{"role":"company","first_name":"David","last_name":"Lambert","company_name":"Courant Continu","phone":"01 99 00 11 03"}', now(), now(), '2999-12-31 00:00:00+00', '', '', '', '')
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = '',
  raw_user_meta_data = excluded.raw_user_meta_data,
  banned_until = excluded.banned_until;

-- Profils (avec les logos de public/exemple/logos)
insert into public.profiles (id, role, email, first_name, last_name, company_name, phone, logo_url)
values
  ('e0e0e0e0-0000-4000-8000-000000000001', 'company', 'claire.morel@vexin-tp.example', 'Claire', 'Morel', 'Vexin TP', '01 99 00 10 01', 'exemple/logos/vexin-tp.svg'),
  ('e0e0e0e0-0000-4000-8000-000000000002', 'company', 'karim.benali@reseaux-parisis.example', 'Karim', 'Benali', 'Réseaux du Parisis', '01 99 00 10 02', 'exemple/logos/reseaux-parisis.svg'),
  ('e0e0e0e0-0000-4000-8000-000000000003', 'company', 'hugo.perrin@atlas-voirie.example', 'Hugo', 'Perrin', 'Atlas Voirie', '01 99 00 10 03', 'exemple/logos/atlas-voirie.svg'),
  ('e0e0e0e0-0000-4000-8000-000000000004', 'company', 'nathalie.garnier@batisseurs-oise.example', 'Nathalie', 'Garnier', 'Bâtisseurs de l’Oise', '01 99 00 20 01', 'exemple/logos/batisseurs-oise.svg'),
  ('e0e0e0e0-0000-4000-8000-000000000005', 'company', 'paulo.fernandes@maconnerie-fernandes.example', 'Paulo', 'Fernandes', 'Maçonnerie Fernandes', '01 99 00 20 02', 'exemple/logos/maconnerie-fernandes.svg'),
  ('e0e0e0e0-0000-4000-8000-000000000006', 'company', 'thomas.lebrun@structures-seine.example', 'Thomas', 'Lebrun', 'Structures Seine Béton', '01 99 00 20 03', 'exemple/logos/structures-seine.svg'),
  ('e0e0e0e0-0000-4000-8000-000000000007', 'company', 'kevin.roux@bati-express.example', 'Kevin', 'Roux', 'Bati-Express 95', '01 99 00 20 04', 'exemple/logos/bati-express.svg'),
  ('e0e0e0e0-0000-4000-8000-000000000008', 'company', 'michel.dumas@constructions-dumas.example', 'Michel', 'Dumas', 'Constructions Dumas', '01 99 00 20 05', 'exemple/logos/constructions-dumas.svg'),
  ('e0e0e0e0-0000-4000-8000-000000000009', 'company', 'sophie.marchand@toits-terrasses.example', 'Sophie', 'Marchand', 'Toits & Terrasses', '01 99 00 30 01', 'exemple/logos/toits-terrasses.svg'),
  ('e0e0e0e0-0000-4000-8000-000000000010', 'company', 'julien.faure@hydro-toit.example', 'Julien', 'Faure', 'Hydro-Toit', '01 99 00 30 02', 'exemple/logos/hydro-toit.svg'),
  ('e0e0e0e0-0000-4000-8000-000000000011', 'company', 'antoine.lemoine@couverture-lemoine.example', 'Antoine', 'Lemoine', 'Couverture Lemoine', '01 99 00 30 03', 'exemple/logos/couverture-lemoine.svg'),
  ('e0e0e0e0-0000-4000-8000-000000000012', 'company', 'ines.haddad@alu-concept.example', 'Inès', 'Haddad', 'Alu Concept Menuiseries', '01 99 00 50 01', 'exemple/logos/alu-concept.svg'),
  ('e0e0e0e0-0000-4000-8000-000000000013', 'company', 'mehdi.saidi@platrerie-francilienne.example', 'Mehdi', 'Saidi', 'Plâtrerie Francilienne', '01 99 00 70 01', 'exemple/logos/platrerie-francilienne.svg'),
  ('e0e0e0e0-0000-4000-8000-000000000014', 'company', 'elodie.bertin@cloisons-bertin.example', 'Élodie', 'Bertin', 'Cloisons Bertin', '01 99 00 70 02', 'exemple/logos/cloisons-bertin.svg'),
  ('e0e0e0e0-0000-4000-8000-000000000015', 'company', 'romain.girard@elec-lumiere.example', 'Romain', 'Girard', 'Elec Lumière Services', '01 99 00 11 01', 'exemple/logos/elec-lumiere.svg'),
  ('e0e0e0e0-0000-4000-8000-000000000016', 'company', 'camille.noel@voltais.example', 'Camille', 'Noël', 'Voltaïs Électricité', '01 99 00 11 02', 'exemple/logos/voltais.svg'),
  ('e0e0e0e0-0000-4000-8000-000000000017', 'company', 'david.lambert@courant-continu.example', 'David', 'Lambert', 'Courant Continu', '01 99 00 11 03', 'exemple/logos/courant-continu.svg')
on conflict (id) do update set
  role = excluded.role,
  email = excluded.email,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  company_name = excluded.company_name,
  phone = excluded.phone,
  logo_url = excluded.logo_url;

-- Modèle copié par open_example_project() (dates en jours par rapport au jour de la copie)
insert into public.example_template (id, data, updated_at)
values (1, $exemple${
 "project": {
  "name": "Résidence Le Clos des Lilas",
  "reference": "Léon Grosse – affaire 26-031",
  "description": "Construction de 18 logements collectifs (R+3 sur sous-sol) à Pontoise (95). Entreprise générale : Léon Grosse.\n\nProjet exemple : entreprises, contacts et montants fictifs. Rien n’est envoyé aux entreprises ; modifiez-le librement."
 },
 "members": [
  {
   "user_id": "e0e0e0e0-0000-4000-8000-000000000001",
   "joined": -41
  },
  {
   "user_id": "e0e0e0e0-0000-4000-8000-000000000002",
   "joined": -40
  },
  {
   "user_id": "e0e0e0e0-0000-4000-8000-000000000003",
   "joined": -39
  },
  {
   "user_id": "e0e0e0e0-0000-4000-8000-000000000004",
   "joined": -31
  },
  {
   "user_id": "e0e0e0e0-0000-4000-8000-000000000005",
   "joined": -29
  },
  {
   "user_id": "e0e0e0e0-0000-4000-8000-000000000006",
   "joined": -30
  },
  {
   "user_id": "e0e0e0e0-0000-4000-8000-000000000007",
   "joined": -16
  },
  {
   "user_id": "e0e0e0e0-0000-4000-8000-000000000008",
   "joined": -28
  },
  {
   "user_id": "e0e0e0e0-0000-4000-8000-000000000009",
   "joined": -14
  },
  {
   "user_id": "e0e0e0e0-0000-4000-8000-000000000010",
   "joined": -13
  },
  {
   "user_id": "e0e0e0e0-0000-4000-8000-000000000011",
   "joined": -2
  },
  {
   "user_id": "e0e0e0e0-0000-4000-8000-000000000012",
   "joined": -25
  },
  {
   "user_id": "e0e0e0e0-0000-4000-8000-000000000013",
   "joined": -11
  },
  {
   "user_id": "e0e0e0e0-0000-4000-8000-000000000014",
   "joined": -10
  },
  {
   "user_id": "e0e0e0e0-0000-4000-8000-000000000015",
   "joined": -21
  },
  {
   "user_id": "e0e0e0e0-0000-4000-8000-000000000016",
   "joined": -19
  },
  {
   "user_id": "e0e0e0e0-0000-4000-8000-000000000017",
   "joined": -17
  }
 ],
 "lots": [
  {
   "key": "vrd",
   "name": "VRD et aménagements extérieurs",
   "code": "Lot 01 – VRD",
   "status": "published",
   "due": -21,
   "position": 0,
   "description": "Voiries, réseaux et espaces verts de la parcelle, du raccordement sur la rue jusqu’au pied de façade.",
   "items": [
    {
     "id": "vrd-1",
     "kind": "chapter",
     "ref": "1",
     "label": "Préparation",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "vrd-1.1",
     "kind": "line",
     "ref": "1.1",
     "label": "Installation de chantier VRD, amenée et repli",
     "unit": "ft",
     "qty": 1,
     "scope": "base"
    },
    {
     "id": "vrd-1.2",
     "kind": "line",
     "ref": "1.2",
     "label": "Démolition de l’enrobé existant, évacuation comprise",
     "unit": "m²",
     "qty": 380,
     "scope": "base"
    },
    {
     "id": "vrd-2",
     "kind": "chapter",
     "ref": "2",
     "label": "Terrassements",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "vrd-2.1",
     "kind": "line",
     "ref": "2.1",
     "label": "Décapage de la terre végétale ép. 30 cm",
     "unit": "m²",
     "qty": 900,
     "scope": "base"
    },
    {
     "id": "vrd-2.2",
     "kind": "line",
     "ref": "2.2",
     "label": "Déblais en pleine masse, évacuation en ISDI",
     "unit": "m³",
     "qty": 620,
     "scope": "base"
    },
    {
     "id": "vrd-3",
     "kind": "chapter",
     "ref": "3",
     "label": "Réseaux",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "vrd-3.1",
     "kind": "line",
     "ref": "3.1",
     "label": "Réseau eaux usées PVC CR8 Ø200",
     "unit": "ml",
     "qty": 95,
     "scope": "base"
    },
    {
     "id": "vrd-3.2",
     "kind": "line",
     "ref": "3.2",
     "label": "Réseau eaux pluviales PVC CR8 Ø250",
     "unit": "ml",
     "qty": 120,
     "scope": "base"
    },
    {
     "id": "vrd-3.3",
     "kind": "line",
     "ref": "3.3",
     "label": "Regards de visite béton Ø1000",
     "unit": "u",
     "qty": 9,
     "scope": "base"
    },
    {
     "id": "vrd-3.4",
     "kind": "line",
     "ref": "3.4",
     "label": "Bassin de rétention enterré 30 m³",
     "unit": "ft",
     "qty": 1,
     "scope": "base",
     "description": "Bassin en structures alvéolaires ultra-légères, géotextile et géomembrane compris, avec regard de régulation à débit de fuite limité à 2 l/s/ha."
    },
    {
     "id": "vrd-4",
     "kind": "chapter",
     "ref": "4",
     "label": "Voirie",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "vrd-4.1",
     "kind": "line",
     "ref": "4.1",
     "label": "Structure de chaussée en GNT ép. 40 cm",
     "unit": "m²",
     "qty": 520,
     "scope": "base"
    },
    {
     "id": "vrd-4.2",
     "kind": "line",
     "ref": "4.2",
     "label": "Enrobé BBSG 0/10 ép. 6 cm",
     "unit": "m²",
     "qty": 520,
     "scope": "base"
    },
    {
     "id": "vrd-4.3",
     "kind": "line",
     "ref": "4.3",
     "label": "Bordures béton T2",
     "unit": "ml",
     "qty": 210,
     "scope": "base"
    },
    {
     "id": "vrd-5",
     "kind": "chapter",
     "ref": "5",
     "label": "Espaces verts",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "vrd-5.1",
     "kind": "line",
     "ref": "5.1",
     "label": "Terre végétale, engazonnement et plantations",
     "unit": "m²",
     "qty": 380,
     "scope": "base"
    },
    {
     "id": "vrd-pse",
     "kind": "chapter",
     "ref": "PSE",
     "label": "Prestation supplémentaire éventuelle",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "vrd-pse1",
     "kind": "line",
     "ref": "PSE 1",
     "label": "Portail coulissant motorisé à l’entrée du parking",
     "unit": "u",
     "qty": 1,
     "scope": "option"
    }
   ],
   "budget": 125000,
   "budget_prices": {
    "vrd-1.1": 6500,
    "vrd-1.2": 11,
    "vrd-2.1": 4.2,
    "vrd-2.2": 24,
    "vrd-3.1": 92,
    "vrd-3.2": 98,
    "vrd-3.3": 1450,
    "vrd-3.4": 21000,
    "vrd-4.1": 17,
    "vrd-4.2": 21,
    "vrd-4.3": 39,
    "vrd-5.1": 16,
    "vrd-pse1": 7800
   },
   "settings": {
    "latestOnly": true,
    "fillMode": "median",
    "pseRetained": {},
    "extrasRetained": {}
   },
   "awarded": "vrd-vexin",
   "access": [
    {
     "user_id": "e0e0e0e0-0000-4000-8000-000000000001",
     "status": "approved",
     "requested": -40,
     "decided": -39,
     "comment": null
    },
    {
     "user_id": "e0e0e0e0-0000-4000-8000-000000000002",
     "status": "approved",
     "requested": -39,
     "decided": -39,
     "comment": null
    },
    {
     "user_id": "e0e0e0e0-0000-4000-8000-000000000003",
     "status": "approved",
     "requested": -38,
     "decided": -37,
     "comment": null
    }
   ],
   "offers": [
    {
     "key": "vrd-vexin",
     "company_id": "e0e0e0e0-0000-4000-8000-000000000001",
     "source": "platform",
     "version": 1,
     "company_name": "Vexin TP",
     "contact_first_name": "Claire",
     "contact_last_name": "Morel",
     "contact_email": "claire.morel@vexin-tp.example",
     "contact_phone": "01 99 00 10 01",
     "logo_url": "exemple/logos/vexin-tp.svg",
     "received": -23,
     "valid": 40,
     "prices": {
      "vrd-1.1": 5801,
      "vrd-1.2": 10.58,
      "vrd-2.1": 3.95,
      "vrd-2.2": 21.59,
      "vrd-3.1": 94.39,
      "vrd-3.2": 93.67,
      "vrd-3.3": 1410,
      "vrd-3.4": 20264,
      "vrd-4.1": 16.42,
      "vrd-4.2": 19.66,
      "vrd-4.3": 36.13,
      "vrd-5.1": 16.05,
      "vrd-pse1": 7131
     },
     "discount_pct": 0,
     "extras": [
      {
       "id": "vrd-vexin-x1",
       "kind": "option",
       "label": "Entretien des espaces verts pendant un an",
       "amount": 3600,
       "retained": false
      }
     ],
     "duration_weeks": 10,
     "reserves": "",
     "message": "Équipe dédiée et démarrage possible dès l’ordre de service. Nous avons réalisé les VRD de deux résidences comparables à Cergy."
    },
    {
     "key": "vrd-parisis",
     "company_id": "e0e0e0e0-0000-4000-8000-000000000002",
     "source": "platform",
     "version": 1,
     "company_name": "Réseaux du Parisis",
     "contact_first_name": "Karim",
     "contact_last_name": "Benali",
     "contact_email": "karim.benali@reseaux-parisis.example",
     "contact_phone": "01 99 00 10 02",
     "logo_url": "exemple/logos/reseaux-parisis.svg",
     "received": -22,
     "valid": 30,
     "prices": {
      "vrd-1.1": 5382,
      "vrd-1.2": 10.76,
      "vrd-2.1": 4.18,
      "vrd-2.2": 21.2,
      "vrd-3.1": 83.8,
      "vrd-3.2": 87.45,
      "vrd-3.3": 1298,
      "vrd-4.1": 16.26,
      "vrd-4.2": 17.8,
      "vrd-4.3": 33.16,
      "vrd-5.1": 13.43,
      "vrd-pse1": 6599
     },
     "discount_pct": 0,
     "extras": [],
     "duration_weeks": 12,
     "reserves": "Bassin de rétention non chiffré : en attente de l’étude de sol G2 PRO.",
     "message": ""
    },
    {
     "key": "vrd-atlas",
     "company_id": "e0e0e0e0-0000-4000-8000-000000000003",
     "source": "platform",
     "version": 1,
     "company_name": "Atlas Voirie",
     "contact_first_name": "Hugo",
     "contact_last_name": "Perrin",
     "contact_email": "hugo.perrin@atlas-voirie.example",
     "contact_phone": "01 99 00 10 03",
     "logo_url": "exemple/logos/atlas-voirie.svg",
     "received": -24,
     "valid": 30,
     "prices": {
      "vrd-1.1": 6589,
      "vrd-1.2": 11.46,
      "vrd-2.1": 4.59,
      "vrd-2.2": 26.37,
      "vrd-3.1": 93.82,
      "vrd-3.2": 104,
      "vrd-3.3": 1517,
      "vrd-3.4": 24193,
      "vrd-4.1": 19.64,
      "vrd-4.2": 24.27,
      "vrd-4.3": 39.68,
      "vrd-5.1": 17.23,
      "vrd-pse1": 7973
     },
     "discount_pct": 0,
     "extras": [],
     "duration_weeks": 9,
     "reserves": "",
     "message": "Délai réduit grâce à deux ateliers en parallèle (réseaux et voirie)."
    }
   ],
   "reviews": [
    {
     "offer": "vrd-vexin",
     "scores": {
      "tech": 16
     },
     "verdict": "favori"
    },
    {
     "offer": "vrd-parisis",
     "scores": {
      "tech": 12.5
     },
     "verdict": "ecarte"
    },
    {
     "offer": "vrd-atlas",
     "scores": {
      "tech": 14
     },
     "verdict": null
    }
   ],
   "comments": [
    {
     "offer": "vrd-vexin",
     "at": -18,
     "body": "Références solides en VRD de résidence ; le conducteur de travaux était présent à la réunion de mise au point. Offre retenue."
    },
    {
     "offer": "vrd-parisis",
     "at": -19,
     "body": "La moins chère même avec le bassin ajouté au prix médian, mais réserve sur l’étude de sol et mémoire technique trop léger."
    },
    {
     "offer": "vrd-atlas",
     "at": -19,
     "body": "Délai le plus court, mais au-dessus du budget."
    }
   ]
  },
  {
   "key": "go",
   "name": "Gros œuvre",
   "code": "Lot 02 – Gros œuvre",
   "status": "published",
   "due": -6,
   "position": 1,
   "description": "Terrassements du sous-sol, fondations, structure en béton armé (R+3 sur sous-sol) et maçonneries.",
   "items": [
    {
     "id": "go-1",
     "kind": "chapter",
     "ref": "1",
     "label": "Installation de chantier",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "go-1.1",
     "kind": "line",
     "ref": "1.1",
     "label": "Installation de chantier, grue à tour comprise",
     "unit": "ft",
     "qty": 1,
     "scope": "base",
     "description": "Base vie, clôtures, accès, branchements provisoires et grue à tour pour toute la durée du gros œuvre (montage, location, démontage)."
    },
    {
     "id": "go-2",
     "kind": "chapter",
     "ref": "2",
     "label": "Infrastructure",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "go-2.1",
     "kind": "line",
     "ref": "2.1",
     "label": "Terrassements en pleine masse du sous-sol",
     "unit": "m³",
     "qty": 1450,
     "scope": "base"
    },
    {
     "id": "go-2.2",
     "kind": "line",
     "ref": "2.2",
     "label": "Fondations superficielles en béton armé",
     "unit": "m³",
     "qty": 165,
     "scope": "base"
    },
    {
     "id": "go-2.3",
     "kind": "line",
     "ref": "2.3",
     "label": "Voiles enterrés en béton armé ép. 20 cm",
     "unit": "m²",
     "qty": 640,
     "scope": "base"
    },
    {
     "id": "go-2.4",
     "kind": "line",
     "ref": "2.4",
     "label": "Dallage du sous-sol ép. 18 cm",
     "unit": "m²",
     "qty": 610,
     "scope": "base"
    },
    {
     "id": "go-3",
     "kind": "chapter",
     "ref": "3",
     "label": "Superstructure",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "go-3.1",
     "kind": "line",
     "ref": "3.1",
     "label": "Voiles en béton armé ép. 18 cm",
     "unit": "m²",
     "qty": 2350,
     "scope": "base"
    },
    {
     "id": "go-3.2",
     "kind": "line",
     "ref": "3.2",
     "label": "Planchers en dalle pleine ép. 20 cm",
     "unit": "m²",
     "qty": 1980,
     "scope": "base"
    },
    {
     "id": "go-3.3",
     "kind": "line",
     "ref": "3.3",
     "label": "Poteaux et poutres en béton armé",
     "unit": "m³",
     "qty": 58,
     "scope": "base"
    },
    {
     "id": "go-3.4",
     "kind": "line",
     "ref": "3.4",
     "label": "Escaliers préfabriqués",
     "unit": "u",
     "qty": 8,
     "scope": "base"
    },
    {
     "id": "go-3.5",
     "kind": "line",
     "ref": "3.5",
     "label": "Balcons préfabriqués",
     "unit": "u",
     "qty": 24,
     "scope": "base"
    },
    {
     "id": "go-4",
     "kind": "chapter",
     "ref": "4",
     "label": "Maçonnerie",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "go-4.1",
     "kind": "line",
     "ref": "4.1",
     "label": "Maçonnerie de blocs béton ép. 20 cm",
     "unit": "m²",
     "qty": 420,
     "scope": "base"
    },
    {
     "id": "go-4.2",
     "kind": "line",
     "ref": "4.2",
     "label": "Seuils et appuis préfabriqués",
     "unit": "ml",
     "qty": 260,
     "scope": "base"
    },
    {
     "id": "go-pse",
     "kind": "chapter",
     "ref": "PSE",
     "label": "Prestation supplémentaire éventuelle",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "go-pse1",
     "kind": "line",
     "ref": "PSE 1",
     "label": "Isolation sous dallage du sous-sol",
     "unit": "m²",
     "qty": 610,
     "scope": "option"
    }
   ],
   "budget": 940000,
   "budget_prices": {
    "go-1.1": 68000,
    "go-2.1": 19,
    "go-2.2": 310,
    "go-2.3": 145,
    "go-2.4": 62,
    "go-3.1": 118,
    "go-3.2": 96,
    "go-3.3": 690,
    "go-3.4": 3400,
    "go-3.5": 2900,
    "go-4.1": 68,
    "go-4.2": 52,
    "go-pse1": 24
   },
   "settings": {
    "latestOnly": true,
    "fillMode": "median",
    "pseRetained": {
     "go-pse1": true
    },
    "extrasRetained": {}
   },
   "awarded": null,
   "access": [
    {
     "user_id": "e0e0e0e0-0000-4000-8000-000000000004",
     "status": "approved",
     "requested": -30,
     "decided": -29,
     "comment": null
    },
    {
     "user_id": "e0e0e0e0-0000-4000-8000-000000000005",
     "status": "approved",
     "requested": -28,
     "decided": -27,
     "comment": null
    },
    {
     "user_id": "e0e0e0e0-0000-4000-8000-000000000006",
     "status": "approved",
     "requested": -29,
     "decided": -29,
     "comment": null
    },
    {
     "user_id": "e0e0e0e0-0000-4000-8000-000000000007",
     "status": "refused",
     "requested": -15,
     "decided": -14,
     "comment": null
    },
    {
     "user_id": "e0e0e0e0-0000-4000-8000-000000000008",
     "status": "declined",
     "requested": -27,
     "decided": -12,
     "comment": "Plan de charge complet jusqu’à l’été 2027 : nous ne pourrons pas répondre à cette consultation."
    }
   ],
   "offers": [
    {
     "key": "go-oise",
     "company_id": "e0e0e0e0-0000-4000-8000-000000000004",
     "source": "platform",
     "version": 1,
     "company_name": "Bâtisseurs de l’Oise",
     "contact_first_name": "Nathalie",
     "contact_last_name": "Garnier",
     "contact_email": "nathalie.garnier@batisseurs-oise.example",
     "contact_phone": "01 99 00 20 01",
     "logo_url": "exemple/logos/batisseurs-oise.svg",
     "received": -7,
     "valid": 55,
     "prices": {
      "go-1.1": 65842,
      "go-2.1": 18.45,
      "go-2.2": 304,
      "go-2.3": 158,
      "go-2.4": 63.85,
      "go-3.1": 119,
      "go-3.2": 103,
      "go-3.3": 703,
      "go-3.4": 3476,
      "go-3.5": 2814,
      "go-4.1": 69.15,
      "go-4.2": 54.75,
      "go-pse1": 25.28
     },
     "discount_pct": 0,
     "extras": [],
     "duration_weeks": 46,
     "reserves": "",
     "message": "Offre établie sur le planning de consultation, grue à tour comprise."
    },
    {
     "key": "go-fernandes",
     "company_id": "e0e0e0e0-0000-4000-8000-000000000005",
     "source": "platform",
     "version": 1,
     "company_name": "Maçonnerie Fernandes",
     "contact_first_name": "Paulo",
     "contact_last_name": "Fernandes",
     "contact_email": "paulo.fernandes@maconnerie-fernandes.example",
     "contact_phone": "01 99 00 20 02",
     "logo_url": "exemple/logos/maconnerie-fernandes.svg",
     "received": -6,
     "valid": 60,
     "prices": {
      "go-1.1": 41000,
      "go-2.1": 18.38,
      "go-2.2": 276,
      "go-2.3": 137,
      "go-2.4": 63.06,
      "go-3.1": 122,
      "go-3.2": 90.12,
      "go-3.3": 662,
      "go-3.4": 3282,
      "go-3.5": 2622,
      "go-4.1": 70.36,
      "go-4.2": 53.11,
      "go-pse1": 23.46
     },
     "discount_pct": 0,
     "extras": [],
     "duration_weeks": 50,
     "reserves": "Installation de chantier hors grue à tour : grue mise à disposition par l’entreprise générale.",
     "message": ""
    },
    {
     "key": "go-seine",
     "company_id": "e0e0e0e0-0000-4000-8000-000000000006",
     "source": "platform",
     "version": 1,
     "company_name": "Structures Seine Béton",
     "contact_first_name": "Thomas",
     "contact_last_name": "Lebrun",
     "contact_email": "thomas.lebrun@structures-seine.example",
     "contact_phone": "01 99 00 20 03",
     "logo_url": "exemple/logos/structures-seine.svg",
     "received": -8,
     "valid": 45,
     "prices": {
      "go-1.1": 71711,
      "go-2.1": 21.53,
      "go-2.2": 335,
      "go-2.3": 166,
      "go-2.4": 68.24,
      "go-3.1": 131,
      "go-3.2": 103,
      "go-3.3": 760,
      "go-3.4": 3758,
      "go-3.5": 3118,
      "go-4.1": 72.7,
      "go-4.2": 56.15,
      "go-pse1": 27.85
     },
     "discount_pct": 0,
     "extras": [
      {
       "id": "go-seine-x1",
       "kind": "variante",
       "label": "Prédalles en remplacement des dalles pleines coulées en place",
       "amount": -18500,
       "retained": false
      }
     ],
     "duration_weeks": 40,
     "reserves": "",
     "message": "Délai de 40 semaines avec deux équipes de coffrage."
    },
    {
     "key": "go-oise-v2",
     "company_id": null,
     "source": "manual",
     "version": 2,
     "company_name": "Bâtisseurs de l’Oise",
     "contact_first_name": "Nathalie",
     "contact_last_name": "Garnier",
     "contact_email": "nathalie.garnier@batisseurs-oise.example",
     "contact_phone": "01 99 00 20 01",
     "logo_url": "exemple/logos/batisseurs-oise.svg",
     "received": -2,
     "valid": 60,
     "prices": {
      "go-1.1": 63538,
      "go-2.1": 17.8,
      "go-2.2": 293,
      "go-2.3": 152,
      "go-2.4": 61.62,
      "go-3.1": 115,
      "go-3.2": 99.4,
      "go-3.3": 678,
      "go-3.4": 3354,
      "go-3.5": 2716,
      "go-4.1": 66.73,
      "go-4.2": 52.83,
      "go-pse1": 24.4
     },
     "discount_pct": 1,
     "extras": [],
     "duration_weeks": 46,
     "reserves": "",
     "message": "Offre après la réunion de négociation : plancher haut du sous-sol optimisé et remise de 1 %."
    }
   ],
   "reviews": [
    {
     "offer": "go-oise-v2",
     "scores": {
      "tech": 16.5
     },
     "verdict": "favori"
    },
    {
     "offer": "go-oise",
     "scores": {
      "tech": 16.5
     },
     "verdict": null
    },
    {
     "offer": "go-fernandes",
     "scores": {
      "tech": 13.5
     },
     "verdict": "negocier"
    },
    {
     "offer": "go-seine",
     "scores": {
      "tech": 15
     },
     "verdict": null
    }
   ],
   "comments": [
    {
     "offer": "go-oise-v2",
     "at": -2,
     "body": "Après négociation : −3,5 % sur les prix et 1 % de remise. Reste à confirmer le planning du sous-sol."
    },
    {
     "offer": "go-fernandes",
     "at": -5,
     "body": "La moins chère, mais sans la grue : compter environ 25 000 € de location pour comparer à périmètre égal."
    },
    {
     "offer": "go-seine",
     "at": -5,
     "body": "Délai le plus court. La variante prédalles est à faire valider par le bureau d’études structure."
    }
   ]
  },
  {
   "key": "eta",
   "name": "Étanchéité",
   "code": "Lot 03 – Étanchéité",
   "status": "published",
   "due": 6,
   "position": 2,
   "description": "Toiture terrasse inaccessible et terrasses accessibles des logements du dernier étage.",
   "items": [
    {
     "id": "eta-1",
     "kind": "chapter",
     "ref": "1",
     "label": "Toiture terrasse inaccessible",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "eta-1.1",
     "kind": "line",
     "ref": "1.1",
     "label": "Pare-vapeur et isolant PIR ép. 160 mm",
     "unit": "m²",
     "qty": 420,
     "scope": "base"
    },
    {
     "id": "eta-1.2",
     "kind": "line",
     "ref": "1.2",
     "label": "Étanchéité bicouche élastomère",
     "unit": "m²",
     "qty": 420,
     "scope": "base"
    },
    {
     "id": "eta-1.3",
     "kind": "line",
     "ref": "1.3",
     "label": "Protection par gravillons",
     "unit": "m²",
     "qty": 420,
     "scope": "base"
    },
    {
     "id": "eta-1.4",
     "kind": "line",
     "ref": "1.4",
     "label": "Relevés d’étanchéité",
     "unit": "ml",
     "qty": 135,
     "scope": "base"
    },
    {
     "id": "eta-2",
     "kind": "chapter",
     "ref": "2",
     "label": "Terrasses accessibles",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "eta-2.1",
     "kind": "line",
     "ref": "2.1",
     "label": "Étanchéité sous dalles sur plots",
     "unit": "m²",
     "qty": 140,
     "scope": "base"
    },
    {
     "id": "eta-2.2",
     "kind": "line",
     "ref": "2.2",
     "label": "Dalles béton sur plots",
     "unit": "m²",
     "qty": 140,
     "scope": "base"
    },
    {
     "id": "eta-3",
     "kind": "chapter",
     "ref": "3",
     "label": "Ouvrages divers",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "eta-3.1",
     "kind": "line",
     "ref": "3.1",
     "label": "Entrées d’eaux pluviales et trop-pleins",
     "unit": "u",
     "qty": 10,
     "scope": "base"
    },
    {
     "id": "eta-3.2",
     "kind": "line",
     "ref": "3.2",
     "label": "Ligne de vie en toiture",
     "unit": "ft",
     "qty": 1,
     "scope": "base"
    }
   ],
   "budget": 80000,
   "budget_prices": {
    "eta-1.1": 58,
    "eta-1.2": 42,
    "eta-1.3": 9,
    "eta-1.4": 48,
    "eta-2.1": 68,
    "eta-2.2": 55,
    "eta-3.1": 340,
    "eta-3.2": 6200
   },
   "settings": {
    "latestOnly": true,
    "fillMode": "median",
    "pseRetained": {},
    "extrasRetained": {}
   },
   "awarded": null,
   "access": [
    {
     "user_id": "e0e0e0e0-0000-4000-8000-000000000009",
     "status": "approved",
     "requested": -13,
     "decided": -12,
     "comment": null
    },
    {
     "user_id": "e0e0e0e0-0000-4000-8000-000000000010",
     "status": "approved",
     "requested": -12,
     "decided": -11,
     "comment": null
    },
    {
     "user_id": "e0e0e0e0-0000-4000-8000-000000000011",
     "status": "pending",
     "requested": -1,
     "decided": null,
     "comment": null
    }
   ],
   "offers": [
    {
     "key": "eta-toits",
     "company_id": "e0e0e0e0-0000-4000-8000-000000000009",
     "source": "platform",
     "version": 1,
     "company_name": "Toits & Terrasses",
     "contact_first_name": "Sophie",
     "contact_last_name": "Marchand",
     "contact_email": "sophie.marchand@toits-terrasses.example",
     "contact_phone": "01 99 00 30 01",
     "logo_url": "exemple/logos/toits-terrasses.svg",
     "received": -2,
     "valid": 90,
     "prices": {
      "eta-1.1": 53.41,
      "eta-1.2": 40.33,
      "eta-1.3": 8.68,
      "eta-1.4": 46.35,
      "eta-2.1": 70.24,
      "eta-2.2": 51.51,
      "eta-3.1": 348,
      "eta-3.2": 6194
     },
     "discount_pct": 0,
     "extras": [],
     "duration_weeks": 6,
     "reserves": "",
     "message": "Offre conforme au DPGF. Attestation décennale à jour disponible sur demande."
    }
   ],
   "reviews": [],
   "comments": []
  },
  {
   "key": "mex",
   "name": "Menuiseries extérieures",
   "code": "Lot 05 – Menuiseries extérieures",
   "status": "published",
   "due": -10,
   "position": 3,
   "description": "Fenêtres, portes-fenêtres et volets roulants des 18 logements, porte du hall et garde-corps.",
   "items": [
    {
     "id": "mex-1",
     "kind": "chapter",
     "ref": "1",
     "label": "Fenêtres et portes-fenêtres PVC",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "mex-1.1",
     "kind": "line",
     "ref": "1.1",
     "label": "Fenêtres 2 vantaux 125 × 135",
     "unit": "u",
     "qty": 54,
     "scope": "base"
    },
    {
     "id": "mex-1.2",
     "kind": "line",
     "ref": "1.2",
     "label": "Portes-fenêtres 2 vantaux 145 × 215",
     "unit": "u",
     "qty": 36,
     "scope": "base"
    },
    {
     "id": "mex-1.3",
     "kind": "line",
     "ref": "1.3",
     "label": "Châssis fixes des salles de bains",
     "unit": "u",
     "qty": 18,
     "scope": "base"
    },
    {
     "id": "mex-2",
     "kind": "chapter",
     "ref": "2",
     "label": "Occultations",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "mex-2.1",
     "kind": "line",
     "ref": "2.1",
     "label": "Volets roulants à manœuvre manuelle",
     "unit": "u",
     "qty": 90,
     "scope": "base"
    },
    {
     "id": "mex-3",
     "kind": "chapter",
     "ref": "3",
     "label": "Ouvrages divers",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "mex-3.1",
     "kind": "line",
     "ref": "3.1",
     "label": "Porte d’entrée du hall en aluminium",
     "unit": "ft",
     "qty": 1,
     "scope": "base"
    },
    {
     "id": "mex-3.2",
     "kind": "line",
     "ref": "3.2",
     "label": "Garde-corps en aluminium",
     "unit": "ml",
     "qty": 96,
     "scope": "base"
    },
    {
     "id": "mex-pse",
     "kind": "chapter",
     "ref": "PSE",
     "label": "Prestation supplémentaire éventuelle",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "mex-pse1",
     "kind": "line",
     "ref": "PSE 1",
     "label": "Motorisation des volets roulants",
     "unit": "u",
     "qty": 90,
     "scope": "option"
    }
   ],
   "budget": 165000,
   "budget_prices": {
    "mex-1.1": 780,
    "mex-1.2": 1180,
    "mex-1.3": 420,
    "mex-2.1": 390,
    "mex-3.1": 9800,
    "mex-3.2": 260,
    "mex-pse1": 165
   },
   "settings": {
    "latestOnly": true,
    "fillMode": "median",
    "pseRetained": {
     "mex-pse1": true
    },
    "extrasRetained": {}
   },
   "awarded": null,
   "access": [
    {
     "user_id": "e0e0e0e0-0000-4000-8000-000000000012",
     "status": "approved",
     "requested": -24,
     "decided": -23,
     "comment": null
    }
   ],
   "offers": [
    {
     "key": "mex-alu",
     "company_id": "e0e0e0e0-0000-4000-8000-000000000012",
     "source": "platform",
     "version": 1,
     "company_name": "Alu Concept Menuiseries",
     "contact_first_name": "Inès",
     "contact_last_name": "Haddad",
     "contact_email": "ines.haddad@alu-concept.example",
     "contact_phone": "01 99 00 50 01",
     "logo_url": "exemple/logos/alu-concept.svg",
     "received": -11,
     "valid": 60,
     "prices": {
      "mex-1.1": 748,
      "mex-1.2": 1165,
      "mex-1.3": 453,
      "mex-2.1": 378,
      "mex-3.1": 10347,
      "mex-3.2": 271,
      "mex-pse1": 161
     },
     "discount_pct": 0,
     "extras": [
      {
       "id": "mex-alu-x1",
       "kind": "variante",
       "label": "Menuiseries aluminium à rupture de pont thermique au lieu du PVC",
       "amount": 24800,
       "retained": false
      },
      {
       "id": "mex-alu-x2",
       "kind": "option",
       "label": "Brise-soleil orientables sur la façade sud (12 baies)",
       "amount": 14200,
       "retained": false
      }
     ],
     "duration_weeks": 14,
     "reserves": "",
     "message": "Délai de 14 semaines dont 8 de fabrication après validation des plans d’atelier."
    },
    {
     "key": "mex-val",
     "company_id": null,
     "source": "manual",
     "version": 1,
     "company_name": "Fenêtres du Val",
     "contact_first_name": "Laurent",
     "contact_last_name": "Petit",
     "contact_email": "laurent.petit@fenetres-du-val.example",
     "contact_phone": "01 99 00 50 02",
     "logo_url": "exemple/logos/fenetres-du-val.svg",
     "received": -9,
     "valid": 30,
     "prices": {
      "mex-1.1": 682,
      "mex-1.2": 1139,
      "mex-1.3": 404,
      "mex-2.1": 361,
      "mex-3.1": 9135,
      "mex-pse1": 144
     },
     "discount_pct": 0,
     "extras": [],
     "duration_weeks": 16,
     "reserves": "Garde-corps non compris : à confier au lot serrurerie.",
     "message": ""
    }
   ],
   "reviews": [
    {
     "offer": "mex-alu",
     "scores": {
      "tech": 15
     },
     "verdict": null
    },
    {
     "offer": "mex-val",
     "scores": {
      "tech": 13
     },
     "verdict": "negocier"
    }
   ],
   "comments": [
    {
     "offer": "mex-val",
     "at": -9,
     "body": "Offre reçue par e-mail et saisie par nos soins. Garde-corps exclus : à chiffrer au lot serrurerie avant de conclure."
    }
   ]
  },
  {
   "key": "pla",
   "name": "Plâtrerie, isolation, faux plafonds",
   "code": "Lot 07 – Plâtrerie",
   "status": "published",
   "due": 12,
   "position": 4,
   "description": "Doublages, cloisons, faux plafonds et gaines techniques des logements et des parties communes.",
   "items": [
    {
     "id": "pla-1",
     "kind": "chapter",
     "ref": "1",
     "label": "Cloisons et doublages",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "pla-1.1",
     "kind": "line",
     "ref": "1.1",
     "label": "Doublages thermiques PSE + plaque, ép. 13 + 100",
     "unit": "m²",
     "qty": 1650,
     "scope": "base"
    },
    {
     "id": "pla-1.2",
     "kind": "line",
     "ref": "1.2",
     "label": "Cloisons de distribution 72/48",
     "unit": "m²",
     "qty": 1900,
     "scope": "base"
    },
    {
     "id": "pla-1.3",
     "kind": "line",
     "ref": "1.3",
     "label": "Cloisons hydrofuges des pièces humides",
     "unit": "m²",
     "qty": 380,
     "scope": "base"
    },
    {
     "id": "pla-2",
     "kind": "chapter",
     "ref": "2",
     "label": "Plafonds",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "pla-2.1",
     "kind": "line",
     "ref": "2.1",
     "label": "Faux plafonds en plaques de plâtre",
     "unit": "m²",
     "qty": 420,
     "scope": "base"
    },
    {
     "id": "pla-2.2",
     "kind": "line",
     "ref": "2.2",
     "label": "Plafonds acoustiques des circulations",
     "unit": "m²",
     "qty": 160,
     "scope": "base"
    },
    {
     "id": "pla-3",
     "kind": "chapter",
     "ref": "3",
     "label": "Divers",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "pla-3.1",
     "kind": "line",
     "ref": "3.1",
     "label": "Gaines techniques coupe-feu",
     "unit": "ml",
     "qty": 210,
     "scope": "base"
    }
   ],
   "budget": 170000,
   "budget_prices": {
    "pla-1.1": 34,
    "pla-1.2": 31,
    "pla-1.3": 39,
    "pla-2.1": 38,
    "pla-2.2": 52,
    "pla-3.1": 64
   },
   "settings": {
    "latestOnly": true,
    "fillMode": "median",
    "pseRetained": {},
    "extrasRetained": {}
   },
   "awarded": null,
   "access": [
    {
     "user_id": "e0e0e0e0-0000-4000-8000-000000000013",
     "status": "approved",
     "requested": -10,
     "decided": -9,
     "comment": null
    },
    {
     "user_id": "e0e0e0e0-0000-4000-8000-000000000014",
     "status": "declined",
     "requested": -9,
     "decided": -4,
     "comment": "Délai trop court pour chiffrer correctement. Merci de nous reconsulter si la date de remise est reportée."
    }
   ],
   "offers": [
    {
     "key": "pla-platre",
     "company_id": "e0e0e0e0-0000-4000-8000-000000000013",
     "source": "platform",
     "version": 1,
     "company_name": "Plâtrerie Francilienne",
     "contact_first_name": "Mehdi",
     "contact_last_name": "Saidi",
     "contact_email": "mehdi.saidi@platrerie-francilienne.example",
     "contact_phone": "01 99 00 70 01",
     "logo_url": "exemple/logos/platrerie-francilienne.svg",
     "received": -3,
     "valid": 90,
     "prices": {
      "pla-1.1": 31.97,
      "pla-1.2": 31.95,
      "pla-1.3": 40.03,
      "pla-2.1": 37.3,
      "pla-2.2": 49.93,
      "pla-3.1": 66.92
     },
     "discount_pct": 0,
     "extras": [],
     "duration_weeks": 18,
     "reserves": "",
     "message": "Nous restons disponibles pour une visite du site avant la date de remise."
    }
   ],
   "reviews": [],
   "comments": []
  },
  {
   "key": "ele",
   "name": "Électricité courants forts et faibles",
   "code": "Lot 11 – Électricité",
   "status": "published",
   "due": -4,
   "position": 5,
   "description": "Installations électriques des logements, des parties communes et du parking ; interphonie et fibre.",
   "items": [
    {
     "id": "ele-1",
     "kind": "chapter",
     "ref": "1",
     "label": "Courants forts",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "ele-1.1",
     "kind": "line",
     "ref": "1.1",
     "label": "Tableaux électriques des logements",
     "unit": "u",
     "qty": 18,
     "scope": "base"
    },
    {
     "id": "ele-1.2",
     "kind": "line",
     "ref": "1.2",
     "label": "Équipement des logements (prises, points lumineux)",
     "unit": "u",
     "qty": 18,
     "scope": "base"
    },
    {
     "id": "ele-1.3",
     "kind": "line",
     "ref": "1.3",
     "label": "Éclairage LED des parties communes",
     "unit": "ft",
     "qty": 1,
     "scope": "base"
    },
    {
     "id": "ele-1.4",
     "kind": "line",
     "ref": "1.4",
     "label": "Colonnes montantes et liaisons",
     "unit": "ft",
     "qty": 1,
     "scope": "base"
    },
    {
     "id": "ele-2",
     "kind": "chapter",
     "ref": "2",
     "label": "Courants faibles",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "ele-2.1",
     "kind": "line",
     "ref": "2.1",
     "label": "Interphonie et contrôle d’accès",
     "unit": "ft",
     "qty": 1,
     "scope": "base"
    },
    {
     "id": "ele-2.2",
     "kind": "line",
     "ref": "2.2",
     "label": "Fibre optique des logements",
     "unit": "u",
     "qty": 18,
     "scope": "base"
    },
    {
     "id": "ele-2.3",
     "kind": "line",
     "ref": "2.3",
     "label": "Détection incendie des parties communes",
     "unit": "ft",
     "qty": 1,
     "scope": "base"
    },
    {
     "id": "ele-3",
     "kind": "chapter",
     "ref": "3",
     "label": "Sous-sol",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "ele-3.1",
     "kind": "line",
     "ref": "3.1",
     "label": "Éclairage et prises du parking",
     "unit": "ft",
     "qty": 1,
     "scope": "base"
    },
    {
     "id": "ele-pse",
     "kind": "chapter",
     "ref": "PSE",
     "label": "Prestation supplémentaire éventuelle",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "ele-pse1",
     "kind": "line",
     "ref": "PSE 1",
     "label": "Bornes de recharge pour véhicules électriques",
     "unit": "u",
     "qty": 4,
     "scope": "option"
    }
   ],
   "budget": 115000,
   "budget_prices": {
    "ele-1.1": 980,
    "ele-1.2": 2650,
    "ele-1.3": 9800,
    "ele-1.4": 8600,
    "ele-2.1": 7400,
    "ele-2.2": 410,
    "ele-2.3": 5200,
    "ele-3.1": 6900,
    "ele-pse1": 1900
   },
   "settings": {
    "latestOnly": true,
    "fillMode": "median",
    "pseRetained": {},
    "extrasRetained": {}
   },
   "awarded": null,
   "access": [
    {
     "user_id": "e0e0e0e0-0000-4000-8000-000000000015",
     "status": "approved",
     "requested": -20,
     "decided": -19,
     "comment": null
    },
    {
     "user_id": "e0e0e0e0-0000-4000-8000-000000000016",
     "status": "approved",
     "requested": -18,
     "decided": -18,
     "comment": null
    },
    {
     "user_id": "e0e0e0e0-0000-4000-8000-000000000017",
     "status": "approved",
     "requested": -16,
     "decided": -15,
     "comment": null
    }
   ],
   "offers": [
    {
     "key": "ele-lumiere",
     "company_id": "e0e0e0e0-0000-4000-8000-000000000015",
     "source": "platform",
     "version": 1,
     "company_name": "Elec Lumière Services",
     "contact_first_name": "Romain",
     "contact_last_name": "Girard",
     "contact_email": "romain.girard@elec-lumiere.example",
     "contact_phone": "01 99 00 11 01",
     "logo_url": "exemple/logos/elec-lumiere.svg",
     "received": -5,
     "valid": 60,
     "prices": {
      "ele-1.1": 921,
      "ele-1.2": 2536,
      "ele-1.3": 9649,
      "ele-1.4": 8810,
      "ele-2.1": 7745,
      "ele-2.2": 433,
      "ele-2.3": 5609,
      "ele-3.1": 7128,
      "ele-pse1": 1985
     },
     "discount_pct": 0,
     "extras": [],
     "duration_weeks": 20,
     "reserves": "",
     "message": "Offre complète, PSE bornes de recharge comprise."
    },
    {
     "key": "ele-voltais",
     "company_id": "e0e0e0e0-0000-4000-8000-000000000016",
     "source": "platform",
     "version": 1,
     "company_name": "Voltaïs Électricité",
     "contact_first_name": "Camille",
     "contact_last_name": "Noël",
     "contact_email": "camille.noel@voltais.example",
     "contact_phone": "01 99 00 11 02",
     "logo_url": "exemple/logos/voltais.svg",
     "received": -4,
     "valid": -1,
     "prices": {
      "ele-1.1": 821,
      "ele-1.2": 2510,
      "ele-1.3": 8822,
      "ele-1.4": 8171,
      "ele-2.1": 6641,
      "ele-3.1": 6018,
      "ele-pse1": 1682
     },
     "discount_pct": 0,
     "extras": [],
     "duration_weeks": 22,
     "reserves": "Fibre optique : prestation de l’opérateur, non chiffrée. Détection incendie à confier à une entreprise spécialisée.",
     "message": ""
    }
   ],
   "reviews": [
    {
     "offer": "ele-lumiere",
     "scores": {
      "tech": 14.5
     },
     "verdict": null
    },
    {
     "offer": "ele-voltais",
     "scores": {
      "tech": 12
     },
     "verdict": "negocier"
    }
   ],
   "comments": [
    {
     "offer": "ele-voltais",
     "at": -3,
     "body": "Moins chère mais incomplète, et validité dépassée : demander une offre complète et prolongée."
    }
   ]
  },
  {
   "key": "pcv",
   "name": "Plomberie, chauffage, ventilation",
   "code": "Lot 12 – Plomberie CVC",
   "status": "draft",
   "due": 25,
   "position": 6,
   "description": "Production de chaleur collective, distribution, sanitaires et ventilation des logements.",
   "items": [
    {
     "id": "pcv-1",
     "kind": "chapter",
     "ref": "1",
     "label": "Production et distribution",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "pcv-1.1",
     "kind": "line",
     "ref": "1.1",
     "label": "Pompes à chaleur collectives air/eau",
     "unit": "ft",
     "qty": 1,
     "scope": "base"
    },
    {
     "id": "pcv-1.2",
     "kind": "line",
     "ref": "1.2",
     "label": "Réseaux de chauffage et d’eau chaude sanitaire",
     "unit": "ft",
     "qty": 1,
     "scope": "base"
    },
    {
     "id": "pcv-2",
     "kind": "chapter",
     "ref": "2",
     "label": "Logements",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "pcv-2.1",
     "kind": "line",
     "ref": "2.1",
     "label": "Appareils sanitaires (par logement)",
     "unit": "u",
     "qty": 18,
     "scope": "base"
    },
    {
     "id": "pcv-2.2",
     "kind": "line",
     "ref": "2.2",
     "label": "Radiateurs basse température",
     "unit": "u",
     "qty": 72,
     "scope": "base"
    },
    {
     "id": "pcv-3",
     "kind": "chapter",
     "ref": "3",
     "label": "Ventilation",
     "unit": "",
     "qty": null,
     "scope": "base"
    },
    {
     "id": "pcv-3.1",
     "kind": "line",
     "ref": "3.1",
     "label": "VMC simple flux hygroréglable",
     "unit": "ft",
     "qty": 1,
     "scope": "base"
    }
   ],
   "budget": 220000,
   "budget_prices": {
    "pcv-1.1": 68000,
    "pcv-1.2": 38000,
    "pcv-2.1": 3100,
    "pcv-2.2": 420,
    "pcv-3.1": 24000
   },
   "settings": {
    "latestOnly": true,
    "fillMode": "median",
    "pseRetained": {},
    "extrasRetained": {}
   },
   "awarded": null,
   "access": [],
   "offers": [],
   "reviews": [],
   "comments": []
  }
 ]
}$exemple$::jsonb, now())
on conflict (id) do update set data = excluded.data, updated_at = now();
