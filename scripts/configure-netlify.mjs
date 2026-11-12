import {isIP} from 'node:net';
import {copyFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export function apiRedirect(origin){
 if(!origin)return '/v1/* /api-unavailable.json 404!\n';
 const url=new URL(origin);
 if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password||url.port||!url.hostname.includes('.')||isIP(url.hostname)||url.hostname.startsWith('[')||/\.(local|localhost|internal)$/.test(url.hostname))throw new Error('API_ORIGIN must be an HTTPS origin without credentials, path or port');
 return `/v1/* ${url.origin}/v1/:splat 200!\n`;
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
 const app = process.argv[2] ?? 'pwa';
 if (!['pwa', 'partners', 'admin'].includes(app)) throw new Error('Unknown GoBilan Netlify app');
 const destination = fileURLToPath(new URL(`../apps/${app}/dist/`, import.meta.url));
 const redirects = apiRedirect(process.env.API_ORIGIN);
 copyFileSync(new URL('../apps/pwa/public/api-unavailable.json', import.meta.url), destination + 'api-unavailable.json');
 writeFileSync(destination + '_redirects', redirects + '/* /index.html 200\n');
}
