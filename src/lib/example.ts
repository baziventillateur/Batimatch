// Projet exemple proposé à chaque acheteur (bouton « Projet exemple »).
// Une petite résidence de 18 logements, 7 lots, et des entreprises fictives dans toutes les situations :
// offres envoyées, version négociée, offre saisie par l'acheteur, offre incomplète ou expirée,
// demande d'accès en attente, accès refusé, entreprise qui ne répond pas, lot attribué, lot non publié.
//
// Ce fichier est la seule source des données : l'application de démonstration le lit directement,
// et supabase/example.sql (comptes des entreprises + modèle copié par open_example_project) en est généré
// par le test src/lib/example.test.ts (`npx vitest run -u` pour le régénérer après une modification).
// Les dates sont des décalages en jours par rapport au jour où l'acheteur ouvre l'exemple.
import type { CompareSettings, DpgfItem, Extra, PriceValue, Verdict } from './types'
import type { CommentRow, LotAccessRow, LotPrivateRow, LotRow, MemberRow, OfferRow, ProjectRow, ReviewRow } from '../data/rows'

/** Dossier des logos fictifs (public/exemple/logos), en chemin relatif à l'application */
export const EXAMPLE_LOGOS = 'exemple/logos/'

/** Entreprise fictive. Celles qui ont un id ont un compte (bloqué : personne ne peut s'y connecter). */
export interface ExampleCompany {
  id: string | null
  email: string
  company_name: string
  first_name: string
  last_name: string
  phone: string
  logo_url: string
}

export interface ExampleAccess {
  user_id: string
  status: 'pending' | 'approved' | 'refused' | 'declined'
  /** Jours (négatifs = passé) */
  requested: number
  decided: number | null
  comment: string | null
}

export interface ExampleOffer {
  key: string
  company_id: string | null
  source: 'platform' | 'manual'
  version: number
  company_name: string
  contact_first_name: string
  contact_last_name: string
  contact_email: string
  contact_phone: string
  logo_url: string
  /** Jour de réception (et d'envoi pour une offre déposée par l'entreprise) */
  received: number
  /** Fin de validité de l'offre, en jours */
  valid: number | null
  prices: Record<string, PriceValue>
  discount_pct: number
  extras: Extra[]
  duration_weeks: number | null
  reserves: string
  message: string
}

export interface ExampleLot {
  key: string
  name: string
  code: string
  description: string
  status: 'draft' | 'published' | 'suspended'
  due: number
  position: number
  items: DpgfItem[]
  budget: number
  budget_prices: Record<string, number>
  settings: Partial<CompareSettings>
  /** Clé de l'offre retenue */
  awarded: string | null
  access: ExampleAccess[]
  offers: ExampleOffer[]
  reviews: { offer: string; scores: Record<string, number>; verdict: Verdict | null }[]
  comments: { offer: string; body: string; at: number }[]
}

export interface ExampleTemplate {
  project: { name: string; reference: string; description: string }
  /** Entreprises qui ont rejoint le projet avec son code */
  members: { user_id: string; joined: number }[]
  lots: ExampleLot[]
}

// ————————————————————————— Entreprises —————————————————————————

const cid = (n: number) => `e0e0e0e0-0000-4000-8000-${String(n).padStart(12, '0')}`

// Numéros réservés par l'ARCEP aux œuvres de fiction (01 99 00 xx xx), domaines « .example » réservés
const company = (n: number | null, slug: string, name: string, first: string, last: string, phone: string): ExampleCompany => ({
  id: n == null ? null : cid(n),
  email: `${first}.${last}@${slug}.example`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9.@-]/g, ''),
  company_name: name,
  first_name: first,
  last_name: last,
  phone: `01 99 00 ${phone}`,
  logo_url: `${EXAMPLE_LOGOS}${slug}.svg`,
})

