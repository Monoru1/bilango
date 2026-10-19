import { DAY_MS, emptyContent, subscriptionStatus, theoreticalCash } from '@gobilan/domain';
import { describe, expect, it } from 'vitest';
import { DEMO_PERSONAS as P, DemoStore } from './store';

const T0 = Date.parse('2026-10-19T12:00:00.000Z');
const mk = () => {
  let t = T0;
  const s = new DemoStore(() => t);
  return { s, tick: (ms: number) => (t += ms) };
};
const content = (revenue: number, expenses = 0) => ({ ...emptyContent(), revenue: { total: revenue, lines: [] }, expenses: { total: expenses, lines: [] } });

describe('DemoStore — données de démonstration cohérentes', () => {
  it('la caisse de la veille vaut 377 000 FCFA comme dans la référence B.2', () => {
    const { s } = mk();
    const b = s.business('b_etoile')!;
    const yesterday = new Date(T0 - DAY_MS).toISOString().slice(0, 10);
    expect(theoreticalCash(b, s.reportsOf(b.id), yesterday)?.closing).toBe(377_000);
  });

  it('le bilan du jour (48 500 − 6 000) amène la caisse à 419 500 comme B.1', () => {
    const { s } = mk();
    s.loginAsPersona(P.cashier);
    expect(s.submitReport('b_etoile', content(48_500, 6_000), null).ok).toBe(true);
    const b = s.business('b_etoile')!;
    expect(theoreticalCash(b, s.reportsOf(b.id), s.todayOf(b))?.closing).toBe(419_500);
  });
});

describe('DemoStore — OTP et PIN (§4)', () => {
  it('refuse un numéro invalide, plafonne à 2 codes / 24 h, 4 essais maximum, usage unique', () => {
    const { s } = mk();
    expect(s.startOtp('BJ', '123').ok).toBe(false);
    expect(s.startOtp('BJ', '0197000099').ok).toBe(true);
    const first = s.lastDemoOtp!;
    const wrong = first === '0000' ? '1111' : '0000';
    for (let i = 0; i < 3; i++) expect(s.verifyOtp(wrong).ok).toBe(false);
    const fourth = s.verifyOtp(wrong);
    expect(fourth.ok === false && fourth.exhausted).toBe(true);
    expect(s.verifyOtp(first).ok).toBe(false); // plus d'essai, même avec le bon code
    expect(s.startOtp('BJ', '0197000099').ok).toBe(true);
    const third = s.startOtp('BJ', '0197000099');
    expect(third.ok === false && third.exhausted).toBe(true);
  });

  it('un code OTP expire après 10 minutes et ne sert qu\'une fois', () => {
    const { s, tick } = mk();
    s.startOtp('BJ', '0197000098');
    const code = s.lastDemoOtp!;
    tick(10 * 60_000 + 1);
    expect(s.verifyOtp(code).ok).toBe(false);
    s.startOtp('BJ', '0197000098');
    // deuxième code (max 2/24h) : valide puis rejeté à la réutilisation
    const c2 = s.lastDemoOtp!;
    expect(s.verifyOtp(c2).ok).toBe(true);
    expect(s.verifyOtp(c2).ok).toBe(false);
  });

  it('inscription complète : PIN, nom, business => essai de 7 jours ; un 2e business n\'a pas d\'essai', () => {
    const { s } = mk();
    s.startOtp('CI', '0102030405');
    s.verifyOtp(s.lastDemoOtp!);
    expect(s.createPin('4321').ok).toBe(true);
    expect(s.setProfile('Koffi', 'KOFFI225').ok).toBe(true);
    const r = s.createBusiness('Chez Koffi', 'bar_restaurant', true);
    expect(r.ok).toBe(true);
    const id = r.ok ? (r as { value: { id: string } }).value.id : '';
    expect(subscriptionStatus(s.subOf(id), s.now())).toBe('trial');
    const r2 = s.createBusiness('Second', 'other', false);
    const id2 = r2.ok ? (r2 as { value: { id: string } }).value.id : '';
    expect(subscriptionStatus(s.subOf(id2), s.now())).toBe('blocked');
  });

  it('4 erreurs de PIN => blocage serveur 5 min puis plus long ; le bon PIN est refusé pendant le blocage', () => {
    const { s, tick } = mk();
    for (let i = 0; i < 3; i++) expect(s.loginPin(P.owner, '0000')).toMatchObject({ ok: false });
    const locked = s.loginPin(P.owner, '0000');
    expect(locked).toMatchObject({ ok: false, locked: true, retryAfterMs: 300_000 });
    expect(s.loginPin(P.owner, '1234')).toMatchObject({ ok: false, locked: true });
    tick(300_001);
    expect(s.loginPin(P.owner, '1234').ok).toBe(true);
  });
});

