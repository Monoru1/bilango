export const audienceSources = ['direct', 'whatsapp', 'facebook', 'tiktok', 'agent', 'influencer', 'other'] as const;
export const audiencePlatforms = ['android', 'ios', 'other'] as const;

export function audienceSource(campaign: string | null, referrer: string, inApp: string | null) {
  const social = ['whatsapp', 'facebook', 'tiktok'] as const;
  for (const source of social) if (campaign === source || inApp === source) return source;
  if (!referrer) return campaign ? 'other' : 'direct';
  const host = new URL(referrer).hostname;
  const matches = (domain: string) => host === domain || host.endsWith('.' + domain);
  if (matches('whatsapp.com') || matches('wa.me')) return 'whatsapp';
  if (matches('facebook.com') || matches('fb.com')) return 'facebook';
  if (matches('tiktok.com')) return 'tiktok';
  return 'other';
}

export interface AudienceCounts {
  visitors: number;
  visits: number;
  installClicks: number;
  androidInstalls: number;
  firstOpens: number;
  registrations: number;
}

export interface AudienceReport {
  collectionStartedOn: string;
  total: AudienceCounts;
  days: { day: string; counts: AudienceCounts }[];
  sources: { source: typeof audienceSources[number]; counts: AudienceCounts }[];
  platforms: { platform: typeof audiencePlatforms[number]; counts: AudienceCounts }[];
}

export const audienceLabels = {
  visitors: 'Visiteurs de l’accueil',
  visits: 'Visites',
  installClicks: 'Clics sur Installer',
  androidInstalls: 'Installations confirmées Android',
  firstOpens: 'Premières ouvertures installées',
  registrations: 'Inscriptions terminées après OTP',
} satisfies Record<keyof AudienceCounts, string>;
