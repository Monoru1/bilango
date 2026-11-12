import webpush from 'web-push';
import {describe,it,expect,vi} from 'vitest';
import {MetaOtpSender,FedaPayGateway} from '../src/integrations/configured';
const env={NODE_ENV:'test',WHATSAPP_ACCESS_TOKEN:'fixture',WHATSAPP_PHONE_NUMBER_ID:'123',WHATSAPP_GRAPH_VERSION:'v23.0',WHATSAPP_OTP_TEMPLATE:'otp',WHATSAPP_TEMPLATE_LANGUAGE:'fr',TEST_WHATSAPP_RECIPIENTS:'+2290197000000',TEST_EMAIL_RECIPIENTS:'owner@example.test',FEDAPAY_MODE:'sandbox',FEDAPAY_SECRET_KEY:'sk_sandbox_fixture',FEDAPAY_ACCOUNT_ID:'42',PWA_ORIGIN:'https://pwa.example.test'};
const input={merchantReference:'fixture',customer:{name:'Fixture Owner',phone:'+2290197000000',email:'owner@example.test',country:'BJ' as const},amount:2000,country:'BJ' as const,description:'Fixture',metadata:{business_id:'fixture-business',type:'renouvellement_abonnement' as const}};
describe('configured external adapters',()=>{
 it('keeps every financial/delivery request disabled until separate activation',async()=>{
  const fetcher=vi.fn();await expect(new MetaOtpSender(env,fetcher).send('+2290197000000','1234')).rejects.toThrow('disabled');
  await expect(new FedaPayGateway(env,fetcher).createTransaction(input)).rejects.toThrow('disabled');expect(fetcher).not.toHaveBeenCalled();
  expect(()=>new FedaPayGateway({...env,FEDAPAY_MODE:'live',FEDAPAY_SECRET_KEY:'sk_live_fixture'},fetcher)).toThrow('not_approved');
 });
 it('builds a Meta authentication template only for the exact approved test phone',async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({messages:[{id:'fixture-message'}]}));
  const sender=new MetaOtpSender({...env,EXTERNAL_DELIVERY_ENABLED:'true'},fetcher);
  await expect(sender.send('+2290197000001','1234')).rejects.toThrow('not_allowed');expect(fetcher).not.toHaveBeenCalled();
  await sender.send('+2290197000000','1234');const request=fetcher.mock.calls[0]![1];
  expect(request.redirect).toBe('error');expect(JSON.parse(request.body).template.components[1].parameters[0].text).toBe('1234');
 });
 it('persists the transaction acknowledgement before token failure and resumes without recreating it',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json({'v1/transaction':{id:12}})).mockResolvedValueOnce(Response.json({id:12,account_id:42,amount:2000,currency:{iso:'XOF'},merchant_reference:'fixture',custom_metadata:input.metadata})).mockResolvedValueOnce(new Response(null,{status:503}));
  const gateway=new FedaPayGateway({...env,EXTERNAL_PAYMENTS_ENABLED:'true'},fetcher);const persist=vi.fn();
  await expect(gateway.createTransaction(input,persist)).rejects.toThrow('unavailable');expect(persist).toHaveBeenCalledWith('12');expect(JSON.parse(fetcher.mock.calls[0]![1].body).customer.email).toBe('owner@example.test');
  fetcher.mockResolvedValueOnce(Response.json({id:12,account_id:42,amount:2000,currency:{iso:'XOF'},merchant_reference:'fixture',custom_metadata:input.metadata})).mockResolvedValueOnce(Response.json({token:'fixture',url:'https://sandbox-checkout.fedapay.com/fixture'}));
  expect(await gateway.resumeTransaction('12',input)).toMatchObject({transactionId:'12'});
  expect(fetcher.mock.calls.filter(([url])=>url.endsWith('/transactions'))).toHaveLength(1);
 });
 it('rejects a different merchant, price, reference or checkout host',async()=>{
  for(const mismatch of [{account_id:43},{amount:1},{merchant_reference:'other'}]){
   const fetcher=vi.fn().mockResolvedValue(Response.json({id:12,account_id:42,amount:2000,currency:{iso:'XOF'},merchant_reference:'fixture',custom_metadata:input.metadata,...mismatch}));
   await expect(new FedaPayGateway({...env,EXTERNAL_PAYMENTS_ENABLED:'true'},fetcher).resumeTransaction('12',input)).rejects.toThrow('mismatch');
  }
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json({id:12,account_id:42,amount:2000,currency:{iso:'XOF'},merchant_reference:'fixture',custom_metadata:input.metadata})).mockResolvedValueOnce(Response.json({token:'x',url:'https://evil.example/pay'}));
  await expect(new FedaPayGateway({...env,EXTERNAL_PAYMENTS_ENABLED:'true'},fetcher).resumeTransaction('12',input)).rejects.toThrow('host');
 });
});
it('selects actual configured providers without opening deliveries or falling back to dev',async()=>{
 const {configuredProviders}=await import('../src/integrations/configured');const {makeDeps}=await import('./helpers');const ctx=await makeDeps();
 const keys=webpush.generateVAPIDKeys();
 const configured={...env,PROVIDER_MODE:'configured',SMTP_HOST:'127.0.0.1',SMTP_LOCAL_CAPTURE:'true',SMTP_FROM:'sender@example.test',TEST_EMAIL_RECIPIENTS:'test@example.test',VAPID_SUBJECT:'mailto:test@example.test',VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey,TEST_PUSH_ENDPOINTS:'https://fcm.googleapis.com/fixture',TURNSTILE_SECRET_KEY:'fixture',TURNSTILE_HOSTNAME:'localhost'};
 const providers=configuredProviders(configured,ctx.db,ctx.clock);
 expect(()=>configuredProviders({...configured,VAPID_PRIVATE_KEY:webpush.generateVAPIDKeys().privateKey},ctx.db,ctx.clock)).toThrow('vapid_key_pair_invalid');
 expect(providers.gateway).toBeInstanceOf(FedaPayGateway);
 await expect(providers.messages.sendEmail('test@example.test',{subject:'fixture',text:'fixture'})).rejects.toThrow('disabled');
 await expect(providers.messages.sendWhatsAppOtp('+2290197000000','1234')).rejects.toThrow('disabled');
 expect(()=>configuredProviders({...env,PROVIDER_MODE:'configured'},ctx.db,ctx.clock)).toThrow('SMTP_HOST');
});
it('refuses missing or non-allowlisted FedaPay customer data before any HTTP call',async()=>{
 const fetcher=vi.fn();const gateway=new FedaPayGateway({...env,EXTERNAL_PAYMENTS_ENABLED:'true'},fetcher);
 await expect(gateway.createTransaction({...input,customer:undefined})).rejects.toThrow('customer_required');
 await expect(gateway.createTransaction({...input,customer:{...input.customer,email:'client@example.test'}})).rejects.toThrow('not_allowed');expect(fetcher).not.toHaveBeenCalled();
});
