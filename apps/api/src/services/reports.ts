import {
  buildHeadline,
  canEditReport,
  canSubmitReports,
  can,
  canViewReport,
  cashTimeline,
  COUNTRIES,
  currentVersion,
  employeeBlockedMessage,
  finalizeContent,
  remainingStockExcluding,
  subscriptionStatus,
  totalsOfDay,
  totalsOfPeriod,
  toDayKey,
  validateDraft,
  addDays,
  type Report,
  type ReportContent,
  type StockItem,
} from '@gobilan/domain';
import type { z } from 'zod';
import type { editReportSchema, submitReportSchema } from '@gobilan/contracts';
import { iso } from '../clock';
import type { Db } from '../db';
import type { Deps } from '../deps';
import { AppError, forbidden, notFound } from '../errors';
import { requireAccess, subscriptionOf, type AccessContext } from './access';
import type { SessionUser } from './auth';

type Submit = z.infer<typeof submitReportSchema>;
type Edit = z.infer<typeof editReportSchema>;

interface ReportRow {
  id: string;
  business_id: string;
  day: string;
  author_id: string;
  author_name: string;
  submitted_at: Date;
}
interface VersionRow {
  report_id: string;
  version_no: number;
  content: ReportContent;
  saved_at: Date;
}

async function loadReports(db: Db, businessId: string, where = '', params: unknown[] = []): Promise<Report[]> {
  // `where` est un fragment interne (jamais une entrée utilisateur) écrit avec l'alias `r`.
  const reports = (await db.query<ReportRow>(`select r.id, r.business_id, r.day, r.author_id, r.author_name, r.submitted_at from reports r where r.business_id = $1 ${where} order by r.submitted_at`, [businessId, ...params])).rows;
  if (reports.length === 0) return [];
  const versions = (
    await db.query<VersionRow>(
      `select rv.report_id, rv.version_no, rv.content, rv.saved_at from report_versions rv join reports r on r.id = rv.report_id where r.business_id = $1 ${where} order by rv.report_id, rv.version_no`,
      [businessId, ...params],
    )
  ).rows;
  const byReport = new Map<string, VersionRow[]>();
  for (const v of versions) byReport.set(v.report_id, [...(byReport.get(v.report_id) ?? []), v]);
  return reports.map((r) => ({
    id: r.id,
    businessId: r.business_id,
    day: r.day,
    authorId: r.author_id,
    authorName: r.author_name,
    submittedAt: r.submitted_at.toISOString(),
    versions: (byReport.get(r.id) ?? []).map((v) => ({ content: v.content, savedAt: v.saved_at.toISOString() })),
  }));
}

async function loadStock(db: Db, businessId: string): Promise<StockItem[]> {
  return (await db.query<{ id: string; business_id: string; name: string; initial_quantity: number }>('select id, business_id, name, initial_quantity from stock_items where business_id = $1', [businessId])).rows.map((r) => ({
    id: r.id,
    businessId: r.business_id,
    name: r.name,
    initialQuantity: r.initial_quantity,
  }));
}

export class ReportService {
  constructor(private readonly deps: Deps) {}

  private get now() {
    return this.deps.clock.now();
  }

  /** Bloque la saisie dès le 4e jour d'impayé ; le message reste neutre pour un employé (§8.3 bis). */
  private assertCanWrite(ctx: AccessContext): void {
    const status = subscriptionStatus(subscriptionOf(ctx.business), this.now);
    if (!canSubmitReports(status)) {
      const msg = ctx.access.isOwner ? 'Votre abonnement a expiré. Renouvelez pour reprendre la saisie.' : employeeBlockedMessage(ctx.business.name);
      throw new AppError('subscription_blocked', msg);
    }
  }

