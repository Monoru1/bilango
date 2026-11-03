import { SUBSCRIPTION_PRICE_FCFA, daysRemaining, formatFcfa, subscriptionEnd, subscriptionStatus } from '@gobilan/domain';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useStore } from '../app/useStore';
import { Dialog } from '../components/Popup';
import { dayLong } from '../lib/format';
import type { BizCtx } from './BusinessShell';

/** Mon abonnement (§7.4) + renouvellement. Le paiement FedaPay est SIMULÉ en mode DEMO. */
export function SubscriptionScreen() {
  const s = useStore();
  const { business: b, isOwner } = useOutletContext<BizCtx>();
  const [confirm, setConfirm] = useState(false);
  const [paymentEmail,setPaymentEmail]=useState('');
  const [paymentsEnabled,setPaymentsEnabled]=useState(false);
  const [paymentError,setPaymentError]=useState<string|null>(null);
  useEffect(()=>{let active=true;if(s.mode==='api')void s.paymentAvailability().then(enabled=>{if(active)setPaymentsEnabled(enabled);});return()=>{active=false;};},[s]);
  const pay=async()=>{if(s.mode!=='api')return;setPaymentError(null);const result=await s.subscriptionCheckout(b.id,paymentEmail);if(result.ok)window.location.assign(result.value.paymentUrl);else setPaymentError(result.error);};
  const sub = s.subOf(b.id);
  const now = s.now();
  const status = subscriptionStatus(sub, now);
  const end = subscriptionEnd(sub);
  const endDay = end ? end.slice(0, 10) : null;
  const text = status === 'active' ? `Actif jusqu’au ${endDay ? dayLong(endDay) : ''}` : status === 'trial' ? `Essai gratuit jusqu’au ${endDay ? dayLong(endDay) : ''}` : status === 'grace' ? `Expiré depuis le ${endDay ? dayLong(endDay) : ''} (période de grâce)` : `Expiré depuis le ${endDay ? dayLong(endDay) : ''}`;
  if (!isOwner) return <main className="pad"><p className="muted" style={{ paddingTop: 22 }}>Réservé au propriétaire.</p></main>;
  return (
    <main className="pad stack" style={{ flex: 1, paddingTop: 22, gap: 18 }}>
      <h1 className="h1">Mon abonnement</h1>
      <div><div className="gb-label">Statut</div><p className="h2" style={{ marginTop: 8 }}>{text}</p><p className="muted" style={{ margin: 0 }}>{Math.max(0, daysRemaining(sub, now))} jour{daysRemaining(sub, now) > 1 ? 's' : ''} restant{daysRemaining(sub, now) > 1 ? 's' : ''}</p></div>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>{formatFcfa(SUBSCRIPTION_PRICE_FCFA)} pour 30 jours. Pas de prélèvement automatique ; les 30 jours s’ajoutent aux jours restants.</p>
      {s.mode === 'demo' ? <button className="gb-btn" onClick={() => setConfirm(true)}>Renouveler</button> : paymentsEnabled?<form onSubmit={event=>{event.preventDefault();void pay();}} className="stack"><label className="gb-label">E-mail pour le paiement<input type="email" autoComplete="email" required maxLength={254} value={paymentEmail} onChange={event=>setPaymentEmail(event.target.value)}/></label><button type="submit" className="gb-btn" disabled={s.mode==='api'&&s.busy}>Renouveler avec FedaPay</button></form>: <p role="status">Paiement indisponible dans cet environnement de développement. Aucun paiement réel n’est actif.</p>}
      {paymentError?<p role="alert">{paymentError}</p>:null}
      <section>
        <h2 className="h2">Historique des paiements</h2>
        {sub.payments.length === 0 ? <p className="muted">Aucun paiement.</p> : (
          <ul className="list">{[...sub.payments].reverse().map((p) => <li key={p.id}><span className="k">{dayLong(p.paidAt.slice(0, 10))}<br /><span className="faint" style={{ fontSize: 12 }}>{p.provider} · {p.reference}</span></span><span className="v">{formatFcfa(p.amount)}</span></li>)}</ul>
        )}
      </section>
      {confirm && (
        <Dialog label="Renouveler" onClose={() => setConfirm(false)}>
          <p className="h2">Renouveler pour 30 jours</p>
          <p className="demo-note" style={{ margin: 0 }}><strong>DEMO</strong> : le paiement FedaPay est simulé, aucun argent ne circule. En production, le serveur crée la transaction et seul le webhook signé prolonge l’abonnement.</p>
          <div className="btns"><button className="gb-btn gb-btn--ghost" onClick={() => setConfirm(false)}>Annuler</button><button className="gb-btn" onClick={() => { if (s.mode === 'demo') s.simulatePayment(b.id); setConfirm(false); }}>Payer (simulé)</button></div>
        </Dialog>
      )}
    </main>
  );
}
