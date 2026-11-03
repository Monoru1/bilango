/** Container acceptance stays opt-in and cannot unlock production. */
export function developmentRuntime(env:Record<string,string|undefined>) {
  if(env.NODE_ENV==='production')throw new Error('production_providers_not_validated');
  const host=env.API_HOST || '127.0.0.1';
  if(!['127.0.0.1','::1','0.0.0.0'].includes(host))throw new Error('invalid_api_host');
  const port=Number(env.PORT || 8787);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('invalid_api_port');
  if(host==='0.0.0.0') {
    const database=new URL(env.DATABASE_URL || 'invalid:');
    if(env.ACCEPTANCE_ISOLATED!=='true'||!['postgres:','postgresql:'].includes(database.protocol)||database.pathname!=='/gobilan_acceptance')throw new Error('isolated_acceptance_database_required');
  }
  const origin=(value:string|undefined,fallback:string)=>{
    const url=new URL(value || fallback);
    if(url.origin!==(value || fallback)||url.username||url.password||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))))throw new Error('invalid_application_origin');
    return url.origin;
  };
  return {host,port,secureCookies:env.SECURE_COOKIES==='true',origins:{
    pwa:[origin(env.PWA_ORIGIN,'http://localhost:5173')],
    partners:[origin(env.PARTNERS_ORIGIN,'http://localhost:5174')],
    admin:[origin(env.ADMIN_ORIGIN,'http://localhost:5175')],
  }};
}
