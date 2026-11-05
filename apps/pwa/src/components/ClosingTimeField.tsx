import { CLOSING_TIME_PRESETS, isClockTime } from '@gobilan/domain';
import { useId, useState } from 'react';

const LABELS: Record<(typeof CLOSING_TIME_PRESETS)[number], string> = { '18:00': '18h00', '20:00': '20h00', '21:30': '21h30' };
const isPreset = (v: string): v is (typeof CLOSING_TIME_PRESETS)[number] => (CLOSING_TIME_PRESETS as readonly string[]).includes(v);

/**
 * Heure de fermeture du business (modifications v1.2 §2) : liste 18h00 / 20h00 / 21h30 ou heure libre.
 * Elle sert de repère aux rappels des employés, à l'heure locale du pays du business.
 */
export function ClosingTimeField({ value, onChange, label = 'Heure de fermeture' }: { value: string; onChange: (hhmm: string) => void; label?: string }) {
  const id = useId();
  const [custom, setCustom] = useState(() => !isPreset(value));
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="gb-input"
        value={custom ? 'other' : value}
        onChange={(e) => {
          if (e.target.value === 'other') return setCustom(true);
          setCustom(false);
          onChange(e.target.value);
        }}
      >
        {CLOSING_TIME_PRESETS.map((t) => <option key={t} value={t}>{LABELS[t]}</option>)}
        <option value="other">Autre heure…</option>
      </select>
      {custom && (
        <input
          className="gb-input"
          type="time"
          aria-label="Heure de fermeture libre"
          value={value}
          onChange={(e) => { if (isClockTime(e.target.value)) onChange(e.target.value); }}
          style={{ marginTop: 8 }}
        />
      )}
      <span className="muted" style={{ fontSize: 13 }}>Les rappels de bilan partent à cette heure, heure locale du pays.</span>
    </div>
  );
}
