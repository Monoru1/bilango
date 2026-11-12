/** Loaded only when the API explicitly advertises a configured Turnstile site. */
type Widget={render:(node:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void};
declare global {interface Window {turnstile?:Widget}}
let loading:Promise<void>|undefined;
export async function browserCaptcha(siteKey:string,action:string):Promise<string>{
 if(!siteKey||action!=='otp')throw new Error('captcha_configuration_invalid');
 if(!window.turnstile){
  loading??=new Promise<void>((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
   const timer=setTimeout(()=>{script.remove();loading=undefined;reject(new Error('captcha_unavailable'));},10000);
   script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);script.remove();loading=undefined;reject(new Error('captcha_unavailable'));};document.head.append(script);
  });await loading;
 }
 const widget=window.turnstile;if(!widget)throw new Error('captcha_unavailable');
 return new Promise<string>((resolve,reject)=>{
  const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Vérification de sécurité');
  const title=document.createElement('p');title.textContent='Vérification de sécurité';const node=document.createElement('div');
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Annuler';dialog.append(title,node,cancel);document.body.append(dialog);
  let id:string|undefined;let settled=false;
  const finish=(token?:string)=>{if(settled)return;settled=true;clearTimeout(timer);if(id)widget.remove(id);dialog.remove();if(token)resolve(token);else reject(new Error('captcha_not_completed'));};
  const timer=setTimeout(()=>finish(),120000);cancel.onclick=()=>finish();dialog.oncancel=event=>{event.preventDefault();finish();};
  try{dialog.showModal();id=widget.render(node,{sitekey:siteKey,action,callback:(token:string)=>finish(token),'error-callback':()=>finish(),'expired-callback':()=>finish()});}catch{finish();}
 });
}
