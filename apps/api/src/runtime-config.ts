import { renderRecetteTarget } from './render-recette-target';

/** Separate, explicit release gate; no implicit upgrade from acceptance to production. */
export function developmentRuntime(env:Record<string,string|undefined>) {
  const production=env.NODE_ENV==='production';
  if(production){
    if(env.PRODUCTION_RELEASE_APPROVED!=='true'||env.PROVIDER_MODE!=='configured')throw new Error('production_providers_not_validated');
    const database=new URL(env.DATABASE_URL||'invalid:');
    if(!['postgres:','postgresql:'].includes(database.protocol)||database.searchParams.get('sslmode')!=='verify-full')throw new Error('production_verified_postgres_required');
    if(env.SECURE_COOKIES!=='true'||!env.PWA_ORIGIN||!env.PARTNERS_ORIGIN||!env.ADMIN_ORIGIN)throw new Error('production_secure_origins_required');
  }
  const host=env.API_HOST || '127.0.0.1';
  if(!['127.0.0.1','::1','0.0.0.0'].includes(host))throw new Error('invalid_api_host');
  const port=Number(env.PORT || 8787);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('invalid_api_port');
  // Recette Render : écoute publique autorisée uniquement vers notre base privée dédiée, cookies sécurisés et origines HTTPS exactes.
  const recette=env.RENDER_RECETTE==='true';
  if(recette){
    if(production)throw new Error('recette_not_production');
    renderRecetteTarget(env.DATABASE_URL);
    if(env.SECURE_COOKIES!=='true'||!env.PWA_ORIGIN||!env.PARTNERS_ORIGIN||!env.ADMIN_ORIGIN)throw new Error('recette_secure_origins_required');
  } else if(host==='0.0.0.0'&&!production) {
    const database=new URL(env.DATABASE_URL || 'invalid:');
    if(env.ACCEPTANCE_ISOLATED!=='true'||!['postgres:','postgresql:'].includes(database.protocol)||database.pathname!=='/gobilan_acceptance')throw new Error('isolated_acceptance_database_required');
  }
  const origin=(value:string|undefined,fallback:string)=>{
    const url=new URL(value || fallback);
    if(url.origin!==(value || fallback)||url.username||url.password||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))))throw new Error('invalid_application_origin');
    if((production||recette)&&url.protocol!=='https:')throw new Error('production_https_required');
    return url.origin;
  };
  return {host,port,secureCookies:env.SECURE_COOKIES==='true',origins:{
    pwa:[origin(env.PWA_ORIGIN,'http://localhost:5173')],
    partners:[origin(env.PARTNERS_ORIGIN,'http://localhost:5174')],
    admin:[origin(env.ADMIN_ORIGIN,'http://localhost:5175')],
  }};
}
