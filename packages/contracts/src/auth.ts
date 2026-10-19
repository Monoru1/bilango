import { z } from 'zod';
import { countrySchema, e164Schema, emailSchema, idSchema, otp4Schema, otp6Schema, pinSchema } from './common';

// --- Utilisateurs (patrons, employés) : WhatsApp + OTP à 4 chiffres + PIN (§4) ----------

export const deviceInfoSchema = z.object({
  /** Identifiant d'installation généré par la PWA (anti-abus d'essai « par appareil si possible », §8.1). */
  deviceId: z.string().min(8).max(128),
  label: z.string().max(80).optional(),
});

export const otpPurposeSchema = z.enum(['signup', 'pin_reset', 'new_device']);

export const requestOtpSchema = z.object({
  country: countrySchema,
  /** Numéro national saisi (indicatif pré-rempli côté UI, normalisé côté serveur). */
  phone: z.string().min(6).max(24),
  purpose: otpPurposeSchema,
  device: deviceInfoSchema,
  /** Jeton CAPTCHA obligatoire avant tout envoi (§4.4). */
  captchaToken: z.string().min(1).max(2048),
});

export const verifyOtpSchema = z.object({
  country: countrySchema,
  phone: z.string().min(6).max(24),
  purpose: otpPurposeSchema,
  code: otp4Schema,
  device: deviceInfoSchema,
});

export const createPinSchema = z.object({
  /** Jeton à usage unique rendu par `verifyOtp`, lié au numéro et à l'appareil. */
  otpProof: z.string().min(16).max(256),
  pin: pinSchema,
  device: deviceInfoSchema,
});

export const loginPinSchema = z.object({
  phone: e164Schema,
  pin: pinSchema,
  device: deviceInfoSchema,
});

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  referralCode: z.string().trim().max(32).optional(),
});

export const sessionUserSchema = z.object({
  id: idSchema,
  phone: e164Schema,
  name: z.string(),
  country: countrySchema,
});

// --- Partenaires : e-mail + mot de passe, aucun 2FA (§10.1) -------------------------------

export const partnerLoginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(256) });
export const partnerActivateSchema = z.object({
  token: z.string().min(16).max(256),
  password: z.string().min(8).max(256),
  /** Une case cochée par accord (§10.3) : « J'ai lu et j'accepte l'accord [rôle], version [X] ». */
  acceptedAgreementVersion: z.string().min(1).max(16),
});
export const partnerForgotSchema = z.object({ email: emailSchema });
export const partnerResetSchema = z.object({ email: emailSchema, code: otp6Schema, password: z.string().min(8).max(256) });

// --- Administration : e-mail + mot de passe + code e-mail à chaque connexion (§10.1) ------

export const adminLoginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(256) });
export const adminVerifySchema = z.object({ challengeId: idSchema, code: otp6Schema });
