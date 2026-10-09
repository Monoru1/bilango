import { addDays, beninInstant, DAY_MS, toDayKey } from '@/domain/dates';
import { normalizeAmount } from '@/domain/reports';
import type {
  Business,
  DayKey,
  Invitation,
  Member,
  Payment,
  Report,
  ReportAmount,
  ReportContent,
  Role,
  StockItem,
  Subscription,
  User,
} from '@/domain/types';

/** Base de données en mémoire (jamais persistée : elle repart des données de démo à chaque lancement). */
export interface MockDb {
  users: User[];
  businesses: Business[];
  roles: Role[];
  members: Member[];
  invitations: Invitation[];
  reports: Report[];
  stockItems: StockItem[];
  subscriptions: Subscription[];
}

export const DEMO_OTP_CODE = '123456';

export const DEMO_ACCOUNTS = [
  {
    phone: '+2290197000001',
    label: 'Koffi — propriétaire (2 business) et livreur chez E-Shop',
  },
  { phone: '+2290197000002', label: 'Rodrigue — caissier, invitation en attente' },
  { phone: '+2290197000003', label: 'Fatou — gérante (gestion complète)' },
  { phone: '+2290197000004', label: 'Yacine — comptable (lecture seule)' },
  { phone: '+2290197000006', label: 'Nouveau numéro déjà invité' },
  { phone: '+2290197000099', label: 'Nouveau numéro sans business' },
] as const;

