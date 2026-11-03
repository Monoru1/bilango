/** Opt-in protocol adapters for isolated acceptance. Never selected by default. */
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type { Transporter } from 'nodemailer';
import webpush from 'web-push';
import { pushPayloadSchema } from '@gobilan/contracts';
import type { CaptchaVerifier, MessageSender, PushTarget, PushTransport } from '../providers';

const DUMMY_SECRETS = new Set(['1x0000000000000000000000000000000AA','2x0000000000000000000000000000000AA','3x0000000000000000000000000000000AA']);
export class TurnstileVerifier implements CaptchaVerifier {
  constructor(private readonly options: { secret: string; hostname: string; action: string; testing?: boolean }, private readonly fetcher: typeof fetch = fetch) {
    if (!options.secret || !options.hostname || !options.action || (DUMMY_SECRETS.has(options.secret) && !options.testing)) throw new Error('captcha_configuration_invalid');
  }
  async verify(token: string, ip: string | null): Promise<boolean> {
    if (!token || token.length > 2048) return false;
    try {
      const response = await this.fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method:'POST', redirect:'error', signal:AbortSignal.timeout(8000),
        headers:{'content-type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({secret:this.options.secret,response:token,...(ip?{remoteip:ip}:{})}),
      });
      if (!response.ok) return false;
      const result = await response.json() as {success?:unknown;hostname?:unknown;action?:unknown};
      return result.success === true && result.hostname === this.options.hostname && result.action === this.options.action;
    } catch { return false; }
  }
}

function acceptanceOnly() {
  if (process.env.NODE_ENV === 'production') throw new Error('acceptance_adapter_forbidden_in_production');
}
function email(value:string) {
  if (!/^[^\s<>,;@]+@[^\s<>,;@]+\.[^\s<>,;@]+$/.test(value) || value.length>254) throw new Error('single_email_required');
  return value.toLowerCase();
}

export function acceptanceSmtpTransport(config:{host:string;port:number;user?:string;password?:string;localCapture?:boolean}) {
  acceptanceOnly();
  const loopback=['127.0.0.1','localhost','::1'].includes(config.host);
  if (!config.host || !Number.isInteger(config.port) || config.port<1 || config.port>65535 || (config.localCapture && !loopback)) throw new Error('smtp_configuration_invalid');
  return nodemailer.createTransport({host:config.host,port:config.port,secure:config.port===465,
    requireTLS:!config.localCapture,ignoreTLS:!!config.localCapture,
    ...(config.user?{auth:{user:config.user,pass:config.password}}:{}),
    connectionTimeout:5000,greetingTimeout:5000,socketTimeout:5000,
    tls:{rejectUnauthorized:true},disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false,
  });
}

/** Only approved test addresses; no fallback to customer delivery or console OTPs. */
export class SmtpAcceptanceSender implements MessageSender {
  private readonly allowed:Set<string>;
  constructor(private readonly transport:Transporter<SMTPTransport.SentMessageInfo>,private readonly from:string,recipients:readonly string[]) {
    acceptanceOnly();email(from);this.allowed=new Set(recipients.map(email));
    if (!this.allowed.size) throw new Error('test_recipient_allowlist_required');
  }
  async sendWhatsAppOtp():Promise<void> { throw new Error('whatsapp_provider_not_configured'); }
  async sendEmail(to:string,message:{subject:string;text:string}):Promise<void> {
    acceptanceOnly();const recipient=email(to);
    if (!this.allowed.has(recipient)) throw new Error('test_recipient_not_allowed');
    try {
      const result=await this.transport.sendMail({from:this.from,to:recipient,subject:message.subject,text:message.text,disableFileAccess:true,disableUrlAccess:true});
      if (!result.messageId || result.rejected.length || !result.accepted.some(address=>typeof address==='string'&&address.toLowerCase()===recipient)) throw new Error('smtp_not_accepted');
    } catch { throw new Error('smtp_delivery_failed'); }
  }
}

const PUSH_HOSTS=new Set(['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com']);
/** Actual aes128gcm/VAPID generation; delivery limited to exact test subscriptions. */
export class AcceptanceWebPushTransport implements PushTransport {
  private readonly endpoints:Set<string>;
  constructor(private readonly vapid:{subject:string;publicKey:string;privateKey:string},endpoints:readonly string[],private readonly fetcher:typeof fetch=fetch) {
    acceptanceOnly();this.endpoints=new Set(endpoints);
    if (!this.endpoints.size) throw new Error('test_push_allowlist_required');
  }
  async send(target:PushTarget,body:string):Promise<{status:number}> {
    acceptanceOnly();const url=new URL(target.endpoint);
    if (!this.endpoints.has(target.endpoint) || url.protocol!=='https:' || url.port || url.username || url.password || !PUSH_HOSTS.has(url.hostname)) throw new Error('push_endpoint_not_allowed');
    const payload=JSON.stringify(pushPayloadSchema.parse(JSON.parse(body)));
    const details=webpush.generateRequestDetails({endpoint:target.endpoint,keys:{p256dh:target.p256dh,auth:target.auth}},payload,{vapidDetails:this.vapid,TTL:300,contentEncoding:'aes128gcm'});
    const response=await this.fetcher(target.endpoint,{method:'POST',headers:details.headers,body:new Uint8Array(details.body!),redirect:'error',signal:AbortSignal.timeout(8000)});
    return {status:response.status};
  }
}