  /**
   * Enregistre un bilan. La date est celle du SERVEUR dans le fuseau du pays du business : le client
   * ne peut ni antidater ni saisir après coup (§8.4). Idempotent sur `clientRequestId`.
   */
  async submit(actor: SessionUser, businessId: string, input: Submit): Promise<{ id: string; day: string; duplicate: boolean }> {
    return this.deps.db.tx(async (t) => {
      const ctx = await requireAccess(t, actor.id, businessId, { forUpdate: true });
      if (!can(ctx.access, 'submitReport')) throw forbidden();
      this.assertCanWrite(ctx);

      const dup = (await t.query<{ id: string; day: string }>('select id, day from reports where business_id = $1 and author_id = $2 and client_request_id = $3', [businessId, actor.id, input.clientRequestId])).rows[0];
      if (dup) return { id: dup.id, day: dup.day, duplicate: true };

      const offset = COUNTRIES[ctx.business.country].utcOffsetMinutes;
      const day = toDayKey(this.now, offset);
      const content = this.toContent(input.content, ctx.business.stock_enabled);
      const firstReport = ctx.business.opening_cash_amount === null;
      const stock = ctx.business.stock_enabled ? await loadStock(t, businessId) : [];
      const reports = ctx.business.stock_enabled ? await loadReports(t, businessId) : [];

      const check = validateDraft(content, {
        openingCashRequired: firstReport,
        openingCash: input.openingCash ?? null,
        ...(ctx.business.stock_enabled ? { remainingStock: remainingStockExcluding(stock, reports, businessId) } : {}),
      });
      if (!check.ok) throw new AppError('validation', Object.values(check.errors)[0] ?? 'Bilan invalide.');

      if (firstReport) {
        // La caisse de départ se déclare UNE seule fois (§6.4) : la condition `is null` fait foi même en concurrence.
        await t.query(
          `update businesses set opening_cash_amount = $2, opening_cash_day = $3, opening_cash_by = $4 where id = $1 and opening_cash_amount is null`,
          [businessId, input.openingCash, day, actor.id],
        );
      }
      const authorName = actor.name || 'Sans nom';
      const id = (
        await t.query<{ id: string }>(
          `insert into reports(business_id, day, author_id, author_name, submitted_at, client_request_id) values ($1,$2,$3,$4,$5,$6) returning id`,
          [businessId, day, actor.id, authorName, iso(this.now), input.clientRequestId],
        )
      ).rows[0]!.id;
      await t.query('insert into report_versions(report_id, version_no, content, saved_at) values ($1,1,$2::jsonb,$3)', [id, JSON.stringify(content), iso(this.now)]);

      // Texte sans montant : il s'affiche sur l'écran verrouillé (§9.2).
      if (!ctx.access.isOwner) {
        await this.deps.providers.push.sendToUser(ctx.business.owner_id, { title: 'GoBilan', body: `Nouveau bilan reçu — ${ctx.business.name}`, badge: true, tag: `report-${businessId}` }).catch(() => undefined);
      }
      return { id, day, duplicate: false };
    });
  }

  /**
   * Modification : seul l'AUTEUR, dans les 24 h après l'envoi initial (les modifications ne
   * prolongent pas la fenêtre). La version d'origine n'est jamais écrasée : on AJOUTE une version
   * (le schéma interdit UPDATE/DELETE sur `report_versions`). Le propriétaire est notifié (§6.6).
   */
  async edit(actor: SessionUser, reportId: string, input: Edit): Promise<{ versionNo: number }> {
    return this.deps.db.tx(async (t) => {
      if (!/^[0-9a-f-]{36}$/i.test(reportId)) throw notFound();
      const row = (await t.query<ReportRow>('select id, business_id, day, author_id, author_name, submitted_at from reports where id = $1 for update', [reportId])).rows[0];
      if (!row) throw notFound();
      // Le cloisonnement passe par le business du bilan, pas par un paramètre fourni par l'appelant.
      const ctx = await requireAccess(t, actor.id, row.business_id, { forUpdate: true });
      this.assertCanWrite(ctx);
      // Un bilan qu'on n'a pas le droit de VOIR est « introuvable » : on ne confirme pas son existence.
      if (!can(ctx.access, 'viewAllReports') && row.author_id !== actor.id) throw notFound();
      const asDomain = { businessId: row.business_id, authorId: row.author_id, submittedAt: row.submitted_at.toISOString() };
      if (!canEditReport(ctx.access, asDomain, actor.id, this.now)) {
        if (row.author_id === actor.id && can(ctx.access, 'submitReport')) {
          throw new AppError('edit_window_closed', 'La modification n\'est plus possible 24 heures après l\'envoi.');
        }
        throw forbidden('Seul l\'auteur peut modifier son bilan.');
      }
      const content = this.toContent(input.content, ctx.business.stock_enabled);
      const stock = ctx.business.stock_enabled ? await loadStock(t, row.business_id) : [];
      const reports = ctx.business.stock_enabled ? await loadReports(t, row.business_id) : [];
      const check = validateDraft(content, ctx.business.stock_enabled ? { remainingStock: remainingStockExcluding(stock, reports, row.business_id, reportId) } : {});
      if (!check.ok) throw new AppError('validation', Object.values(check.errors)[0] ?? 'Bilan invalide.');

      const next = (await t.query<{ n: number }>('select coalesce(max(version_no),0) + 1 as n from report_versions where report_id = $1', [reportId])).rows[0]!.n;
      await t.query('insert into report_versions(report_id, version_no, content, saved_at) values ($1,$2,$3::jsonb,$4)', [reportId, next, JSON.stringify(content), iso(this.now)]);
      if (!ctx.access.isOwner) {
        await this.deps.providers.push.sendToUser(ctx.business.owner_id, { title: 'GoBilan', body: `Bilan modifié — ${ctx.business.name}`, badge: true, tag: `report-${row.business_id}` }).catch(() => undefined);
      }
      return { versionNo: Number(next) };
    });
  }

