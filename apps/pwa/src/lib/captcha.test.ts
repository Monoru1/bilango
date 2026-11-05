import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {browserCaptcha} from './captcha';
beforeEach(()=>{Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:vi.fn()});});
afterEach(()=>{delete window.turnstile;document.querySelectorAll('dialog,script[src*="turnstile"]').forEach(node=>node.remove());vi.restoreAllMocks();});
it('renders the advertised public site key and returns only a successful widget token',async()=>{
 const remove=vi.fn();const render=vi.fn((_node,options)=>{queueMicrotask(()=>options.callback('signed-fixture'));return 'widget-1';});window.turnstile={render,remove};
 expect(await browserCaptcha('public-site','otp')).toBe('signed-fixture');expect(render.mock.calls[0]?.[1]).toMatchObject({sitekey:'public-site',action:'otp'});expect(remove).toHaveBeenCalledWith('widget-1');expect(document.querySelector('dialog')).toBeNull();
});
it('cancels without creating an OTP and releases the widget',async()=>{
 const remove=vi.fn();window.turnstile={render:()=> 'widget-2',remove};const token=browserCaptcha('public-site','otp');
 document.querySelector('dialog button')?.dispatchEvent(new MouseEvent('click',{bubbles:true}));await expect(token).rejects.toThrow('not_completed');expect(remove).toHaveBeenCalledWith('widget-2');
});
it('fails closed when the external CAPTCHA script is unavailable',async()=>{
 const token=browserCaptcha('public-site','otp');document.querySelector('script[src*="turnstile"]')?.dispatchEvent(new Event('error'));await expect(token).rejects.toThrow('unavailable');expect(document.querySelector('dialog')).toBeNull();
});