export const EXAMPLE_COMPANIES = {
  vexin: company(1, 'vexin-tp', 'Vexin TP', 'Claire', 'Morel', '10 01'),
  parisis: company(2, 'reseaux-parisis', 'Réseaux du Parisis', 'Karim', 'Benali', '10 02'),
  atlas: company(3, 'atlas-voirie', 'Atlas Voirie', 'Hugo', 'Perrin', '10 03'),
  oise: company(4, 'batisseurs-oise', 'Bâtisseurs de l’Oise', 'Nathalie', 'Garnier', '20 01'),
  fernandes: company(5, 'maconnerie-fernandes', 'Maçonnerie Fernandes', 'Paulo', 'Fernandes', '20 02'),
  seine: company(6, 'structures-seine', 'Structures Seine Béton', 'Thomas', 'Lebrun', '20 03'),
  express: company(7, 'bati-express', 'Bati-Express 95', 'Kevin', 'Roux', '20 04'),
  dumas: company(8, 'constructions-dumas', 'Constructions Dumas', 'Michel', 'Dumas', '20 05'),
  toits: company(9, 'toits-terrasses', 'Toits & Terrasses', 'Sophie', 'Marchand', '30 01'),
  hydro: company(10, 'hydro-toit', 'Hydro-Toit', 'Julien', 'Faure', '30 02'),
  lemoine: company(11, 'couverture-lemoine', 'Couverture Lemoine', 'Antoine', 'Lemoine', '30 03'),
  alu: company(12, 'alu-concept', 'Alu Concept Menuiseries', 'Inès', 'Haddad', '50 01'),
  val: company(null, 'fenetres-du-val', 'Fenêtres du Val', 'Laurent', 'Petit', '50 02'),
  platre: company(13, 'platrerie-francilienne', 'Plâtrerie Francilienne', 'Mehdi', 'Saidi', '70 01'),
  bertin: company(14, 'cloisons-bertin', 'Cloisons Bertin', 'Élodie', 'Bertin', '70 02'),
  lumiere: company(15, 'elec-lumiere', 'Elec Lumière Services', 'Romain', 'Girard', '11 01'),
  voltais: company(16, 'voltais', 'Voltaïs Électricité', 'Camille', 'Noël', '11 02'),
  continu: company(17, 'courant-continu', 'Courant Continu', 'David', 'Lambert', '11 03'),
} satisfies Record<string, ExampleCompany>

type CompanyKey = keyof typeof EXAMPLE_COMPANIES
const C = EXAMPLE_COMPANIES

/** Entreprises qui ont un compte (à créer dans la base) */
export const EXAMPLE_ACCOUNTS = Object.values(EXAMPLE_COMPANIES).filter((c): c is ExampleCompany & { id: string } => !!c.id)

// ————————————————————————— Outils —————————————————————————

/** [réf, libellé, unité, quantité, prix unitaire budget, 'option' pour une PSE] ; sans unité = chapitre */
type Row = [ref: string, label: string, unit?: string, qty?: number, pu?: number, scope?: 'option']

const itemId = (lot: string, ref: string) => `${lot}-${ref.replace(/\s+/g, '').toLowerCase()}`

function dpgf(lot: string, rows: Row[], descriptions: Record<string, string> = {}) {
  const items: DpgfItem[] = rows.map(([ref, label, unit, qty, , scope]) =>
    unit
      ? { id: itemId(lot, ref), kind: 'line', ref, label, unit, qty: qty ?? null, scope: scope ?? 'base', ...(descriptions[ref] ? { description: descriptions[ref] } : {}) }
      : { id: itemId(lot, ref), kind: 'chapter', ref, label, unit: '', qty: null, scope: 'base' },
  )
  const budget: Record<string, number> = {}
  for (const [ref, , unit, , pu] of rows) if (unit && pu != null) budget[itemId(lot, ref)] = pu
  return { items, budget }
}

// Générateur pseudo-aléatoire déterministe : l'exemple est identique pour tout le monde
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}
const round = (v: number) => (v >= 100 ? Math.round(v) : Math.round(v * 100) / 100)

interface OfferSpec {
  key: string
  company: CompanyKey
  /** Offre saisie par l'acheteur (reçue par e-mail, ou version négociée) */
  manual?: boolean
  version?: number
  received: number
  valid: number | null
  duration: number | null
  /** Niveau de prix par rapport au budget, dispersion ligne à ligne, graine */
  bias: number
  spread: number
  seed: number
  /** Prix imposés par référence ; null = ligne non chiffrée */
  set?: Record<string, PriceValue | null>
  /** Version négociée : reprend les prix d'une autre offre avec un coefficient */
  from?: { key: string; factor: number }
  discount?: number
  extras?: Omit<Extra, 'retained'>[]
  reserves?: string
  message?: string
}

