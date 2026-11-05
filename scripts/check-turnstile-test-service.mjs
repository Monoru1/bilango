/** Public documented test credentials only. No account, real token or customer data. */
import assert from 'node:assert/strict';
import { TurnstileVerifier } from '../apps/api/src/integrations/acceptance.ts';
for(const [secret,expected] of [['1x0000000000000000000000000000000AA',true],['2x0000000000000000000000000000000AA',false],['3x0000000000000000000000000000000AA',false]]) {
 const verifier=new TurnstileVerifier({secret,hostname:'localhost',action:'test',testing:true});
 assert.equal(await verifier.verify('XXXX.DUMMY.TOKEN.XXXX',null),expected);
 process.stdout.write(String(`PASS public Turnstile test case: ${expected?'accept':'reject'}`)+'\n');
}
