import type { PushMessage } from '@gobilan/contracts';
import type { CountryCode } from '@gobilan/domain';

/**
 * Frontières avec les services externes. Aucune implémentation « réelle » n'est livrée ici :
 * WhatsApp Business, e-mail, CAPTCHA, FedaPay et Web Push exigent des comptes et clés au nom de
 * Novadis Digital (cahier §13.5, actions restantes §15). Les classes `Dev*` ci-dessous
 * ENREGISTRENT les messages en mémoire ; elles ne les envoient à personne.
 */
export interface MessageSender {
  sendWhatsAppOtp(phone: string, code: string): Promise<void>;
  sendEmail(to: string, message: { subject: string; text: string }): Promise<void>;
}

export interface CaptchaVerifier {
  verify(token: string, ip: string | null): Promise<boolean>;
}

export interface GatewayTransactionInput {
  merchantReference: string;
  amount: number;
  country: CountryCode;
  description: string;
  /** Rattachement au business et type d'opération, relus dans le webhook (§8.2). */
  metadata: { business_id: string; type: 'renouvellement_abonnement' };
}

export interface GatewayTransaction {
  transactionId: string;
  paymentUrl: string;
}

export interface GatewayTransactionState {
  transactionId: string;
  merchantReference: string;
  status: 'pending' | 'approved' | 'declined' | 'canceled' | 'refunded';
  amount: number;
  provider: string | null;
}

export interface PaymentGateway {
  createTransaction(input: GatewayTransactionInput): Promise<GatewayTransaction>;
  /** Vérification de secours périodique (§8.2) : interroge la passerelle, ne croit aucune redirection. */
  getTransaction(transactionId: string): Promise<GatewayTransactionState | null>;
}

/**
 * Charge utile typée : le service worker fabrique le texte à partir du `type`. Elle ne peut pas
 * porter de montant (le schéma n'a aucun champ prévu pour cela), car elle peut s'afficher sur
 * l'écran verrouillé (§9.2).
 */
export type PushPayload = PushMessage;

export interface PushSender {
  /** Ne lève jamais : un échec de notification ne doit pas faire échouer l'opération métier. */
  sendToUser(userId: string, payload: PushPayload, opts?: PushSendOptions): Promise<void>;
}

export interface PushSendOptions {
  /** Appareil à ne PAS notifier : l'alerte « nouvel appareil » part à l'ANCIEN appareil, jamais au nouveau (§9.2). */
  excludeDeviceId?: string;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Transport Web Push (chiffrement RFC 8291 + VAPID RFC 8292). L'implémentation RÉELLE exige des
 * clés VAPID au nom de Novadis Digital : elle n'est pas livrée (voir docs/REMAINING_BLOCKERS.md).
 * `status` est le code HTTP renvoyé par le service push du navigateur (201 = accepté, 404/410 =
 * abonnement expiré).
 */
export interface PushTransport {
  send(target: PushTarget, body: string): Promise<{ status: number }>;
}

export interface Providers {
  messages: MessageSender;
  captcha: CaptchaVerifier;
  gateway: PaymentGateway;
  push: PushSender;
}

// ---------------------------------------------------------------------------------------------
// Doublures de DÉVELOPPEMENT : visibles dans les journaux et les tests, jamais en production.
// ---------------------------------------------------------------------------------------------

export class DevMessageSender implements MessageSender {
  readonly whatsapp: { phone: string; code: string }[] = [];
  readonly emails: { to: string; subject: string; text: string }[] = [];
  failNext = false;
  async sendWhatsAppOtp(phone: string, code: string): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('DevMessageSender: échec simulé');
    }
    this.whatsapp.push({ phone, code });
  }
  async sendEmail(to: string, message: { subject: string; text: string }): Promise<void> {
    this.emails.push({ to, ...message });
  }
  lastCodeFor(phone: string): string | undefined {
    return [...this.whatsapp].reverse().find((m) => m.phone === phone)?.code;
  }
}

export class DevCaptcha implements CaptchaVerifier {
  async verify(token: string): Promise<boolean> {
    return token !== 'invalid';
  }
}

export class DevGateway implements PaymentGateway {
  readonly created: (GatewayTransactionInput & GatewayTransaction)[] = [];
  readonly states = new Map<string, GatewayTransactionState>();
  async createTransaction(input: GatewayTransactionInput): Promise<GatewayTransaction> {
    const transactionId = `dev-tx-${this.created.length + 1}`;
    const tx = { transactionId, paymentUrl: `https://sandbox.invalid/pay/${transactionId}` };
    this.created.push({ ...input, ...tx });
    this.states.set(transactionId, {
      transactionId,
      merchantReference: input.merchantReference,
      status: 'pending',
      amount: input.amount,
      provider: null,
    });
    return tx;
  }
  async getTransaction(transactionId: string): Promise<GatewayTransactionState | null> {
    return this.states.get(transactionId) ?? null;
  }
}

export class DevPush implements PushSender {
  readonly sent: { userId: string; payload: PushPayload; excludeDeviceId?: string }[] = [];
  async sendToUser(userId: string, payload: PushPayload, opts: PushSendOptions = {}): Promise<void> {
    this.sent.push({ userId, payload, ...(opts.excludeDeviceId ? { excludeDeviceId: opts.excludeDeviceId } : {}) });
  }
}

/** Transport de DÉVELOPPEMENT : enregistre les envois, ne contacte AUCUN service push. */
export class DevPushTransport implements PushTransport {
  readonly sent: { target: PushTarget; body: string }[] = [];
  /** Statuts à renvoyer au prochain envoi (file), pour simuler 404/410/500. Par défaut 201. */
  readonly nextStatuses: number[] = [];
  async send(target: PushTarget, body: string): Promise<{ status: number }> {
    this.sent.push({ target, body });
    return { status: this.nextStatuses.shift() ?? 201 };
  }
}

export function createDevProviders(): Providers & { messages: DevMessageSender; gateway: DevGateway; push: DevPush } {
  return { messages: new DevMessageSender(), captcha: new DevCaptcha(), gateway: new DevGateway(), push: new DevPush() };
}