function offers(lot: string, budget: Record<string, number>, specs: OfferSpec[]): ExampleOffer[] {
  const out: ExampleOffer[] = []
  for (const s of specs) {
    const co = C[s.company]
    let prices: Record<string, PriceValue> = {}
    if (s.from) {
      const base = out.find((o) => o.key === s.from!.key)!
      prices = Object.fromEntries(Object.entries(base.prices).map(([k, v]) => [k, typeof v === 'number' ? round(v * s.from!.factor) : v]))
    } else {
      const rand = rng(s.seed)
      for (const [id, pu] of Object.entries(budget)) prices[id] = round(pu * s.bias * (1 + (rand() - 0.5) * 2 * s.spread))
    }
    for (const [ref, v] of Object.entries(s.set ?? {})) {
      const id = itemId(lot, ref)
      if (v == null) delete prices[id]
      else prices[id] = v
    }
    out.push({
      key: s.key,
      company_id: s.manual ? null : co.id,
      source: s.manual ? 'manual' : 'platform',
      version: s.version ?? 1,
      company_name: co.company_name,
      contact_first_name: co.first_name,
      contact_last_name: co.last_name,
      contact_email: co.email,
      contact_phone: co.phone,
      logo_url: co.logo_url,
      received: s.received,
      valid: s.valid,
      prices,
      discount_pct: s.discount ?? 0,
      extras: (s.extras ?? []).map((e) => ({ ...e, retained: false })),
      duration_weeks: s.duration,
      reserves: s.reserves ?? '',
      message: s.message ?? '',
    })
  }
  return out
}

const access = (who: CompanyKey, status: ExampleAccess['status'], requested: number, decided: number | null = null, comment: string | null = null): ExampleAccess => ({
  user_id: C[who].id!,
  status,
  requested,
  decided,
  comment,
})

const DEFAULTS: Partial<CompareSettings> = { latestOnly: true, fillMode: 'median', pseRetained: {}, extrasRetained: {} }

// ————————————————————————— Lots —————————————————————————

function lotVrd(): ExampleLot {
  const key = 'vrd'
  const { items, budget } = dpgf(
    key,
    [
      ['1', 'Préparation'],
      ['1.1', 'Installation de chantier VRD, amenée et repli', 'ft', 1, 6500],
      ['1.2', 'Démolition de l’enrobé existant, évacuation comprise', 'm²', 380, 11],
      ['2', 'Terrassements'],
      ['2.1', 'Décapage de la terre végétale ép. 30 cm', 'm²', 900, 4.2],
      ['2.2', 'Déblais en pleine masse, évacuation en ISDI', 'm³', 620, 24],
      ['3', 'Réseaux'],
      ['3.1', 'Réseau eaux usées PVC CR8 Ø200', 'ml', 95, 92],
      ['3.2', 'Réseau eaux pluviales PVC CR8 Ø250', 'ml', 120, 98],
      ['3.3', 'Regards de visite béton Ø1000', 'u', 9, 1450],
      ['3.4', 'Bassin de rétention enterré 30 m³', 'ft', 1, 21000],
      ['4', 'Voirie'],
      ['4.1', 'Structure de chaussée en GNT ép. 40 cm', 'm²', 520, 17],
      ['4.2', 'Enrobé BBSG 0/10 ép. 6 cm', 'm²', 520, 21],
      ['4.3', 'Bordures béton T2', 'ml', 210, 39],
      ['5', 'Espaces verts'],
      ['5.1', 'Terre végétale, engazonnement et plantations', 'm²', 380, 16],
      ['PSE', 'Prestation supplémentaire éventuelle'],
      ['PSE 1', 'Portail coulissant motorisé à l’entrée du parking', 'u', 1, 7800, 'option'],
    ],
    {
      '3.4': 'Bassin en structures alvéolaires ultra-légères, géotextile et géomembrane compris, avec regard de régulation à débit de fuite limité à 2 l/s/ha.',
    },
  )
  const list = offers(key, budget, [
    {
      key: 'vrd-vexin', company: 'vexin', received: -23, valid: 40, duration: 10, bias: 0.97, spread: 0.08, seed: 11,
      message: 'Équipe dédiée et démarrage possible dès l’ordre de service. Nous avons réalisé les VRD de deux résidences comparables à Cergy.',
      extras: [{ id: 'vrd-vexin-x1', kind: 'option', label: 'Entretien des espaces verts pendant un an', amount: 3600 }],
    },
    {
      key: 'vrd-parisis', company: 'parisis', received: -22, valid: 30, duration: 12, bias: 0.92, spread: 0.1, seed: 29,
      set: { '3.4': null },
      reserves: 'Bassin de rétention non chiffré : en attente de l’étude de sol G2 PRO.',
    },
    {
      key: 'vrd-atlas', company: 'atlas', received: -24, valid: 30, duration: 9, bias: 1.09, spread: 0.07, seed: 47,
      message: 'Délai réduit grâce à deux ateliers en parallèle (réseaux et voirie).',
    },
  ])
  return {
    key, name: 'VRD et aménagements extérieurs', code: 'Lot 01 – VRD', status: 'published', due: -21, position: 0,
    description: 'Voiries, réseaux et espaces verts de la parcelle, du raccordement sur la rue jusqu’au pied de façade.',
    items, budget: 125000, budget_prices: budget,
    settings: { ...DEFAULTS },
    awarded: 'vrd-vexin',
    access: [access('vexin', 'approved', -40, -39), access('parisis', 'approved', -39, -39), access('atlas', 'approved', -38, -37)],
    offers: list,
    reviews: [
      { offer: 'vrd-vexin', scores: { tech: 16 }, verdict: 'favori' },
      { offer: 'vrd-parisis', scores: { tech: 12.5 }, verdict: 'ecarte' },
      { offer: 'vrd-atlas', scores: { tech: 14 }, verdict: null },
    ],
    comments: [
      { offer: 'vrd-vexin', at: -18, body: 'Références solides en VRD de résidence ; le conducteur de travaux était présent à la réunion de mise au point. Offre retenue.' },
      { offer: 'vrd-parisis', at: -19, body: 'La moins chère même avec le bassin ajouté au prix médian, mais réserve sur l’étude de sol et mémoire technique trop léger.' },
      { offer: 'vrd-atlas', at: -19, body: 'Délai le plus court, mais au-dessus du budget.' },
    ],
  }
}

