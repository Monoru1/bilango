import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';

/** Secrets applicatifs, fournis par l'environnement serveur — jamais par le dépôt (cahier §13.1). */
export interface Secrets {
  /** Poivre HMAC appliqué aux PIN et OTP avant hachage : une fuite de base seule ne suffit pas à les retrouver. */
  pepper: Buffer;
  /** Clé AES-256 de chiffrement des coordonnées de versement. */
  payoutKey: Buffer;
  fedapayWebhookSecret: string;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Code numérique uniforme, sans biais de modulo (`randomInt`). */
export function randomDigits(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += String(randomInt(0, 10));
  return out;
}

function scrypt(secret: string | Buffer, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(secret, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

function peppered(secret: string, pepper: Buffer): Buffer {
  return createHmac('sha256', pepper).update(secret).digest();
}

/**
 * Hachage de secret (PIN, mot de passe) : HMAC(poivre) puis scrypt avec sel aléatoire.
 * ATTENTION : un PIN à 4 chiffres n'a que 10 000 valeurs ; aucun hachage ne le protège d'une
 * fuite SI le poivre fuit aussi. La vraie protection est le blocage serveur + le poivre hors base.
 */
export async function hashSecret(secret: string, pepper: Buffer): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(peppered(secret, pepper), salt);
  return `s1$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifySecret(secret: string, stored: string, pepper: Buffer): Promise<boolean> {
  const [version, saltB64, keyB64] = stored.split('$');
  if (version !== 's1' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64url');
  const actual = await scrypt(peppered(secret, pepper), Buffer.from(saltB64, 'base64url'));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Empreinte déterministe d'un code court (OTP) : comparaison en temps constant. */
export function otpDigest(code: string, subject: string, pepper: Buffer): string {
  return createHmac('sha256', pepper).update(`${subject}|${code}`).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function encryptField(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `g1$${iv.toString('base64url')}$${cipher.getAuthTag().toString('base64url')}$${enc.toString('base64url')}`;
}

export function decryptField(stored: string, key: Buffer): string {
  const [version, iv, tag, data] = stored.split('$');
  if (version !== 'g1' || !iv || !tag || !data) throw new Error('Format de champ chiffré invalide.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

/** Signature HMAC-SHA256 hexadécimale d'un corps de webhook. */
export function signWebhook(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = signWebhook(rawBody, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}
