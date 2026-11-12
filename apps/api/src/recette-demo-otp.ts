import { renderRecetteTarget } from './render-recette-target';

/**
 * OTP de DÉMONSTRATION — mécanisme TEMPORAIRE de la recette Render, qui ne remplace pas l'OTP
 * WhatsApp Meta de la V1 (voir docs/recette/otp-demo-recette.md).
 *
 * En recette aucun fournisseur WhatsApp n'est branché. Plutôt que d'écrire les codes dans les
 * journaux, une liste FERMÉE de numéros fictifs reçoit un code de test défini côté serveur et
 * limité dans le temps ; tout autre numéro est refusé explicitement. Le code suit ensuite le
 * circuit normal (table otp_codes) : quotas, expiration, essais comptés et usage unique restent
 * appliqués. Aucun endpoint ne restitue ce code.
 */
export interface DemoOtpPolicy {
  /** Code à émettre pour ce numéro E.164, ou `null` si le numéro n'est pas (ou plus) autorisé. */
  codeFor(phone: string, now: number): string | null;
}

const KEYS = ['RECETTE_DEMO_PHONES', 'RECETTE_DEMO_OTP', 'RECETTE_DEMO_OTP_EXPIRES_AT'] as const;
/** Indicatifs Bénin, Togo, Côte d'Ivoire. */
const PHONE = /^\+(229|228|225)\d{8,10}$/;
const MAX_PHONES = 20;
const MAX_VALIDITY_MS = 31 * 24 * 60 * 60 * 1000;
const TRIVIAL = new Set(['0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '4321']);

const closed: DemoOtpPolicy = { codeFor: () => null };

/**
 * `null` hors recette. En recette, renvoie toujours une politique : sans configuration complète
 * elle refuse tous les numéros (aucun code n'est alors émis ni journalisé).
 * Toute variable RECETTE_DEMO_* hors du mode recette, ou en production, bloque le démarrage.
 */
export function recetteDemoOtp(env: Record<string, string | undefined>, now: number): DemoOtpPolicy | null {
  const configured = KEYS.some((k) => env[k] !== undefined && env[k] !== '');
  const recette = env.RENDER_RECETTE === 'true';
  if (env.NODE_ENV === 'production' || !recette) {
    if (configured) throw new Error('recette_demo_otp_forbidden');
    return null;
  }
  renderRecetteTarget(env.DATABASE_URL);
  if (env.PROVIDER_MODE === 'configured') {
    // Un vrai fournisseur est branché : le code de test n'a plus lieu d'être.
    if (configured) throw new Error('recette_demo_otp_conflicts_with_configured_providers');
    return null;
  }
  if (!configured) return closed;

  const phones = (env.RECETTE_DEMO_PHONES ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  if (!phones.length || phones.length > MAX_PHONES || phones.some((p) => !PHONE.test(p)) || new Set(phones).size !== phones.length) {
    throw new Error('recette_demo_phones_invalid');
  }
  const code = env.RECETTE_DEMO_OTP ?? '';
  if (!/^\d{4}$/.test(code) || new Set(code).size === 1 || TRIVIAL.has(code)) throw new Error('recette_demo_otp_invalid');
  const raw = env.RECETTE_DEMO_OTP_EXPIRES_AT ?? '';
  const expiresAt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(raw) ? Date.parse(raw) : NaN;
  if (!Number.isFinite(expiresAt) || expiresAt - now > MAX_VALIDITY_MS) throw new Error('recette_demo_otp_expiry_invalid');

  const allowed = new Set(phones);
  return { codeFor: (phone, at) => (at < expiresAt && allowed.has(phone) ? code : null) };
}

/**
 * Messagerie de la recette : rien n'est envoyé, rien n'est conservé en mémoire, et ni le code, ni
 * le numéro, ni le destinataire, ni le corps d'un e-mail (qui peut porter un lien d'activation ou
 * de réinitialisation) ne sont écrits dans les journaux.
 */
export function recetteMessageSender(log: (line: string) => void) {
  return {
    async sendWhatsAppOtp(_phone: string, _code: string): Promise<void> {
      log('[RECETTE WHATSAPP] simulé (non envoyé)');
    },
    async sendEmail(_to: string, _message: { subject: string; text: string }): Promise<void> {
      log('[RECETTE EMAIL] simulé (non envoyé)');
    },
  };
}