function lotGo(): ExampleLot {
  const key = 'go'
  const { items, budget } = dpgf(
    key,
    [
      ['1', 'Installation de chantier'],
      ['1.1', 'Installation de chantier, grue à tour comprise', 'ft', 1, 68000],
      ['2', 'Infrastructure'],
      ['2.1', 'Terrassements en pleine masse du sous-sol', 'm³', 1450, 19],
      ['2.2', 'Fondations superficielles en béton armé', 'm³', 165, 310],
      ['2.3', 'Voiles enterrés en béton armé ép. 20 cm', 'm²', 640, 145],
      ['2.4', 'Dallage du sous-sol ép. 18 cm', 'm²', 610, 62],
      ['3', 'Superstructure'],
      ['3.1', 'Voiles en béton armé ép. 18 cm', 'm²', 2350, 118],
      ['3.2', 'Planchers en dalle pleine ép. 20 cm', 'm²', 1980, 96],
      ['3.3', 'Poteaux et poutres en béton armé', 'm³', 58, 690],
      ['3.4', 'Escaliers préfabriqués', 'u', 8, 3400],
      ['3.5', 'Balcons préfabriqués', 'u', 24, 2900],
      ['4', 'Maçonnerie'],
      ['4.1', 'Maçonnerie de blocs béton ép. 20 cm', 'm²', 420, 68],
      ['4.2', 'Seuils et appuis préfabriqués', 'ml', 260, 52],
      ['PSE', 'Prestation supplémentaire éventuelle'],
      ['PSE 1', 'Isolation sous dallage du sous-sol', 'm²', 610, 24, 'option'],
    ],
    {
      '1.1': 'Base vie, clôtures, accès, branchements provisoires et grue à tour pour toute la durée du gros œuvre (montage, location, démontage).',
    },
  )
  const list = offers(key, budget, [
    {
      key: 'go-oise', company: 'oise', received: -7, valid: 55, duration: 46, bias: 1.03, spread: 0.06, seed: 61,
      message: 'Offre établie sur le planning de consultation, grue à tour comprise.',
    },
    {
      key: 'go-fernandes', company: 'fernandes', received: -6, valid: 60, duration: 50, bias: 0.95, spread: 0.09, seed: 73,
      set: { '1.1': 41000 },
      reserves: 'Installation de chantier hors grue à tour : grue mise à disposition par l’entreprise générale.',
    },
    {
      key: 'go-seine', company: 'seine', received: -8, valid: 45, duration: 40, bias: 1.11, spread: 0.05, seed: 89,
      extras: [{ id: 'go-seine-x1', kind: 'variante', label: 'Prédalles en remplacement des dalles pleines coulées en place', amount: -18500 }],
      message: 'Délai de 40 semaines avec deux équipes de coffrage.',
    },
    {
      key: 'go-oise-v2', company: 'oise', manual: true, version: 2, received: -2, valid: 60, duration: 46, bias: 1, spread: 0, seed: 1,
      from: { key: 'go-oise', factor: 0.965 },
      discount: 1,
      message: 'Offre après la réunion de négociation : plancher haut du sous-sol optimisé et remise de 1 %.',
    },
  ])
  return {
    key, name: 'Gros œuvre', code: 'Lot 02 – Gros œuvre', status: 'published', due: -6, position: 1,
    description: 'Terrassements du sous-sol, fondations, structure en béton armé (R+3 sur sous-sol) et maçonneries.',
    items, budget: 940000, budget_prices: budget,
    settings: { ...DEFAULTS, pseRetained: { [itemId(key, 'PSE 1')]: true } },
    awarded: null,
    access: [
      access('oise', 'approved', -30, -29),
      access('fernandes', 'approved', -28, -27),
      access('seine', 'approved', -29, -29),
      access('express', 'refused', -15, -14),
      access('dumas', 'declined', -27, -12, 'Plan de charge complet jusqu’à l’été 2027 : nous ne pourrons pas répondre à cette consultation.'),
    ],
    offers: list,
    reviews: [
      { offer: 'go-oise-v2', scores: { tech: 16.5 }, verdict: 'favori' },
      { offer: 'go-oise', scores: { tech: 16.5 }, verdict: null },
      { offer: 'go-fernandes', scores: { tech: 13.5 }, verdict: 'negocier' },
      { offer: 'go-seine', scores: { tech: 15 }, verdict: null },
    ],
    comments: [
      { offer: 'go-oise-v2', at: -2, body: 'Après négociation : −3,5 % sur les prix et 1 % de remise. Reste à confirmer le planning du sous-sol.' },
      { offer: 'go-fernandes', at: -5, body: 'La moins chère, mais sans la grue : compter environ 25 000 € de location pour comparer à périmètre égal.' },
      { offer: 'go-seine', at: -5, body: 'Délai le plus court. La variante prédalles est à faire valider par le bureau d’études structure.' },
    ],
  }
}

