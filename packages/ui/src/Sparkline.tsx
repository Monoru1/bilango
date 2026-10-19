/** Mini-courbe du chiffre d'affaires : accent #0F6E56, point final plein (annexe B.1). */
export function Sparkline({ values, width = 132, height = 56 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 6;
  const pts = values.map((v, i) => [pad + (i * (width - 2 * pad)) / (values.length - 1), height - pad - ((v - min) / span) * (height - 2 * pad)] as const);
  const last = pts[pts.length - 1] ?? [0, 0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#0F6E56" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="4" fill="#0F6E56" />
    </svg>
  );
}
