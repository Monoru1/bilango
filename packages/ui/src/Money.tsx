import { formatFcfa } from '@gobilan/domain';

/** Sépare le nombre formaté (espaces fines insécables) de l'unité pour styler « FCFA » en plus léger. */
export function amountParts(value: number): { number: string; unit: string } {
  const full = formatFcfa(value);
  const idx = full.lastIndexOf(' ');
  const i2 = idx === -1 ? full.lastIndexOf(' ') : idx;
  return i2 === -1 ? { number: full, unit: 'FCFA' } : { number: full.slice(0, i2), unit: full.slice(i2 + 1) };
}

export function Money({ value, size = 'lg' }: { value: number; size?: 'lg' | 'md' }) {
  const p = amountParts(value);
  return (
    <span className={size === 'lg' ? 'gb-amount' : 'gb-amount gb-amount--md'}>
      {p.number}
      <span className="gb-unit">{p.unit}</span>
    </span>
  );
}
