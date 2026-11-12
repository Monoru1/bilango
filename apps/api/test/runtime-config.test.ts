import { expect,it } from 'vitest';
import { developmentRuntime } from '../src/runtime-config';
it('keeps default API loopback-only and never permits production',()=>{
 expect(developmentRuntime({}).host).toBe('127.0.0.1');
 expect(()=>developmentRuntime({NODE_ENV:'production',ACCEPTANCE_ISOLATED:'true'})).toThrow('not_validated');
});
it('requires a dedicated acceptance database for container binding',()=>{
 for(const env of [{API_HOST:'0.0.0.0'},{API_HOST:'0.0.0.0',ACCEPTANCE_ISOLATED:'true',DATABASE_URL:'postgresql://user:fixture@db/production'}])expect(()=>developmentRuntime(env)).toThrow('isolated');
 expect(developmentRuntime({API_HOST:'0.0.0.0',ACCEPTANCE_ISOLATED:'true',DATABASE_URL:'postgresql://user:fixture@db/gobilan_acceptance'}).host).toBe('0.0.0.0');
});
it('validates exact HTTPS or loopback CSRF origins without widening them',()=>{
 expect(developmentRuntime({PWA_ORIGIN:'https://preview.example.test'}).origins.pwa).toEqual(['https://preview.example.test']);
 for(const PWA_ORIGIN of ['https://user:password@preview.example.test','https://preview.example.test/path','http://public.example.test','https://preview.example.test/'])expect(()=>developmentRuntime({PWA_ORIGIN})).toThrow('origin');
});
it('accepts a production host only after explicit release, configured providers, TLS database and exact HTTPS origins',()=>{
 const env={NODE_ENV:'production',PRODUCTION_RELEASE_APPROVED:'true',PROVIDER_MODE:'configured',DATABASE_URL:'postgresql://user:fixture@db.example.test/gobilan?sslmode=verify-full',API_HOST:'0.0.0.0',SECURE_COOKIES:'true',PWA_ORIGIN:'https://pwa.example.test',PARTNERS_ORIGIN:'https://partners.example.test',ADMIN_ORIGIN:'https://admin.example.test'};
 expect(developmentRuntime(env).secureCookies).toBe(true);
 for(const overrides of [{PROVIDER_MODE:'dev'},{SECURE_COOKIES:'false'},{DATABASE_URL:'postgresql://user:fixture@db.example.test/gobilan?sslmode=require'},{PWA_ORIGIN:'http://localhost:5173'}])expect(()=>developmentRuntime({...env,...overrides})).toThrow();
});
it('permits public binding in Render recette only for the dedicated private database with secure origins',()=>{
 const env={RENDER_RECETTE:'true',API_HOST:'0.0.0.0',DATABASE_URL:'postgresql://fixture:fixture@dpg-dbopc7brjlhs73bjik8g-a/gobilan_recette',SECURE_COOKIES:'true',PWA_ORIGIN:'https://pwa.example.test',PARTNERS_ORIGIN:'https://partners.example.test',ADMIN_ORIGIN:'https://admin.example.test'};
 expect(developmentRuntime(env).host).toBe('0.0.0.0');
 for(const overrides of [{DATABASE_URL:'postgresql://fixture:fixture@dpg-other-a/gobilan_recette'},{DATABASE_URL:'postgresql://fixture:fixture@dpg-dbopc7brjlhs73bjik8g-a/production'},{SECURE_COOKIES:'false'},{PWA_ORIGIN:'http://localhost:5173'},{PWA_ORIGIN:undefined},{NODE_ENV:'production'}])expect(()=>developmentRuntime({...env,...overrides})).toThrow();
});

it('validates the explicit WhatsApp OTP policy and defaults to the CDC', () => {
  expect(developmentRuntime({}).userOtpIssuePolicy).toBe('cdc');
  expect(developmentRuntime({ GOBILAN_WHATSAPP_OTP_POLICY: 'v1.2' }).userOtpIssuePolicy).toBe('v1.2');
  expect(() => developmentRuntime({ GOBILAN_WHATSAPP_OTP_POLICY: '5' })).toThrow('invalid_whatsapp_otp_policy');
});
