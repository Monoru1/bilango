/** Accepte seulement l'URL privée de notre base Render de recette. */
export function renderRecetteTarget(value: string | undefined): URL {
  let target: URL;
  try {
    target = new URL(value || 'invalid:');
  } catch {
    throw new Error('dedicated_recette_database_required');
  }
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || target.hostname !== 'dpg-dbopc7brjlhs73bjik8g-a' || target.pathname !== '/gobilan_recette') {
    throw new Error('dedicated_recette_database_required');
  }
  return target;
}
