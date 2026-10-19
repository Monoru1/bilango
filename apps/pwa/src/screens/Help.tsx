import { useNavigate } from 'react-router-dom';

const MANAGER = [
  ['Faire le bilan', 'Depuis l’accueil, touchez « Faire le bilan du jour ». Saisissez le chiffre d’affaires, les dépenses et, si besoin, l’argent ajouté à la caisse. Vous pouvez ne saisir que les totaux. Touchez « Envoyer le bilan ».'],
  ['Comprendre la caisse', 'La caisse affichée est une caisse théorique : caisse de la veille + chiffre d’affaires + ajouts à la caisse − dépenses. Au tout premier bilan, vous déclarez une seule fois le montant de départ.'],
  ['Corriger un bilan', 'Le bouton « Modifier » reste visible 24 heures après l’envoi. Le propriétaire voit la version originale et la version modifiée.'],
] as const;
const OWNER = [
  ['Gérer les rôles', 'Dans l’onglet Équipe, créez un rôle (nom libre) avec un niveau : Saisie seule, Gestion complète ou Lecture seule, puis invitez la personne avec son numéro WhatsApp. Elle doit accepter l’invitation.'],
  ['Gérer l’abonnement', '2 000 FCFA pour 30 jours, par business, après 7 jours d’essai. Il n’y a pas de prélèvement automatique : vous renouvelez quand vous le souhaitez. Les 30 jours s’ajoutent aux jours restants.'],
] as const;

export function HelpScreen() {
  const nav = useNavigate();
  const block = (title: string, items: readonly (readonly [string, string])[]) => (
    <section className="stack" style={{ gap: 6 }}>
      <h2 className="h2">{title}</h2>
      {items.map(([q, a]) => <details key={q} style={{ borderBottom: '1px solid var(--sep)', padding: '10px 0' }}><summary style={{ fontWeight: 600, cursor: 'pointer' }}>{q}</summary><p className="muted" style={{ marginBottom: 0 }}>{a}</p></details>)}
    </section>
  );
  return (
    <div className="screen">
      <main className="pad stack" style={{ paddingTop: 16, paddingBottom: 32, gap: 22 }}>
        <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => nav(-1)}>← Retour</button>
        <h1 className="h1">Aide</h1>
        {block('Manager / employé', MANAGER)}
        {block('Propriétaire', OWNER)}
        <p className="faint" style={{ fontSize: 13 }}>Support : contact@gobilan.com</p>
      </main>
    </div>
  );
}
