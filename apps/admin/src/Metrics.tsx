import { useEffect, useState } from 'react';
import { addDays, adminMetricsRows, toDayKey, type AdminMetrics } from '@gobilan/domain';

function metricsRequest(path: string) {
  return fetch(path, {
    credentials: 'same-origin',
    headers: { 'x-gobilan-csrf': '1', 'x-gobilan-admin-origin': window.location.origin },
  });
}

export function MetricsView() {
  const [to, setTo] = useState(() => toDayKey(Date.now(), 0));
  const [from, setFrom] = useState(() => addDays(to, -29));
  const [query, setQuery] = useState(() => new URLSearchParams({ from, to }).toString());
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let current = true;
    void metricsRequest('/v1/admin/metrics?' + query).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json() as AdminMetrics;
      if (current) setMetrics(data);
    }).catch(() => {
      if (current) setError('Impossible de charger les indicateurs.');
    });
    return () => { current = false; };
  }, [query]);

  async function download() {
    setExportError('');
    setExporting(true);
    try {
      const response = await metricsRequest('/v1/admin/metrics.csv?' + query);
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'statistiques-gobilan.csv';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError('Impossible de télécharger le CSV.');
    } finally {
      setExporting(false);
    }
  }

  return <section className="card stack">
    <h2 className="h2">Indicateurs administrateur</h2>
    <form className="row" onSubmit={event => {
      event.preventDefault();
      const next = new URLSearchParams({ from, to }).toString();
      if (next === query) return;
      setMetrics(null);
      setError('');
      setExportError('');
      setQuery(next);
    }}>
      <label>Du (UTC)<input type="date" className="gb-input" required value={from} max={to} onChange={event => setFrom(event.target.value)} /></label>
      <label>Au (UTC)<input type="date" className="gb-input" required value={to} min={from} onChange={event => setTo(event.target.value)} /></label>
      <button className="gb-btn gb-btn--ghost">Afficher</button>
      <button type="button" className="gb-btn gb-btn--ghost" disabled={!metrics || exporting} onClick={() => void download()}>Exporter en CSV</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {exportError && <p role="alert">{exportError}</p>}
    {!error && !metrics && <p role="status">Chargement…</p>}
    {metrics && <div className="scroll"><table>
      <thead><tr><th>Famille</th><th>Indicateur</th><th>Valeur</th></tr></thead>
      <tbody>{adminMetricsRows(metrics).map(([family, metric, value]) =>
        <tr key={family + ':' + metric}><td>{family}</td><td>{metric}</td><td>{value}</td></tr>)}</tbody>
    </table></div>}
  </section>;
}