function lotEtanch(): ExampleLot {
  const key = 'eta'
  const { items, budget } = dpgf(key, [
    ['1', 'Toiture terrasse inaccessible'],
    ['1.1', 'Pare-vapeur et isolant PIR ép. 160 mm', 'm²', 420, 58],
    ['1.2', 'Étanchéité bicouche élastomère', 'm²', 420, 42],
    ['1.3', 'Protection par gravillons', 'm²', 420, 9],
    ['1.4', 'Relevés d’étanchéité', 'ml', 135, 48],
    ['2', 'Terrasses accessibles'],
    ['2.1', 'Étanchéité sous dalles sur plots', 'm²', 140, 68],
    ['2.2', 'Dalles béton sur plots', 'm²', 140, 55],
    ['3', 'Ouvrages divers'],
    ['3.1', 'Entrées d’eaux pluviales et trop-pleins', 'u', 10, 340],
    ['3.2', 'Ligne de vie en toiture', 'ft', 1, 6200],
  ])
  return {
    key, name: 'Étanchéité', code: 'Lot 03 – Étanchéité', status: 'published', due: 6, position: 2,
    description: 'Toiture terrasse inaccessible et terrasses accessibles des logements du dernier étage.',
    items, budget: 80000, budget_prices: budget,
    settings: { ...DEFAULTS },
    awarded: null,
    access: [access('toits', 'approved', -13, -12), access('hydro', 'approved', -12, -11), access('lemoine', 'pending', -1)],
    offers: offers(key, budget, [
      {
        key: 'eta-toits', company: 'toits', received: -2, valid: 90, duration: 6, bias: 0.99, spread: 0.07, seed: 101,
        message: 'Offre conforme au DPGF. Attestation décennale à jour disponible sur demande.',
      },
    ]),
    reviews: [],
    comments: [],
  }
}

