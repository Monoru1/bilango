import { afterEach, describe, expect, it, vi } from 'vitest';
import { createECDH, randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import webpush from 'web-push';
import { AcceptanceWebPushTransport, SmtpAcceptanceSender, TurnstileVerifier, acceptanceSmtpTransport } from '../src/integrations/acceptance';

afterEach(()=>vi.unstubAllEnvs());
describe('acceptance protocol adapters, no customer delivery',()=>{
  it('requires captcha success, hostname and action; rejects malformed input, timeouts and redirects',async()=>{
    const fetcher=vi.fn().mockResolvedValue(Response.json({success:true,hostname:'localhost',action:'signup'}));
    const verifier=new TurnstileVerifier({secret:'fixture-secret',hostname:'localhost',action:'signup'},fetcher);
    expect(await verifier.verify('fixture',null)).toBe(true);
    expect(fetcher.mock.calls[0]?.[1].redirect).toBe('error');
    for(const response of [{success:true,hostname:'evil.example',action:'signup'},{success:true,hostname:'localhost',action:'other'},{success:false,hostname:'localhost',action:'signup'},{success:'true',hostname:'localhost',action:'signup'}]) {
      fetcher.mockResolvedValueOnce(Response.json(response));expect(await verifier.verify('fixture',null)).toBe(false);
    }
    fetcher.mockRejectedValueOnce(new Error('timeout'));expect(await verifier.verify('fixture',null)).toBe(false);
    const calls=fetcher.mock.calls.length;expect(await verifier.verify('',null)).toBe(false);expect(await verifier.verify('x'.repeat(2049),null)).toBe(false);expect(fetcher).toHaveBeenCalledTimes(calls);
    expect(()=>new TurnstileVerifier({secret:'1x0000000000000000000000000000000AA',hostname:'localhost',action:'signup'})).toThrow('configuration');
  });
  it('speaks actual SMTP to a loopback capture server and refuses all other recipients',async()=>{
    const messages:string[]=[];
    const server=createServer(socket=>{
      socket.setEncoding('utf8');socket.write('220 fixture ESMTP\r\n');let pending='';let data=false;
      socket.on('data',chunk=>{
        pending+=chunk;
        while(true) {
          if(data){const end=pending.indexOf('\r\n.\r\n');if(end<0)return;messages.push(pending.slice(0,end));pending=pending.slice(end+5);data=false;socket.write('250 fixture-accepted\r\n');continue;}
          const end=pending.indexOf('\r\n');if(end<0)return;const line=pending.slice(0,end);pending=pending.slice(end+2);
          if(line.startsWith('EHLO'))socket.write('250 fixture\r\n');
          else if(line==='DATA'){data=true;socket.write('354 send message\r\n');}
          else if(line==='QUIT'){socket.end('221 bye\r\n');return;}
          else socket.write('250 OK\r\n');
        }
      });
    });
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    const address=server.address();if(!address||typeof address==='string')throw new Error('capture unavailable');
    const transport=acceptanceSmtpTransport({host:'127.0.0.1',port:address.port,localCapture:true});
    try {
      const sender=new SmtpAcceptanceSender(transport,'sender@example.test',['owner@example.test']);
      await sender.sendEmail('owner@example.test',{subject:'Acceptance fixture',text:'Loopback capture only'});
      expect(messages).toHaveLength(1);expect(messages[0]).toContain('Loopback capture only');
      await expect(sender.sendEmail('client@example.test',{subject:'blocked',text:'blocked'})).rejects.toThrow('not_allowed');
      await expect(sender.sendEmail('owner@example.test,client@example.test',{subject:'blocked',text:'blocked'})).rejects.toThrow('single_email');
      await expect(sender.sendWhatsAppOtp()).rejects.toThrow('not_configured');
      expect(messages).toHaveLength(1);
    } finally {transport.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
    expect(()=>acceptanceSmtpTransport({host:'smtp.example.test',port:25,localCapture:true})).toThrow('configuration');
  });
  it('generates real encrypted Web Push/VAPID while refusing arbitrary endpoints and amounts',async()=>{
    const receiver=createECDH('prime256v1');receiver.generateKeys();
    const endpoint='https://fcm.googleapis.com/fixture-only';
    const target={endpoint,p256dh:receiver.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')};
    const fetcher=vi.fn().mockResolvedValue(new Response(null,{status:201}));
    const transport=new AcceptanceWebPushTransport({subject:'mailto:test@example.test',...webpush.generateVAPIDKeys()},[endpoint],fetcher);
    expect(await transport.send(target,JSON.stringify({type:'reminder',businessName:'Fixture',amount:9999}))).toEqual({status:201});
    const request=fetcher.mock.calls[0]?.[1];expect(request.redirect).toBe('error');expect(request.headers['Content-Encoding']).toBe('aes128gcm');expect(request.headers.Authorization).toContain('vapid ');
    expect(Buffer.from(request.body).toString()).not.toContain('Fixture');
    const ece=createRequire(import.meta.url)('http_ece') as {decrypt:(data:Buffer,options:{version:string;privateKey:typeof receiver;authSecret:string})=>Buffer};
    const plaintext=JSON.parse(ece.decrypt(Buffer.from(request.body),{version:'aes128gcm',privateKey:receiver,authSecret:target.auth}).toString());
    expect(plaintext).toEqual({type:'reminder',businessName:'Fixture'});
    await expect(transport.send({...target,endpoint:'https://127.0.0.1/private'},'{"type":"reminder"}')).rejects.toThrow('not_allowed');
    await expect(transport.send(target,'{"type":"unknown"}')).rejects.toThrow();expect(fetcher).toHaveBeenCalledTimes(1);
    vi.stubEnv('NODE_ENV','production');await expect(transport.send(target,'{"type":"reminder"}')).rejects.toThrow('forbidden');
  });
});
