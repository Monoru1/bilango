import { WorkspaceService } from '../services/workspace';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import {
  adminAllowlistChangeSchema, adminAllowlistConfirmSchema, checkoutSchema, createBusinessSchema, createPartnerSchema, createPinSchema, createRoleSchema, editReportSchema, excludeReferralSchema, inviteMemberSchema,
  loginPinSchema, partnerActivateSchema, partnerForgotSchema, partnerLoginSchema, partnerResetSchema, payoutBlockSchema, profileSchema, registerAgentSchema,
  requestOtpSchema, respondInvitationSchema, reversePayoutSchema, stockItemSchema, submitReportSchema, updateBusinessSchema, validatePayoutSchema, verifyOtpSchema,
} from '@gobilan/contracts';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { z, ZodError } from 'zod';
import type { Deps } from '../deps';
import { AppError } from '../errors';
import { AdminService, type AdminSession } from '../services/admin';
import { AuthService, type SessionUser } from '../services/auth';
import { BusinessService } from '../services/business';
import { PartnerService, type PartnerSession } from '../services/partners';
import { ReportService } from '../services/reports';
import { SubscriptionService } from '../services/subscriptions';

/**
 * Trois audiences, trois cookies distincts : une session partenaire ne peut jamais servir
 * d'accès administrateur ni inversement. Cookies httpOnly + SameSite=Lax (+ Secure hors dev).
 */
const COOKIE = { user: 'gb_user', partner: 'gb_partner', admin: 'gb_admin' } as const;
type Audience = keyof typeof COOKIE;
const CSRF_HEADER = 'x-gobilan-csrf';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export interface AppOptions {
  secureCookies: boolean;
  /** Désactivé dans les tests unitaires pour ne pas dépendre du temps réel. */
  rateLimit: boolean;
}

const idParam = z.object({ id: z.string().uuid() });
const bizParam = z.object({ businessId: z.string().uuid() });

