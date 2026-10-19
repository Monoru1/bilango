import { createMockServices } from '@/services/mock';
import { DEMO_OTP_CODE } from '@/services/mock/seed';
import { createSessionController, PIN_MAX_ATTEMPTS } from '../session-controller';
import { createMemoryStorage } from '../storage';

function setup(initial: Record<string, string> = {}) {
  const services = createMockServices({ latencyMs: 0 });
  const storage = createMemoryStorage(initial);
  const make = () => createSessionController({ auth: services.auth, storage });
  return { services, storage, make, session: make() };
}

describe('session persistante et PIN local', () => {
  it('démarre déconnecté sans jeton', async () => {
    const { session } = setup();
    await session.boot();
    expect(session.getState().status).toBe('signedOut');
  });

  it("demande de créer un PIN à la première connexion d'un compte déjà nommé", async () => {
    const { session } = setup();
    await session.boot();
    await session.verifyOtp('+2290197000001', DEMO_OTP_CODE);
    expect(session.getState()).toMatchObject({ status: 'onboarding', step: 'pin' });
    await session.setPin('1234');
    expect(session.getState().status).toBe('ready');
  });

  it('demande le nom des nouveaux comptes avant le PIN', async () => {
    const { session } = setup();
    await session.verifyOtp('+2290197000099', DEMO_OTP_CODE);
    expect(session.getState()).toMatchObject({ status: 'onboarding', step: 'name' });
    await session.saveName('Mireille Agbo');
    expect(session.getState()).toMatchObject({ status: 'onboarding', step: 'pin' });
    await expect(session.setPin('12')).rejects.toMatchObject({ code: 'VALIDATION' });
    await session.setPin('4321');
    expect(session.getState()).toMatchObject({ status: 'ready', user: { name: 'Mireille Agbo' } });
  });

  it("rouvre directement l'app au lancement suivant, sans OTP ni PIN", async () => {
    const { session, make } = setup();
    await session.verifyOtp('+2290197000001', DEMO_OTP_CODE);
    await session.setPin('1234');
    const relaunched = make();
    await relaunched.boot();
    expect(relaunched.getState().status).toBe('ready');
  });

  it('une déconnexion volontaire verrouille ; le PIN suffit pour revenir', async () => {
    const { session, make } = setup();
    await session.verifyOtp('+2290197000001', DEMO_OTP_CODE);
    await session.setPin('1234');
    await session.lock();
    expect(session.getState().status).toBe('locked');

    const relaunched = make();
    await relaunched.boot();
    expect(relaunched.getState().status).toBe('locked');
    expect(await relaunched.unlock('0000')).toEqual({ ok: false, attemptsLeft: PIN_MAX_ATTEMPTS - 1 });
    expect(await relaunched.unlock('1234')).toEqual({ ok: true });
    expect(relaunched.getState().status).toBe('ready');
  });

  it("oublie l'appareil après trop de PIN erronés et exige un nouvel OTP", async () => {
    const { session } = setup();
    await session.verifyOtp('+2290197000001', DEMO_OTP_CODE);
    await session.setPin('1234');
    await session.lock();
    for (let i = 0; i < PIN_MAX_ATTEMPTS; i++) await session.unlock('9999');
    expect(session.getState().status).toBe('signedOut');
    expect(await session.unlock('1234')).toEqual({ ok: false, attemptsLeft: 0 });
    expect(session.getState().status).toBe('signedOut');
  });

  it('un code OTP incorrect ne crée aucune session', async () => {
    const { session } = setup();
    await expect(session.verifyOtp('+2290197000001', '111111')).rejects.toMatchObject({ code: 'INVALID_OTP' });
    expect(session.getState().status).not.toBe('ready');
  });

  it('PIN oublié : forgetDevice ramène à la connexion par OTP', async () => {
    const { session, make } = setup();
    await session.verifyOtp('+2290197000001', DEMO_OTP_CODE);
    await session.setPin('1234');
    await session.lock();
    await session.forgetDevice();
    const relaunched = make();
    await relaunched.boot();
    expect(relaunched.getState().status).toBe('signedOut');
  });
});
