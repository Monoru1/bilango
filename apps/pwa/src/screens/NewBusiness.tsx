import type { Sector } from '@gobilan/domain';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../app/useStore';

export function NewBusiness() {
  const s = useStore();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [sector, setSector] = useState<Sector>('boutique');
  const [stock, setStock] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="screen">
      <main className="pad stack" style={{ paddingTop: 16, gap: 18 }}>
        <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => nav(-1)}>← Retour</button>
        <h1 className="h1">Ajouter un business</h1>
        <input className="gb-input" placeholder="Nom du business" aria-label="Nom du business" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="gb-input" aria-label="Secteur" value={sector} onChange={(e) => setSector(e.target.value as Sector)}>
          <option value="boutique">Boutique</option><option value="bar_restaurant">Bar / restaurant</option><option value="ecommerce">E-commerce</option><option value="other">Autre</option>
        </select>
        <label className="row" style={{ justifyContent: 'flex-start', gap: 12 }}><input type="checkbox" checked={stock} onChange={(e) => setStock(e.target.checked)} /> Activer le module Stock</label>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>L’essai de 7 jours est accordé une seule fois par numéro ; un business supplémentaire démarre sans essai.</p>
        {err && <p className="gb-error" role="alert">{err}</p>}
        <button className="gb-btn" disabled={!name.trim()} onClick={() => { const r = s.createBusiness(name, sector, stock); if (!r.ok) return setErr(r.error); nav(`/b/${r.value.id}`); }}>Créer</button>
      </main>
    </div>
  );
}