function lotMenuiseries(): ExampleLot {
  const key = 'mex'
  const { items, budget } = dpgf(key, [
    ['1', 'Fenêtres et portes-fenêtres PVC'],
    ['1.1', 'Fenêtres 2 vantaux 125 × 135', 'u', 54, 780],
    ['1.2', 'Portes-fenêtres 2 vantaux 145 × 215', 'u', 36, 1180],
    ['1.3', 'Châssis fixes des salles de bains', 'u', 18, 420],
    ['2', 'Occultations'],
    ['2.1', 'Volets roulants à manœuvre manuelle', 'u', 90, 390],
    ['3', 'Ouvrages divers'],
    ['3.1', 'Porte d’entrée du hall en aluminium', 'ft', 1, 9800],
    ['3.2', 'Garde-corps en aluminium', 'ml', 96, 260],
    ['PSE', 'Prestation supplémentaire éventuelle'],
    ['PSE 1', 'Motorisation des volets roulants', 'u', 90, 165, 'option'],
  ])
  return {
    key, name: 'Menuiseries extérieures', code: 'Lot 05 – Menuiseries extérieures', status: 'published', due: -10, position: 3,
    description: 'Fenêtres, portes-fenêtres et volets roulants des 18 logements, porte du hall et garde-corps.',
    items, budget: 165000, budget_prices: budget,
    settings: { ...DEFAULTS, pseRetained: { [itemId(key, 'PSE 1')]: true } },
    awarded: null,
    access: [access('alu', 'approved', -24, -23)],
    offers: offers(key, budget, [
      {
        key: 'mex-alu', company: 'alu', received: -11, valid: 60, duration: 14, bias: 1.02, spread: 0.06, seed: 131,
        extras: [
          { id: 'mex-alu-x1', kind: 'variante', label: 'Menuiseries aluminium à rupture de pont thermique au lieu du PVC', amount: 24800 },
          { id: 'mex-alu-x2', kind: 'option', label: 'Brise-soleil orientables sur la façade sud (12 baies)', amount: 14200 },
        ],
        message: 'Délai de 14 semaines dont 8 de fabrication après validation des plans d’atelier.',
      },
      {
        key: 'mex-val', company: 'val', manual: true, received: -9, valid: 30, duration: 16, bias: 0.95, spread: 0.08, seed: 149,
        set: { '3.2': null },
        reserves: 'Garde-corps non compris : à confier au lot serrurerie.',
      },
    ]),
    reviews: [
      { offer: 'mex-alu', scores: { tech: 15 }, verdict: null },
      { offer: 'mex-val', scores: { tech: 13 }, verdict: 'negocier' },
    ],
    comments: [{ offer: 'mex-val', at: -9, body: 'Offre reçue par e-mail et saisie par nos soins. Garde-corps exclus : à chiffrer au lot serrurerie avant de conclure.' }],
  }
}

function lotPlatrerie(): ExampleLot {
  const key = 'pla'
  const { items, budget } = dpgf(key, [
    ['1', 'Cloisons et doublages'],
    ['1.1', 'Doublages thermiques PSE + plaque, ép. 13 + 100', 'm²', 1650, 34],
    ['1.2', 'Cloisons de distribution 72/48', 'm²', 1900, 31],
    ['1.3', 'Cloisons hydrofuges des pièces humides', 'm²', 380, 39],
    ['2', 'Plafonds'],
    ['2.1', 'Faux plafonds en plaques de plâtre', 'm²', 420, 38],
    ['2.2', 'Plafonds acoustiques des circulations', 'm²', 160, 52],
    ['3', 'Divers'],
    ['3.1', 'Gaines techniques coupe-feu', 'ml', 210, 64],
  ])
  return {
    key, name: 'Plâtrerie, isolation, faux plafonds', code: 'Lot 07 – Plâtrerie', status: 'published', due: 2, position: 4,
    description: 'Doublages, cloisons, faux plafonds et gaines techniques des logements et des parties communes.',
    items, budget: 170000, budget_prices: budget,
    settings: { ...DEFAULTS },
    awarded: null,
    access: [
      access('platre', 'approved', -10, -9),
      access('bertin', 'declined', -9, -4, 'Délai trop court pour chiffrer correctement. Merci de nous reconsulter si la date de remise est reportée.'),
    ],
    offers: offers(key, budget, [
      {
        key: 'pla-platre', company: 'platre', received: -3, valid: 90, duration: 18, bias: 1, spread: 0.06, seed: 173,
        message: 'Nous restons disponibles pour une visite du site avant la date de remise.',
      },
    ]),
    reviews: [],
    comments: [],
  }
}