export function buildApp(deps: Deps, opts: AppOptions = { secureCookies: true, rateLimit: true }): FastifyInstance {
  const app = Fastify({ logger: false, trustProxy: false, bodyLimit: 256 * 1024 });
  const auth = new AuthService(deps);
  const biz = new BusinessService(deps);
  const reports = new ReportService(deps);
  const subs = new SubscriptionService(deps);
  const partners = new PartnerService(deps);
  const admin = new AdminService(deps);

  // Corps JSON conservé en texte brut : la signature du webhook porte sur les octets exacts reçus.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    req.rawBody = body as string;
    if (!body) return done(null, {});
    try {
      done(null, JSON.parse(body as string));
    } catch {
      done(new AppError('validation', 'Corps JSON invalide.'), undefined);
    }
  });
  void app.register(cookie);
  if (opts.rateLimit) void app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' });

  app.addHook('onSend', async (_req, reply) => {
    reply.header('cache-control', 'no-store');
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'no-referrer');
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) {
      if (err.retryAfterSeconds) void reply.header('retry-after', String(err.retryAfterSeconds));
      return reply.status(err.status).send(err.toBody());
    }
    if (err instanceof ZodError) return reply.status(400).send({ error: { code: 'validation', message: err.issues[0]?.message ?? 'Données invalides.' } });
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 429) return reply.status(429).send({ error: { code: 'rate_limited', message: 'Trop de requêtes. Réessayez dans un instant.' } });
    if (status && status >= 400 && status < 500) return reply.status(status).send({ error: { code: 'validation', message: 'Requête invalide.' } });
    // Aucune fuite de détail interne (SQL, pile) vers le client.
    console.error('[api] erreur interne', err instanceof Error ? err.message : err);
    return reply.status(500).send({ error: { code: 'internal', message: 'Une erreur est survenue. Réessayez.' } });
  });

  // --- CSRF : en-tête personnalisé (impossible en formulaire croisé) + Origin autorisée par audience ---
  function csrf(req: FastifyRequest, audience: Audience) {
    if (req.method === 'GET' || req.method === 'HEAD') return;
    if (req.headers[CSRF_HEADER] !== '1') throw new AppError('forbidden', 'Requête refusée.');
    const origin = req.headers.origin;
    const allowed = audience === 'user' ? deps.config.origins.pwa : audience === 'partner' ? deps.config.origins.partners : deps.config.origins.admin;
    if (!origin || !allowed.includes(origin)) throw new AppError('forbidden', 'Requête refusée.');
  }

  function setSession(reply: FastifyReply, audience: Audience, token: string, maxAgeSeconds: number) {
    void reply.setCookie(COOKIE[audience], token, { httpOnly: true, secure: opts.secureCookies, sameSite: 'lax', path: '/', maxAge: maxAgeSeconds });
  }
  const clear = (reply: FastifyReply, audience: Audience) => void reply.clearCookie(COOKIE[audience], { path: '/' });

  async function user(req: FastifyRequest): Promise<{ user: SessionUser; deviceId: string; token: string }> {
    csrf(req, 'user');
    const token = req.cookies[COOKIE.user];
    const s = token ? await auth.resolveSession(token) : null;
    if (!s || !token) throw new AppError('unauthenticated', 'Session expirée. Reconnectez-vous.');
    return { ...s, token };
  }
  async function partner(req: FastifyRequest): Promise<{ partner: PartnerSession; token: string }> {
    csrf(req, 'partner');
    const token = req.cookies[COOKIE.partner];
    const s = token ? await partners.resolveSession(token) : null;
    if (!s || !token) throw new AppError('unauthenticated', 'Session expirée. Reconnectez-vous.');
    return { partner: s, token };
  }
  async function adminSession(req: FastifyRequest): Promise<{ admin: AdminSession; token: string }> {
    csrf(req, 'admin');
    const token = req.cookies[COOKIE.admin];
    const s = token ? await admin.resolveSession(token) : null;
    if (!s || !token) throw new AppError('unauthenticated', 'Session expirée. Reconnectez-vous.');
    return { admin: s, token };
  }
  const authLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.get('/health', async () => ({ ok: true }));

  // ================= Utilisateurs (PWA) =================
  app.post('/v1/auth/otp/request', authLimit, async (req) => {
    csrf(req, 'user');
    return auth.requestOtp(requestOtpSchema.parse(req.body), req.ip);
  });
  app.post('/v1/auth/otp/verify', authLimit, async (req, reply) => {
    csrf(req, 'user');
    const res = await auth.verifyOtp(verifyOtpSchema.parse(req.body));
    if (res.kind === 'session') {
      setSession(reply, 'user', res.session.token, deps.config.userSessionDays * 86400);
      return { kind: 'session', user: res.session.user, otherDevices: res.otherDevices };
    }
    return res;
  });
  app.post('/v1/auth/pin/create', authLimit, async (req, reply) => {
    csrf(req, 'user');
    const s = await auth.createPin(createPinSchema.parse(req.body));
    setSession(reply, 'user', s.token, deps.config.userSessionDays * 86400);
    return { user: s.user };
  });
  app.post('/v1/auth/pin/login', authLimit, async (req, reply) => {
    csrf(req, 'user');
    const s = await auth.loginPin(loginPinSchema.parse(req.body));
    setSession(reply, 'user', s.token, deps.config.userSessionDays * 86400);
    return { user: s.user };
  });
  app.post('/v1/auth/logout', async (req, reply) => {
    csrf(req, 'user');
    const t = req.cookies[COOKIE.user];
    if (t) await auth.logout(t);
    clear(reply, 'user');
    return { ok: true };
  });
  app.get('/v1/me', async (req) => ({ user: (await user(req)).user }));
  app.put('/v1/me/profile', async (req) => {
    const u = await user(req);
    const b = profileSchema.parse(req.body);
    await auth.updateProfile(u.user.id, b.name, b.referralCode);
    return { ok: true };
  });

  app.post('/v1/auth/devices/logout-others', async (req) => {
    const u = await user(req);
    return { revoked: await auth.logoutOtherDevices(u.user.id, u.deviceId) };
  });
  app.get('/v1/businesses/:businessId/workspace', async (req) => new WorkspaceService(deps).load((await user(req)).user, bizParam.parse(req.params).businessId));
  app.get('/v1/me/invitations', async (req) => ({ invitations: await new WorkspaceService(deps).invitations('i.phone=$1', (await user(req)).user.phone) }));

  // ================= Business =================
  app.get('/v1/businesses', async (req) => ({ businesses: await biz.listMine((await user(req)).user) }));
  app.post('/v1/businesses', async (req) => {
    const u = await user(req);
    return biz.createBusiness(u.user, u.deviceId, createBusinessSchema.parse(req.body));
  });
  app.patch('/v1/businesses/:businessId', async (req) => {
    const u = await user(req);
    await biz.update(u.user, bizParam.parse(req.params).businessId, updateBusinessSchema.parse(req.body));
    return { ok: true };
  });
  app.get('/v1/businesses/:businessId/roles', async (req) => ({ roles: await biz.listRoles((await user(req)).user, bizParam.parse(req.params).businessId) }));
  app.post('/v1/businesses/:businessId/roles', async (req) => biz.createRole((await user(req)).user, bizParam.parse(req.params).businessId, createRoleSchema.parse(req.body)));
  app.get('/v1/businesses/:businessId/members', async (req) => ({ members: await biz.listMembers((await user(req)).user, bizParam.parse(req.params).businessId) }));
  app.post('/v1/businesses/:businessId/invitations', async (req) => biz.invite((await user(req)).user, bizParam.parse(req.params).businessId, inviteMemberSchema.parse(req.body)));
  app.delete('/v1/businesses/:businessId/members/:id', async (req) => {
    const p = z.object({ businessId: z.string().uuid(), id: z.string().uuid() }).parse(req.params);
    await biz.removeMember((await user(req)).user, p.businessId, p.id);
    return { ok: true };
  });
  app.get('/v1/invitations', async (req) => ({ invitations: await biz.myInvitations((await user(req)).user) }));
  app.post('/v1/invitations/:id/respond', async (req) => {
    await biz.respondInvitation((await user(req)).user, idParam.parse(req.params).id, respondInvitationSchema.parse(req.body).accept);
    return { ok: true };
  });
  app.get('/v1/businesses/:businessId/stock', async (req) => ({ items: await biz.listStock((await user(req)).user, bizParam.parse(req.params).businessId) }));
  app.post('/v1/businesses/:businessId/stock', async (req) => biz.addStockItem((await user(req)).user, bizParam.parse(req.params).businessId, stockItemSchema.parse(req.body)));

  // ================= Bilans =================
  app.post('/v1/businesses/:businessId/reports', async (req) => reports.submit((await user(req)).user, bizParam.parse(req.params).businessId, submitReportSchema.parse(req.body)));
  app.get('/v1/businesses/:businessId/reports', async (req) => ({ reports: await reports.list((await user(req)).user, bizParam.parse(req.params).businessId) }));
  app.get('/v1/businesses/:businessId/dashboard', async (req) => reports.dashboard((await user(req)).user, bizParam.parse(req.params).businessId));
  app.get('/v1/reports/:id', async (req) => ({ report: await reports.get((await user(req)).user, idParam.parse(req.params).id) }));
  app.put('/v1/reports/:id', async (req) => reports.edit((await user(req)).user, idParam.parse(req.params).id, editReportSchema.parse(req.body)));

  // ================= Abonnement =================
  app.get('/v1/businesses/:businessId/subscription', async (req) => subs.view((await user(req)).user, bizParam.parse(req.params).businessId));
  app.post('/v1/subscription/checkout', async (req) => subs.createCheckout((await user(req)).user, checkoutSchema.parse(req.body).businessId));
  // Webhook : pas de cookie ni CSRF — authentifié par la signature HMAC du corps brut.
  app.post('/v1/webhooks/fedapay', async (req, reply) => {
    const sig = req.headers['x-fedapay-signature'];
    const outcome = await subs.handleWebhook(req.rawBody ?? '', typeof sig === 'string' ? sig : undefined);
    return reply.status(200).send({ received: true, outcome });
  });

  // ================= Partenaires =================
  app.get('/v1/partner/activation', authLimit, async (req) => {
    const q = z.object({ token: z.string().min(16).max(256) }).parse(req.query);
    return partners.previewActivation(q.token);
  });
  app.post('/v1/partner/activate', authLimit, async (req, reply) => {
    csrf(req, 'partner');
    const b = partnerActivateSchema.parse(req.body);
    const r = await partners.activate(b.token, b.password, b.acceptedAgreementVersion, req.ip);
    setSession(reply, 'partner', r.token, deps.config.partnerSessionHours * 3600);
    return { partner: r.partner };
  });
  app.post('/v1/partner/login', authLimit, async (req, reply) => {
    csrf(req, 'partner');
    const b = partnerLoginSchema.parse(req.body);
    const r = await partners.login(b.email, b.password);
    setSession(reply, 'partner', r.token, deps.config.partnerSessionHours * 3600);
    return { partner: r.partner };
  });
  app.post('/v1/partner/forgot', authLimit, async (req) => {
    csrf(req, 'partner');
    return partners.forgotPassword(partnerForgotSchema.parse(req.body).email);
  });
  app.post('/v1/partner/reset', authLimit, async (req) => {
    csrf(req, 'partner');
    const b = partnerResetSchema.parse(req.body);
    await partners.resetPassword(b.email, b.code, b.password);
    return { ok: true };
  });
  app.post('/v1/partner/logout', async (req, reply) => {
    csrf(req, 'partner');
    const t = req.cookies[COOKIE.partner];
    if (t) await partners.logout(t);
    clear(reply, 'partner');
    return { ok: true };
  });
  app.get('/v1/partner/me', async (req) => ({ partner: (await partner(req)).partner }));
  app.post('/v1/partner/agreement', async (req) => {
    const p = await partner(req);
    await partners.acceptAgreement(p.partner, z.object({ version: z.string().min(1).max(16) }).parse(req.body).version, req.ip);
    return { ok: true };
  });
  app.get('/v1/partner/dashboard', async (req) => partners.dashboard((await partner(req)).partner));
  app.post('/v1/partner/agents', async (req) => partners.registerAgent((await partner(req)).partner, registerAgentSchema.parse(req.body)));
  app.get('/v1/partner/payout-block', async (req) => ({ block: await partners.getPayoutBlock((await partner(req)).partner) }));
  app.put('/v1/partner/payout-block', async (req) => {
    await partners.setPayoutBlock((await partner(req)).partner, payoutBlockSchema.parse(req.body));
    return { ok: true };
  });
  app.get('/v1/partner/payouts', async (req) => ({ payouts: await partners.payoutHistory((await partner(req)).partner) }));

  // ================= Administration =================
  app.post('/v1/admin/login', authLimit, async (req) => {
    csrf(req, 'admin');
    const b = z.object({ email: z.string().email(), password: z.string().min(1).max(256) }).parse(req.body);
    return admin.startLogin(b.email, b.password);
  });
  app.post('/v1/admin/login/verify', authLimit, async (req, reply) => {
    csrf(req, 'admin');
    const b = z.object({ challengeId: z.string(), code: z.string().regex(/^\d{6}$/) }).parse(req.body);
    const r = await admin.verifyLogin(b.challengeId, b.code);
    setSession(reply, 'admin', r.token, deps.config.adminSessionMinutes * 60);
    return { admin: r.admin };
  });
  app.post('/v1/admin/logout', async (req, reply) => {
    csrf(req, 'admin');
    const t = req.cookies[COOKIE.admin];
    if (t) await admin.logout(t);
    clear(reply, 'admin');
    return { ok: true };
  });
  app.get('/v1/admin/me', async (req) => ({ admin: (await adminSession(req)).admin }));
  app.get('/v1/admin/allowlist', async (req) => { await adminSession(req); return { admins: await admin.listAllowlist() }; });
  app.post('/v1/admin/allowlist/request', authLimit, async (req) => admin.requestAllowlistChange((await adminSession(req)).admin, adminAllowlistChangeSchema.parse(req.body)));
  app.post('/v1/admin/allowlist/confirm', authLimit, async (req) => {
    const actor = await adminSession(req); const input = adminAllowlistConfirmSchema.parse(req.body);
    await admin.confirmAllowlistChange(actor.admin, input.requestId, input.code); return { ok: true };
  });
  app.get('/v1/admin/stats', async (req) => (await adminSession(req), admin.stats()));
  app.get('/v1/admin/referrals', async req => { await adminSession(req); return { referrals: await admin.listReferrals() }; });
  app.get('/v1/admin/subscriptions', async req => {
    await adminSession(req); const q = z.object({ offset: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(req.query);
    return { subscriptions: await admin.listSubscriptions(q.offset, q.limit) };
  });
  app.put('/v1/admin/partners/:id/payout-block', async req => { await admin.updatePayoutBlock((await adminSession(req)).admin, idParam.parse(req.params).id, payoutBlockSchema.parse(req.body)); return { ok: true }; });
  app.get('/v1/admin/audit', async (req) => (await adminSession(req), { entries: await admin.auditLog() }));
  app.get('/v1/admin/partners', async (req) => {
    await adminSession(req);
    const q = z.object({ country: z.string().optional(), from: z.string().optional(), to: z.string().optional() }).parse(req.query);
    return { partners: await admin.listPartners({ ...(q.country ? { country: q.country } : {}), ...(q.from ? { from: q.from } : {}), ...(q.to ? { to: q.to } : {}) }) };
  });
  app.post('/v1/admin/partners', async (req) => {
    const a = await adminSession(req);
    return partners.createByAdmin(a.admin.email, createPartnerSchema.parse(req.body));
  });
  app.post('/v1/admin/partners/:id/status', async (req) => {
    const a = await adminSession(req);
    const b = z.object({ status: z.enum(['active', 'suspended', 'removed']) }).parse(req.body);
    await admin.setPartnerStatus(a.admin, idParam.parse(req.params).id, b.status);
    return { ok: true };
  });
  app.post('/v1/admin/referrals/exclude', async (req) => admin.excludeReferral((await adminSession(req)).admin, excludeReferralSchema.parse(req.body)));
  app.get('/v1/admin/payouts/calendar', async (req) => {
    await adminSession(req);
    return admin.payoutCalendar(z.object({ cycleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.query).cycleDate);
  });
  app.get('/v1/admin/partners/:id/payout-block', async (req) => admin.revealPayoutBlock((await adminSession(req)).admin, idParam.parse(req.params).id));
  app.post('/v1/admin/payouts/validate', async (req) => admin.validatePayout((await adminSession(req)).admin, validatePayoutSchema.parse(req.body)));
  app.post('/v1/admin/payouts/reverse', async (req) => {
    await admin.reversePayout((await adminSession(req)).admin, reversePayoutSchema.parse(req.body));
    return { ok: true };
  });

  return app;
}
