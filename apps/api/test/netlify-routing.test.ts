import {it,expect} from 'vitest';
// @ts-expect-error JavaScript build helper has no declarations.
import {apiRedirect} from '../../../scripts/configure-netlify.mjs';
it('generates an explicit API proxy only for a configured HTTPS origin',()=>{
 expect(apiRedirect(undefined)).toContain('404!');expect(apiRedirect('https://api.example.test')).toBe('/v1/* https://api.example.test/v1/:splat 200!\n');
 for(const value of ['http://api.example.test','https://user:pass@api.example.test','https://api.example.test/path','https://api.example.test:8443','https://127.0.0.1','https://172.16.0.1','https://host.internal'])expect(()=>apiRedirect(value)).toThrow();
});