/** Générateur pseudo-aléatoire déterministe : les données de démo sont stables d'un lancement à l'autre. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const round500 = (n: number) => Math.round(n / 500) * 500;

function amount(total: number, lines: Array<[string, number]> = []): ReportAmount {
  return normalizeAmount({
    total,
    lines: lines.map(([label, value], i) => ({ id: `l${i}-${label}`, label, amount: value })),
  });
}

function content(
  revenue: ReportAmount,
  expenses: ReportAmount,
  cashIn: ReportAmount,
  stockSales: ReportContent['stockSales'] = [],
  note = '',
): ReportContent {
  return { revenue, expenses, cashIn, stockSales, note };
}

export function buildSeed(nowMs: number): MockDb {
  const today: DayKey = toDayKey(nowMs);
  const iso = (ms: number) => new Date(ms).toISOString();
  let counter = 0;
  const rid = () => `seed-r${++counter}`;

  const users: User[] = [
    { id: 'u-koffi', phone: '+2290197000001', name: 'Koffi Adjovi' },
    { id: 'u-rodrigue', phone: '+2290197000002', name: 'Rodrigue Sossou' },
    { id: 'u-fatou', phone: '+2290197000003', name: 'Fatou Dossou' },
    { id: 'u-yacine', phone: '+2290197000004', name: 'Yacine Bio' },
    { id: 'u-aicha', phone: '+2290197000005', name: 'Aïcha Hounkpatin' },
    { id: 'u-edgar', phone: '+2290197000007', name: 'Edgar Tossou' },
  ];

  const maman = 'b-maman';
  const etoile = 'b-etoile';
  const eshop = 'b-eshop';

  const businesses: Business[] = [
    {
      id: maman,
      ownerId: 'u-koffi',
      name: 'Chez Maman Bar',
      sector: 'bar_restaurant',
      stockEnabled: true,
      reminderTime: '20:00',
      openingCash: { amount: 150000, day: addDays(today, -20), declaredById: 'u-rodrigue' },
      createdAt: iso(nowMs - 60 * DAY_MS),
    },
    {
      id: etoile,
      ownerId: 'u-koffi',
      name: 'Boutique Étoile',
      sector: 'boutique',
      stockEnabled: false,
      reminderTime: '19:30',
      openingCash: { amount: 40000, day: addDays(today, -9), declaredById: 'u-koffi' },
      createdAt: iso(nowMs - 30 * DAY_MS),
    },
    {
      id: eshop,
      ownerId: 'u-aicha',
      name: 'E-Shop Cotonou',
      sector: 'ecommerce',
      stockEnabled: false,
      reminderTime: '21:00',
      openingCash: { amount: 25000, day: addDays(today, -6), declaredById: 'u-koffi' },
      createdAt: iso(nowMs - 40 * DAY_MS),
    },
  ];

  const roles: Role[] = [
    { id: 'r-gerant', businessId: maman, name: 'Gérant', level: 'full' },
    { id: 'r-caissier', businessId: maman, name: 'Caissier', level: 'entry' },
    { id: 'r-serveur', businessId: maman, name: 'Serveur', level: 'entry' },
    { id: 'r-comptable', businessId: maman, name: 'Comptable', level: 'readonly' },
    { id: 'r-vendeur', businessId: etoile, name: 'Vendeur', level: 'entry' },
    { id: 'r-gerant-e', businessId: etoile, name: 'Gérant', level: 'full' },
    { id: 'r-livreur', businessId: eshop, name: 'Livreur', level: 'entry' },
    { id: 'r-closer', businessId: eshop, name: 'Closer', level: 'entry' },
  ];

  const member = (id: string, businessId: string, userId: string, roleId: string | null, daysAgo: number): Member => ({
    id,
    businessId,
    userId,
    roleId,
    status: 'active',
    joinedAt: iso(nowMs - daysAgo * DAY_MS),
  });

  const members: Member[] = [
    member('m-1', maman, 'u-koffi', null, 60),
    member('m-2', maman, 'u-fatou', 'r-gerant', 50),
    member('m-3', maman, 'u-rodrigue', 'r-caissier', 40),
    member('m-4', maman, 'u-yacine', 'r-comptable', 30),
    {
      ...member('m-5', maman, 'u-edgar', 'r-serveur', 45),
      status: 'removed',
      removedAt: iso(nowMs - 12 * DAY_MS),
    },
    member('m-6', etoile, 'u-koffi', null, 30),
    member('m-7', eshop, 'u-aicha', null, 40),
    member('m-8', eshop, 'u-koffi', 'r-livreur', 20),
  ];

  const invitations: Invitation[] = [
    {
      id: 'inv-1',
      businessId: etoile,
      businessName: 'Boutique Étoile',
      phone: '+2290197000002',
      roleId: 'r-vendeur',
      roleName: 'Vendeur',
      level: 'entry',
      invitedById: 'u-koffi',
      invitedByName: 'Koffi Adjovi',
      status: 'pending',
      createdAt: iso(nowMs - 2 * 3600_000),
    },
    {
      id: 'inv-2',
      businessId: maman,
      businessName: 'Chez Maman Bar',
      phone: '+2290197000006',
      roleId: 'r-serveur',
      roleName: 'Serveur',
      level: 'entry',
      invitedById: 'u-koffi',
      invitedByName: 'Koffi Adjovi',
      status: 'pending',
      createdAt: iso(nowMs - 5 * 3600_000),
    },
  ];

  const stockItems: StockItem[] = [
    { id: 'st-biere', businessId: maman, name: 'Bière locale 33 cl', initialQuantity: 520 },
    { id: 'st-soda', businessId: maman, name: 'Soda 33 cl', initialQuantity: 320 },
    { id: 'st-eau', businessId: maman, name: 'Eau minérale 50 cl', initialQuantity: 260 },
    { id: 'st-poulet', businessId: maman, name: 'Poulet braisé', initialQuantity: 150 },
    { id: 'st-poisson', businessId: maman, name: 'Poisson frit', initialQuantity: 120 },
  ];

  // --- Bilans de Chez Maman Bar : 20 jours, parfois 2 contributeurs, quelques détails ---
  const reports: Report[] = [];
  const rand = rng(42);

  for (let offset = -20; offset <= -1; offset++) {
    const day = addDays(today, offset);
    const weekend = [5, 6].includes(new Date(Date.parse(`${day}T00:00:00Z`)).getUTCDay());
    const total = round500((weekend ? 160000 : 100000) + rand() * 60000);
    const expenses = round500(15000 + rand() * 25000);
    const detailed = offset % 2 === 0;
    const twoShifts = offset % 3 === 0;
    const early = offset <= -17;
    const sales = (min: number, max: number) => Math.floor(min + rand() * (max - min));
    const beer = sales(8, 18);
    const soda = sales(5, 12);
    const water = sales(4, 10);
    const chicken = sales(2, 6);
    const fish = sales(1, 5);

    const buildDay = (
      authorId: string,
      authorName: string,
      time: string,
      share: number,
      withCashIn: boolean,
      stock: ReportContent['stockSales'],
    ) => {
      const rev = round500(total * share);
      const exp = round500(expenses * share);
      const submittedAt = beninInstant(day, time);
      const revenue = detailed
        ? amount(rev, [
            ['Boissons', round500(rev * 0.62)],
            ['Cuisine', rev - round500(rev * 0.62)],
          ])
        : amount(rev);
      const expense = detailed
        ? amount(exp, [
            ['Achat glace', round500(exp * 0.4)],
            ['Transport', exp - round500(exp * 0.4)],
          ])
        : amount(exp);
      const cashIn = withCashIn ? amount(50000, [['Dépôt propriétaire', 50000]]) : amount(0);
      const r: Report = {
        id: rid(),
        businessId: maman,
        day,
        authorId,
        authorName,
        submittedAt,
        versions: [{ content: content(revenue, expense, cashIn, stock), savedAt: submittedAt }],
      };
      reports.push(r);
      return r;
    };

    const stock = [
      { itemId: 'st-biere', quantity: beer },
      { itemId: 'st-soda', quantity: soda },
      { itemId: 'st-eau', quantity: water },
      { itemId: 'st-poulet', quantity: chicken },
      { itemId: 'st-poisson', quantity: fish },
    ];
    const cashIn = offset % 6 === 0;
    const mainAuthor = early
      ? ({ id: 'u-edgar', name: 'Edgar Tossou' } as const)
      : ({ id: 'u-rodrigue', name: 'Rodrigue Sossou' } as const);

    if (twoShifts) {
      buildDay(mainAuthor.id, mainAuthor.name, '15:40', 0.4, false, stock.slice(0, 2));
      const evening = buildDay('u-fatou', 'Fatou Dossou', '22:10', 0.6, cashIn, stock.slice(2));
      if (offset === -3) {
        // Modification dans la fenêtre de 24 h : 2 versions consultables par le propriétaire.
        const editedAt = iso(Date.parse(evening.submittedAt) + 2 * 3600_000);
        const base = evening.versions[0].content;
        evening.versions.push({
          savedAt: editedAt,
          content: {
            ...base,
            revenue: amount(base.revenue.total + 5000),
            note: 'Ajout oublié : 5 000 FCFA de ventes à crédit réglées.',
          },
        });
      }
    } else {
      buildDay(mainAuthor.id, mainAuthor.name, '22:30', 1, cashIn, stock);
    }
  }

  // --- Boutique Étoile : bilans du propriétaire, dont un envoyé il y a 45 min (modifiable) ---
  const rand2 = rng(7);
  for (let offset = -8; offset <= -1; offset++) {
    const day = addDays(today, offset);
    const submittedAt = beninInstant(day, '19:15');
    const rev = round500(35000 + rand2() * 40000);
    reports.push({
      id: rid(),
      businessId: etoile,
      day,
      authorId: 'u-koffi',
      authorName: 'Koffi Adjovi',
      submittedAt,
      versions: [
        { content: content(amount(rev), amount(round500(4000 + rand2() * 8000)), amount(0)), savedAt: submittedAt },
      ],
    });
  }
  const justNow = nowMs - 45 * 60_000;
  reports.push({
    id: rid(),
    businessId: etoile,
    day: toDayKey(justNow),
    authorId: 'u-koffi',
    authorName: 'Koffi Adjovi',
    submittedAt: iso(justNow),
    versions: [
      {
        content: content(
          amount(48500, [
            ['Chaussures', 28500],
            ['Sacs', 20000],
          ]),
          amount(6000, [['Transport', 6000]]),
          amount(0),
          [],
          'Journée calme le matin.',
        ),
        savedAt: iso(justNow),
      },
    ],
  });

  // --- E-Shop Cotonou : bilans de Koffi en tant que livreur ---
  const rand3 = rng(99);
  for (let offset = -5; offset <= -1; offset++) {
    const day = addDays(today, offset);
    const submittedAt = beninInstant(day, '18:45');
    reports.push({
      id: rid(),
      businessId: eshop,
      day,
      authorId: 'u-koffi',
      authorName: 'Koffi Adjovi',
      submittedAt,
      versions: [
        {
          content: content(amount(round500(20000 + rand3() * 30000)), amount(round500(2000 + rand3() * 3000)), amount(0)),
          savedAt: submittedAt,
        },
      ],
    });
  }

  const payment = (id: string, daysAgo: number, provider: Payment['provider']): Payment => ({
    id,
    paidAt: iso(nowMs - daysAgo * DAY_MS),
    amount: 2000,
    provider,
    reference: `SUB-${id.toUpperCase()}`,
  });

  const subscriptions: Subscription[] = [
    {
      businessId: maman,
      trialEndsAt: iso(nowMs - 53 * DAY_MS),
      paidUntil: iso(nowMs + 11 * DAY_MS),
      payments: [payment('p-maman-2', 19, 'MTN Money'), payment('p-maman-1', 49, 'MTN Money')],
    },
    {
      businessId: etoile,
      trialEndsAt: iso(nowMs + 4 * DAY_MS),
      paidUntil: null,
      payments: [],
    },
    {
      businessId: eshop,
      trialEndsAt: null,
      paidUntil: iso(nowMs - 5 * DAY_MS),
      payments: [payment('p-eshop-1', 35, 'Moov Money')],
    },
  ];

  return { users, businesses, roles, members, invitations, reports, stockItems, subscriptions };
}
