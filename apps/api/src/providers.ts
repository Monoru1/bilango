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

export interface PushPayload {
  title: string;
  /** Jamais de montant : le texte s'affiche sur l'écran verrouillé (§9.2). */
  body: string;
  badge?: boolean;
  tag?: string;
}

export interface PushSender {
  sendToUser(userId: string, payload: PushPayload): Promise<void>;
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
  readonly sent: { userId: string; payload: PushPayload }[] = [];
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    this.sent.push({ userId, payload });
  }
}

export function createDevProviders(): Providers & { messages: DevMessageSender; gateway: DevGateway; push: DevPush } {
  return { messages: new DevMessageSender(), captcha: new DevCaptcha(), gateway: new DevGateway(), push: new DevPush() };
}
