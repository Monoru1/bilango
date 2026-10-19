import { LegalPage } from '@gobilan/ui';
import { useNavigate } from 'react-router-dom';

/** Page légale unique, publique (CDC §12) : accessible depuis l'installation et le menu. */
export function LegalScreen() {
  const nav = useNavigate();
  return (
    <div className="screen">
      <div className="pad" style={{ paddingTop: 16 }}><button className="link" onClick={() => nav(-1)}>← Retour</button></div>
      <LegalPage />
    </div>
  );
}
