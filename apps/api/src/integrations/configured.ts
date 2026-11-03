import type {GatewayTransaction,GatewayTransactionInput,GatewayTransactionState,MessageSender,Providers} from '../providers';
import {createDevProviders} from '../providers';
import type {Db} from '../db';
import type {Clock} from '../clock';
import {DbPushSender} from '../services/push';
import {AcceptanceWebPushTransport,SmtpAcceptanceSender,acceptanceSmtpTransport,TurnstileVerifier} from './acceptance';
type Env=Record<string,string|undefined>;
function required(env:Env,key:string){const value=env[key];if(!value)throw new Error(`Configuration manquante : ${key}`);return value;}
const list=(value:string|undefined)=>(value||'').split(',').map(x=>x.trim()).filter(Boolean);
function enabled(env:Env,key:string){if(env[key]!=='true')throw new Error('external_activation_disabled');}

export class MetaOtpSender {
 constructor(private env:Env,private fetcher:typeof fetch=fetch) {
  for(const key of ['WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_GRAPH_VERSION','WHATSAPP_OTP_TEMPLATE','WHATSAPP_TEMPLATE_LANGUAGE'])required(env,key);
  if(!/^v\d+\.\d+$/.test(env.WHATSAPP_GRAPH_VERSION!)||!/^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID!))throw new Error('whatsapp_configuration_invalid');
 }
 async send(phone:string,code:string){
  enabled(this.env,'EXTERNAL_DELIVERY_ENABLED');const to=phone.replace(/^\+/,'');
  if(!/^[1-9]\d{8,14}$/.test(to)||!/^\d{4,6}$/.test(code))throw new Error('invalid_otp_delivery');
  if(this.env.NODE_ENV!=='production'&&!list(this.env.TEST_WHATSAPP_RECIPIENTS).map(x=>x.replace(/^\+/,'')).includes(to))throw new Error('test_recipient_not_allowed');
  const r=await this.fetcher(`https://graph.facebook.com/${this.env.WHATSAPP_GRAPH_VERSION}/${this.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{Authorization:`Bearer ${this.env.WHATSAPP_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to,type:'template',template:{name:this.env.WHATSAPP_OTP_TEMPLATE,language:{code:this.env.WHATSAPP_TEMPLATE_LANGUAGE},components:[{type:'body',parameters:[{type:'text',text:code}]},{type:'button',sub_type:'url',index:'0',parameters:[{type:'text',text:code}]}]}})});
  if(!r.ok)throw new Error('whatsapp_delivery_failed');const body=await r.json() as {messages?:{id?:unknown}[]};if(typeof body.messages?.[0]?.id!=='string'||!body.messages[0].id.trim())throw new Error('whatsapp_acknowledgement_invalid');
 }
}

/** REST protocol: https://docs-v1.fedapay.com/payments/transactions
 * Real customer identity and provider acknowledgement are required; outbound is opt-in. */
