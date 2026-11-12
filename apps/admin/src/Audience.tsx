import { audienceLabels, DAY_MS, toDayKey, type AudienceCounts, type AudienceReport } from '@gobilan/domain';
import { useEffect, useState } from 'react';

const columns = Object.entries(audienceLabels) as [keyof AudienceCounts, string][];
const sourceLabels = { direct: 'Direct', whatsapp: 'WhatsApp', facebook: 'Facebook', tiktok: 'TikTok', agent: 'Agent', influencer: 'Influenceur', other: 'Autre' };
const platformLabels = { android: 'Android', ios: 'iPhone / iPad', other: 'Autre' };

function CountsTable({ name, rows, trafficOnly = false }: {
  name: string;
  rows: { label: string; counts: AudienceCounts }[];
  trafficOnly?: boolean;
}) {
  const fields = trafficOnly ? columns.slice(0, 2) : columns;
  return <div className="scroll"><table>
    <caption>{name}</caption>
    <thead><tr><th scope="col">Groupe</th>{fields.map(([key, label]) => <th scope="col" key={key}>{label}</th>)}</tr></thead>
    <tbody>{rows.map(({ label, counts }) => <tr key={label}><th scope="row">{label}</th>
      {fields.map(([key]) => <td key={key}>{counts[key]}</td>)}
    </tr>)}</tbody>
  </table></div>;
}

export function AudienceView() {
  const today = toDayKey(Date.now(), 0);
  const [from, setFrom] = useState(() => toDayKey(Date.now() - 6 * DAY_MS, 0));
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<AudienceReport | null | undefined>(undefined);
  const [error, setError] = useState(false);
  const valid = Boolean(from && to && from <= to && Date.parse(to) - Date.parse(from) < 90 * DAY_MS);

  useEffect(() => {
    setError(false);
    setReport(undefined);
    if (!valid) return;
    const abort = new AbortController();
    const query = new URLSearchParams({ from, to });
    void fetch('/v1/admin/audience?' + query, { signal: abort.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const result = await response.json() as { report: AudienceReport | null };
      setReport(result.report);
    }).catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, [from, to, valid]);

  async function exportCsv() {
    setError(false);
    try {
      const response = await fetch('/v1/admin/audience/export', {
        method: 'POST', body: JSON.stringify({ from, to }),
        headers: { 'content-type': 'application/json', 'x-gobilan-csrf': '1' },
      });
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'audience-gobilan.csv';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError(true); }
  }

  return <section className="card stack">
    <h2 className="h2">Audience et installation</h2>
    <div className="row">{[1, 7, 30].map(days =>
      <button key={days} className="gb-btn gb-btn--ghost btn-sm" onClick={() => { setFrom(toDayKey(Date.now() - (days - 1) * DAY_MS, 0)); setTo(today); }}>
        {days === 1 ? 'Aujourd’hui' : days + ' jours'}
      </button>,
    )}</div>
    <div className="row">
      <label>Début UTC<input className="gb-input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label>Fin UTC incluse<input className="gb-input" type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      <button className="gb-btn btn-sm" disabled={!report || !valid || to < report.collectionStartedOn} onClick={() => void exportCsv()}>Exporter l’audience en CSV</button>
    </div>
    {!valid && <p role="alert">Choisissez une période de 1 à 90 jours.</p>}
    {error && <p role="alert">Les données d’audience n’ont pas pu être chargées ou exportées.</p>}
    {valid && !error && report === undefined && <p role="status">Chargement…</p>}
    {report === null && <p>Collecte désactivée. Aucune statistique d’audience disponible.</p>}
    {report && (to < report.collectionStartedOn ? <p>Aucune donnée collectée sur cette période.</p> : <>
      <p>Couverture disponible depuis le {report.collectionStartedOn} (UTC). L’entonnoir compte les événements observés avec accord. La confirmation d’installation est mesurée sur Android.</p>
      <CountsTable name="Entonnoir d’installation" rows={[{ label: 'Total de la période', counts: report.total }]} />
      <CountsTable name="Détail par jour" rows={report.days.map(({ day, counts }) => ({ label: day, counts }))} />
      <CountsTable name="Origine des visites" trafficOnly rows={report.sources.map(({ source, counts }) => ({ label: sourceLabels[source], counts }))} />
      <CountsTable name="Détail par système" rows={report.platforms.map(({ platform, counts }) => ({ label: platformLabels[platform], counts }))} />
    </>)}
  </section>;
}