  private toContent(input: Submit['content'], stockEnabled: boolean): ReportContent {
    const withIds = (a: Submit['content']['revenue']) => ({ total: a.total, lines: a.lines.map((l, i) => ({ id: `l${i + 1}`, label: l.label, amount: l.amount })) });
    const content: ReportContent = {
      revenue: withIds(input.revenue),
      expenses: withIds(input.expenses),
      cashIn: withIds(input.cashIn),
      stockSales: stockEnabled ? input.stockSales : [],
      note: input.note,
    };
    if (!stockEnabled && input.stockSales.length > 0) throw new AppError('validation', "Le module Stock n'est pas activé.");
    return finalizeContent(content);
  }

  /** Historique : tout pour « Gestion complète » / lecture seule / propriétaire, ses propres bilans pour « Saisie seule » (§6.5). */
  async list(actor: SessionUser, businessId: string, limit = 60): Promise<Report[]> {
    const ctx = await requireAccess(this.deps.db, actor.id, businessId);
    const all = await loadReports(this.deps.db, businessId, 'and r.day >= $2', [addDays(toDayKey(this.now, COUNTRIES[ctx.business.country].utcOffsetMinutes), -400)]);
    return all
      .filter((r) => canViewReport(ctx.access, r, actor.id))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .slice(0, Math.min(limit, 200));
  }

  async get(actor: SessionUser, reportId: string): Promise<Report> {
    if (!/^[0-9a-f-]{36}$/i.test(reportId)) throw notFound();
    const row = (await this.deps.db.query<{ business_id: string }>('select business_id from reports where id = $1', [reportId])).rows[0];
    if (!row) throw notFound();
    const ctx = await requireAccess(this.deps.db, actor.id, row.business_id);
    const report = (await loadReports(this.deps.db, row.business_id, 'and r.id = $2', [reportId]))[0];
    if (!report || !canViewReport(ctx.access, report, actor.id)) throw notFound();
    return report;
  }

  /** Données du tableau de bord propriétaire (§7.1) : chiffre principal jamais à zéro, caisse, dépenses, détail du jour. */
  async dashboard(actor: SessionUser, businessId: string) {
    const ctx = await requireAccess(this.deps.db, actor.id, businessId);
    if (!can(ctx.access, 'viewDashboard')) throw forbidden();
    const status = subscriptionStatus(subscriptionOf(ctx.business), this.now);
    if (status === 'blocked') throw new AppError('subscription_blocked', 'Tableau de bord indisponible : renouvelez votre abonnement.');
    const offset = COUNTRIES[ctx.business.country].utcOffsetMinutes;
    const today = toDayKey(this.now, offset);
    const reports = await loadReports(this.deps.db, businessId);
    const business = {
      id: businessId,
      country: ctx.business.country,
      openingCash: ctx.business.opening_cash_amount !== null && ctx.business.opening_cash_day ? { amount: Number(ctx.business.opening_cash_amount), day: ctx.business.opening_cash_day, declaredById: ctx.business.opening_cash_by ?? '' } : null,
    };
    const headline = buildHeadline(reports, businessId, today);
    const cash = cashTimeline(business, reports, today);
    const todayCash = cash[cash.length - 1] ?? null;
    const dayTotals = totalsOfDay(reports, businessId, headline.day ?? today);
    return {
      today,
      headline,
      periods: {
        today: totalsOfPeriod(reports, businessId, today, 1),
        week: totalsOfPeriod(reports, businessId, today, 7),
        month: totalsOfPeriod(reports, businessId, today, 30),
      },
      theoreticalCash: todayCash?.closing ?? null,
      expensesToday: dayTotals.expenses,
      cashDay: todayCash,
      contributors: reports
        .filter((r) => r.day === (headline.day ?? today))
        .map((r) => ({ reportId: r.id, authorName: r.authorName, submittedAt: r.submittedAt, edited: r.versions.length > 1, revenue: currentVersion(r).content.revenue.total })),
    };
  }
}
