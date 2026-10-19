import { createMockServices } from '@/services/mock';
import type { Services } from '@/services/types';

/**
 * Racine de composition : seul endroit qui choisit l'implémentation des services.
 * Brancher le vrai backend = retourner ici une implémentation HTTP/Supabase de `Services`.
 */
export function createAppServices(): Services {
  return createMockServices();
}