function lotElec(): ExampleLot {
  const key = 'ele'
  const { items, budget } = dpgf(key, [
    ['1', 'Courants forts'],
    ['1.1', 'Tableaux électriques des logements', 'u', 18, 980],
    ['1.2', 'Équipement des logements (prises, points lumineux)', 'u', 18, 2650],
    ['1.3', 'Éclairage LED des parties communes', 'ft', 1, 9800],
    ['1.4', 'Colonnes montantes et liaisons', 'ft', 1, 8600],
    ['2', 'Courants faibles'],
    ['2.1', 'Interphonie et contrôle d’accès', 'ft', 1, 7400],
    ['2.2', 'Fibre optique des logements', 'u', 18, 410],
    ['2.3', 'Détection incendie des parties communes', 'ft', 1, 5200],
    ['3', 'Sous-sol'],
    ['3.1', 'Éclairage et prises du parking', 'ft', 1, 6900],
    ['PSE', 'Prestation supplémentaire éventuelle'],
    ['PSE 1', 'Bornes de recharge pour véhicules électriques', 'u', 4, 1900, 'option'],
  ])
  return {
    key, name: 'Électricité courants forts et faibles', code: 'Lot 11 – Électricité', status: 'published', due: -4, position: 5,
    description: 'Installations électriques des logements, des parties communes et du parking ; interphonie et fibre.',
    items, budget: 115000, budget_prices: budget,
    settings: { ...DEFAULTS },
    awarded: null,
    access: [access('lumiere', 'approved', -20, -19), access('voltais', 'approved', -18, -18), access('continu', 'approved', -16, -15)],
    offers: offers(key, budget, [
      {
        key: 'ele-lumiere', company: 'lumiere', received: -5, valid: 60, duration: 20, bias: 1.01, spread: 0.07, seed: 191,
        message: 'Offre complète, PSE bornes de recharge comprise.',
      },
      {
        key: 'ele-voltais', company: 'voltais', received: -4, valid: -1, duration: 22, bias: 0.91, spread: 0.08, seed: 211,
        set: { '2.2': null, '2.3': null },
        reserves: 'Fibre optique : prestation de l’opérateur, non chiffrée. Détection incendie à confier à une entreprise spécialisée.',
      },
    ]),
    reviews: [
      { offer: 'ele-lumiere', scores: { tech: 14.5 }, verdict: null },
      { offer: 'ele-voltais', scores: { tech: 12 }, verdict: 'negocier' },
    ],
    comments: [{ offer: 'ele-voltais', at: -3, body: 'Moins chère mais incomplète, et validité dépassée : demander une offre complète et prolongée.' }],
  }
}

function lotPlomberie(): ExampleLot {
  const key = 'pcv'
  const { items, budget } = dpgf(key, [
    ['1', 'Production et distribution'],
    ['1.1', 'Pompes à chaleur collectives air/eau', 'ft', 1, 68000],
    ['1.2', 'Réseaux de chauffage et d’eau chaude sanitaire', 'ft', 1, 38000],
    ['2', 'Logements'],
    ['2.1', 'Appareils sanitaires (par logement)', 'u', 18, 3100],
    ['2.2', 'Radiateurs basse température', 'u', 72, 420],
    ['3', 'Ventilation'],
    ['3.1', 'VMC simple flux hygroréglable', 'ft', 1, 24000],
  ])
  return {
    key, name: 'Plomberie, chauffage, ventilation', code: 'Lot 12 – Plomberie CVC', status: 'draft', due: 25, position: 6,
    description: 'Production de chaleur collective, distribution, sanitaires et ventilation des logements.',
    items, budget: 220000, budget_prices: budget,
    settings: { ...DEFAULTS },
    awarded: null,
    access: [],
    offers: [],
    reviews: [],
    comments: [],
  }
}