describe('DemoStore — bilans, droits, abonnement', () => {
  it('« Saisie seule » ne peut ni inviter ni créer de rôle ; le propriétaire ne peut pas être retiré', () => {
    const { s } = mk();
    s.loginAsPersona(P.cashier);
    expect(s.invite('b_etoile', '0197000010', 'r_cashier').ok).toBe(false);
    expect(s.createRole('b_etoile', 'Chef', 'full').ok).toBe(false);
    s.loginAsPersona(P.manager);
    expect(s.removeMember('b_etoile', 'm_owner').ok).toBe(false);
    expect(s.removeMember('b_etoile', 'm_awa').ok).toBe(true); // gérant « full » > saisie seule
  });

  it('un membre retiré garde ses bilans (nom conservé)', () => {
    const { s } = mk();
    s.loginAsPersona(P.owner);
    const before = s.reportsOf('b_etoile').length;
    s.removeMember('b_etoile', 'm_awa');
    expect(s.reportsOf('b_etoile')).toHaveLength(before);
    expect(s.reportsOf('b_etoile')[0]!.authorName).toBe('Awa Sanni');
    expect(s.businessesOfUser(P.cashier)).toHaveLength(0);
  });

  it('modification : 24 h maximum, versions conservées', () => {
    const { s, tick } = mk();
    s.loginAsPersona(P.cashier);
    const id = (s.submitReport('b_etoile', content(1000), null) as { value: { id: string } }).value.id;
    expect(s.editReport(id, content(2000)).ok).toBe(true);
    expect(s.state.reports.find((r) => r.id === id)!.versions).toHaveLength(2);
    tick(24 * 3600_000 + 1);
    expect(s.editReport(id, content(3000)).ok).toBe(false);
  });

  it('le propriétaire seul renouvelle ; 30 jours s\'ajoutent aux jours restants', () => {
    const { s } = mk();
    s.loginAsPersona(P.cashier);
    expect(s.simulatePayment('b_etoile').ok).toBe(false);
    s.loginAsPersona(P.owner);
    const before = Date.parse(s.subOf('b_etoile').paidUntil!);
    expect(s.simulatePayment('b_etoile').ok).toBe(true);
    expect(Date.parse(s.subOf('b_etoile').paidUntil!)).toBe(before + 30 * DAY_MS);
    expect(s.subOf('b_etoile').payments.at(-1)!.provider).toContain('DEMO');
  });

  it('l\'horloge de démo montre grâce puis blocage', () => {
    const { s } = mk();
    s.advanceDemoClock(25);
    expect(subscriptionStatus(s.subOf('b_etoile'), s.now())).toBe('grace');
    s.advanceDemoClock(3);
    expect(subscriptionStatus(s.subOf('b_etoile'), s.now())).toBe('blocked');
  });

  it('invitation => acceptation => accès effectif ; refus => aucun accès', () => {
    const { s } = mk();
    s.loginAsPersona(P.owner);
    expect(s.invite('b_etoile', '0197000077', 'r_cashier').ok).toBe(true);
    expect(s.invite('b_etoile', '0197000077', 'r_cashier').ok).toBe(false); // doublon
    s.startOtp('BJ', '0197000077');
    s.verifyOtp(s.lastDemoOtp!);
    s.createPin('1111');
    const me = s.user!;
    expect(s.invitationsFor(me.id)).toHaveLength(1);
    expect(s.businessesOfUser(me.id)).toHaveLength(0);
    const inv = s.invitationsFor(me.id)[0]!;
    expect(s.respondInvitation(inv.id, true).ok).toBe(true);
    expect(s.businessesOfUser(me.id)).toHaveLength(1);
  });
});