export class FedaPayGateway {
 readonly customerRequired=true;
 private origin:string;private account:number;
 constructor(private env:Env,private fetcher:typeof fetch=fetch){
  const mode=required(env,'FEDAPAY_MODE');if(!['sandbox','live'].includes(mode)||!required(env,'FEDAPAY_SECRET_KEY').startsWith(`sk_${mode}_`))throw new Error('gateway_configuration_invalid');
  if(mode==='live'&&(env.NODE_ENV!=='production'||env.PRODUCTION_RELEASE_APPROVED!=='true'||env.FEDAPAY_LIVE_APPROVED!=='true'))throw new Error('live_not_approved');
  this.account=Number(required(env,'FEDAPAY_ACCOUNT_ID'));if(!Number.isSafeInteger(this.account)||this.account<1)throw new Error('merchant_required');
  const callback=new URL(required(env,'PWA_ORIGIN'));if(callback.protocol!=='https:'||callback.username||callback.password)throw new Error('https_origin_required');
  this.origin=mode==='live'?'https://api.fedapay.com':'https://sandbox-api.fedapay.com';
 }
 private async call(path:string,method='GET',body?:unknown){
  enabled(this.env,'EXTERNAL_PAYMENTS_ENABLED');const r=await this.fetcher(this.origin+'/v1'+path,{method,redirect:'error',signal:AbortSignal.timeout(8000),headers:{Authorization:`Bearer ${this.env.FEDAPAY_SECRET_KEY}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(!r.ok)throw new Error('gateway_unavailable');return await r.json() as Record<string,unknown>;
 }
 private async transaction(id:string){
  if(!/^[1-9]\d*$/.test(id))throw new Error('invalid_transaction_id');
  const payload=await this.call(`/transactions/${id}`);const tx=(payload['v1/transaction']??payload) as Record<string,unknown>;
  let currency=tx.currency as {iso?:unknown}|undefined;
  if(!currency?.iso&&Number.isSafeInteger(tx.currency_id)&&Number(tx.currency_id)>0){const c=await this.call(`/currencies/${tx.currency_id}`);currency=(c['v1/currency']??c) as {iso?:unknown};}
  if(String(tx.id)!==id||tx.account_id!==this.account||currency?.iso!=='XOF'||!Number.isSafeInteger(Number(tx.amount))||Number(tx.amount)<1||typeof tx.merchant_reference!=='string')throw new Error('gateway_transaction_mismatch');
  return tx;
 }
 async createTransaction(input:GatewayTransactionInput,onCreated?:(id:string)=>Promise<void>):Promise<GatewayTransaction>{
  enabled(this.env,'EXTERNAL_PAYMENTS_ENABLED');
  const customer=input.customer;
  if(!customer||!customer.name.trim()||!/^\+[1-9]\d{8,14}$/.test(customer.phone)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))throw new Error('gateway_customer_required');
  if(this.env.NODE_ENV!=='production'&&(!list(this.env.TEST_EMAIL_RECIPIENTS).includes(customer.email)||!list(this.env.TEST_WHATSAPP_RECIPIENTS).includes(customer.phone)))throw new Error('test_recipient_not_allowed');
  const names=customer.name.trim().split(/\s+/);const firstname=names.shift()!;
  const p=await this.call('/transactions','POST' ,{amount:input.amount,currency:{iso:'XOF'},customer:{firstname,lastname:names.join(' ')||firstname,email:customer.email,phone_number:{number:customer.phone,country:customer.country.toLowerCase()}},description:input.description,merchant_reference:input.merchantReference,custom_metadata:input.metadata,callback_url:this.env.PWA_ORIGIN});
  const tx=(p['v1/transaction']??p) as {id?:unknown};if(!Number.isSafeInteger(tx.id)||Number(tx.id)<1)throw new Error('gateway_invalid_id');const id=String(tx.id);
  await onCreated?.(id);return this.resumeTransaction(id,input);
 }
 async resumeTransaction(id:string,input:GatewayTransactionInput):Promise<GatewayTransaction>{
  const tx=await this.transaction(id);const metadata=tx.custom_metadata as Record<string,unknown>|undefined;
  if(Number(tx.amount)!==input.amount||tx.merchant_reference!==input.merchantReference||metadata?.business_id!==input.metadata.business_id||metadata?.type!==input.metadata.type)throw new Error('gateway_transaction_mismatch');
  const p=await this.call(`/transactions/${id}/token`,'POST');const resource=(p['v1/token']??p) as {url?:unknown;token?:unknown};
  if(typeof resource.url!=='string'||typeof resource.token!=='string'||!resource.token)throw new Error('gateway_token_invalid');const url=new URL(resource.url);
  if(url.protocol!=='https:'||url.hostname!==(this.env.FEDAPAY_MODE==='live'?'checkout.fedapay.com':'sandbox-checkout.fedapay.com')||url.port||url.username||url.password)throw new Error('gateway_checkout_host_invalid');
  return {transactionId:id,paymentUrl:url.href};
 }
 async getTransaction(id:string):Promise<GatewayTransactionState|null>{
  const tx=await this.transaction(id);const states=['approved','declined','canceled','refunded'];const status=states.includes(String(tx.status))?String(tx.status):tx.status==='transferred'?'approved':'pending';
  return {transactionId:id,merchantReference:tx.merchant_reference as string,amount:Number(tx.amount),status:status as GatewayTransactionState['status'],provider:typeof tx.mode==='string'?tx.mode:null};
 }
}

export function configuredProviders(env:Env,db:Db,clock:Clock):Providers {
 if(env.NODE_ENV==='production'&&(env.PROVIDER_MODE!=='configured'||env.PRODUCTION_RELEASE_APPROVED!=='true'))throw new Error('production_not_approved');
 if(env.PROVIDER_MODE!=='configured')return createDevProviders();
 const approved=env.NODE_ENV==='production'&&env.PRODUCTION_RELEASE_APPROVED==='true';
 if(env.NODE_ENV==='production'&&!approved)throw new Error('production_not_approved');
 const smtp=new SmtpAcceptanceSender(acceptanceSmtpTransport({host:required(env,'SMTP_HOST'),port:Number(env.SMTP_PORT||587),user:env.SMTP_USER,password:env.SMTP_PASSWORD,localCapture:env.SMTP_LOCAL_CAPTURE==='true',productionApproved:approved}),required(env,'SMTP_FROM'),list(env.TEST_EMAIL_RECIPIENTS),approved);
 const whatsapp=new MetaOtpSender(env);const messages:MessageSender={sendWhatsAppOtp:(phone,code)=>whatsapp.send(phone,code),sendEmail:async(to,message)=>{enabled(env,'EXTERNAL_DELIVERY_ENABLED');await smtp.sendEmail(to,message);}};
 const remotePush=new AcceptanceWebPushTransport({subject:required(env,'VAPID_SUBJECT'),publicKey:required(env,'VAPID_PUBLIC_KEY'),privateKey:required(env,'VAPID_PRIVATE_KEY')},list(env.TEST_PUSH_ENDPOINTS),fetch,approved);
 return {messages,captcha:new TurnstileVerifier({secret:required(env,'TURNSTILE_SECRET_KEY'),hostname:required(env,'TURNSTILE_HOSTNAME'),action:'otp',testing:!approved&&env.TURNSTILE_TESTING==='true'}),gateway:new FedaPayGateway(env),push:new DbPushSender(db,clock,{send:async(target,body)=>{enabled(env,'EXTERNAL_DELIVERY_ENABLED');return remotePush.send(target,body);}})};
}