export function buildExampleTemplate(): ExampleTemplate {
  const lots = [lotVrd(), lotGo(), lotEtanch(), lotMenuiseries(), lotPlatrerie(), lotElec(), lotPlomberie()]
  // Une entreprise rejoint le projet un jour avant sa première demande d'accès
  const joined = new Map<string, number>()
  for (const l of lots) for (const a of l.access) joined.set(a.user_id, Math.min(joined.get(a.user_id) ?? 0, a.requested - 1))
  return {
    project: {
      name: 'Résidence Le Clos des Lilas',
      reference: 'Léon Grosse – affaire 26-031',
      description:
        'Construction de 18 logements collectifs (R+3 sur sous-sol) à Pontoise (95). Entreprise générale : Léon Grosse.\n\n' +
        'Projet exemple : entreprises, contacts et montants fictifs. Rien n’est envoyé aux entreprises ; modifiez-le librement.',
    },
    members: [...joined].map(([user_id, d]) => ({ user_id, joined: d })),
    lots,
  }
}

// ————————————————————————— Copie pour un acheteur —————————————————————————
// Même logique que la fonction open_example_project() de la base (schema.sql) : sert à l'application
// de démonstration (?demo) et aux tests.

export interface ExampleRows {
  project: ProjectRow
  members: MemberRow[]
  lots: LotRow[]
  privates: LotPrivateRow[]
  access: LotAccessRow[]
  offers: OfferRow[]
  reviews: ReviewRow[]
  comments: CommentRow[]
}

export function materializeExample(
  t: ExampleTemplate,
  ctx: { ownerId: string; projectId: string; accessCode: string; now?: Date; id: (key: string) => string },
): ExampleRows {
  const now = ctx.now ?? new Date()
  const at = (days: number) => new Date(now.getTime() + days * 86_400_000)
  const ts = (days: number) => at(days).toISOString()
  const day = (days: number) => {
    const d = at(days)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }
  const rows: ExampleRows = {
    project: { id: ctx.projectId, owner_id: ctx.ownerId, ...t.project, access_code: ctx.accessCode, created_at: ts(0), is_example: true },
    members: t.members.map((m) => ({ project_id: ctx.projectId, user_id: m.user_id, joined_at: ts(m.joined) })),
    lots: [],
    privates: [],
    access: [],
    offers: [],
    reviews: [],
    comments: [],
  }
  for (const l of t.lots) {
    const lotId = ctx.id(`lot:${l.key}`)
    const oid = (key: string) => ctx.id(`offer:${key}`)
    rows.lots.push({
      id: lotId, project_id: ctx.projectId, name: l.name, code: l.code, description: l.description, due_date: day(l.due),
      status: l.status, items: l.items, position: l.position, created_at: ts(-45), updated_at: ts(-45),
    })
    rows.privates.push({ lot_id: lotId, budget: l.budget, budget_prices: l.budget_prices, settings: l.settings, awarded_offer_id: l.awarded ? oid(l.awarded) : null })
    for (const a of l.access) {
      rows.access.push({ lot_id: lotId, user_id: a.user_id, status: a.status, requested_at: ts(a.requested), decided_at: a.decided == null ? null : ts(a.decided), comment: a.comment })
    }
    for (const o of l.offers) {
      const { key, received, valid, ...rest } = o
      rows.offers.push({
        ...rest, id: oid(key), lot_id: lotId, status: 'submitted', received_at: day(received), valid_until: valid == null ? null : day(valid),
        submitted_at: o.source === 'platform' ? ts(received) : null, tech_note: null, updated_at: ts(received),
      })
    }
    for (const r of l.reviews) rows.reviews.push({ offer_id: oid(r.offer), lot_id: lotId, scores: r.scores, verdict: r.verdict })
    for (const c of l.comments) rows.comments.push({ id: ctx.id(`comment:${l.key}:${c.offer}:${c.at}`), offer_id: oid(c.offer), lot_id: lotId, author_id: ctx.ownerId, body: c.body, created_at: ts(c.at) })
  }
  return rows
}
