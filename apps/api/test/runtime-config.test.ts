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
