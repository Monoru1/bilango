// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '../app/useStore';
import { DEMO_PERSONAS as P } from '../demo/store';
import type { Env } from '../lib/env';
import { BusinessShell } from './BusinessShell';
import { HomeRouter } from './Home';
import { InstallPage } from './Install';

const env = (o: Partial<Env>): Env => ({ standalone: false, platform: 'other', iosSafari: false, inAppBrowser: null, ...o });
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => store.reset());
afterEach(cleanup);

describe('Page d\'installation (§3)', () => {
  it('navigateur intégré : message « Ouvre ce lien dans Chrome / Safari », pas de bouton d\'installation', () => {
    wrap(<InstallPage env={env({ inAppBrowser: 'instagram' })} />);
    expect(screen.getByText('Ouvre ce lien dans Chrome / Safari')).toBeTruthy();
    expect(screen.queryByText('Installer l’application')).toBeNull();
  });

  it('affiche logo, message court, bouton et le lien légal en bas', () => {
    wrap(<InstallPage env={env({ platform: 'android' })} />);
    expect(screen.getByRole('button', { name: 'Installer l’application' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'GoBilan' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Mentions légales/ })).toBeTruthy();
  });

  it('Android : le bouton relance l\'événement d\'installation capturé', async () => {
    wrap(<InstallPage env={env({ platform: 'android' })} />);
    const prompt = vi.fn().mockResolvedValue(undefined);
    const evt = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' as const }) });
    act(() => void window.dispatchEvent(evt));
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Installer l’application' })));
    expect(prompt).toHaveBeenCalledOnce();
    expect(evt.defaultPrevented).toBe(true);
  });

  it('iPhone + Safari : guide en 4 étapes, mention des notifications, et il se réaffiche après fermeture', () => {
    wrap(<InstallPage env={env({ platform: 'ios', iosSafari: true })} />);
    const open = () => fireEvent.click(screen.getByRole('button', { name: 'Installer l’application' }));
    open();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText(/nécessaire pour recevoir les notifications/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    open(); // aucune mémorisation : il revient
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('iPhone hors Safari : invite à ouvrir Safari, sans guide', () => {
    wrap(<InstallPage env={env({ platform: 'ios', iosSafari: false })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Installer l’application' }));
    expect(screen.getByText(/ouvre ce lien dans Safari/i)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

function renderBusiness(userId: string) {
  store.loginAsPersona(userId);
  return render(
    <MemoryRouter initialEntries={['/b/b_etoile']}>
      <Routes>
        <Route path="/b/:bid" element={<BusinessShell />}>
          <Route index element={<HomeRouter />} />
        </Route>
        <Route path="*" element={<div>hors-route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Abonnement vu par le propriétaire et l\'employé (§8.3, §8.3 bis)', () => {
  it('J-3 : pop-up « se termine dans 3 jours » avec OK et Renouveler', () => {
    store.advanceDemoClock(21 + 0.5);
    renderBusiness(P.owner);
    expect(screen.getByRole('dialog').textContent).toContain('Votre abonnement se termine dans 3 jours.');
    expect(screen.getByRole('button', { name: 'OK' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Renouveler' })).toBeTruthy();
  });

  it('grâce jour 1 : « Votre abonnement a expiré. »', () => {
    store.advanceDemoClock(24.5);
    renderBusiness(P.owner);
    expect(screen.getByRole('dialog').textContent).toContain('Votre abonnement a expiré.');
    expect(screen.getByRole('button', { name: 'OK' })).toBeTruthy();
  });

  it('à partir du 4e jour : plus de bouton OK, tableau de bord masqué, seul Renouveler reste', () => {
    store.advanceDemoClock(30);
    renderBusiness(P.owner);
    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull();
    expect(screen.queryByText('Chiffre d’affaires')).toBeNull();
    expect(screen.getByText('Votre abonnement a expiré')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Renouveler' })).toBeTruthy();
  });

  it('employé bloqué : message neutre, aucune mention d\'abonnement/impayé, aucun bouton de paiement', () => {
    store.advanceDemoClock(30);
    renderBusiness(P.cashier);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Saisie momentanément indisponible.');
    expect(alert.textContent).toContain('Boutique Étoile');
    expect(alert.textContent?.toLowerCase()).not.toMatch(/abonnement|impay|paiement|renouvel/);
    expect(screen.queryByRole('button', { name: /Renouveler|Payer/ })).toBeNull();
    expect(screen.queryByText('Faire le bilan du jour')).toBeNull();
  });

  it('le propriétaire voit la barre Accueil/Bilans/Équipe, le gérant/caissier Accueil/Historique seulement', () => {
    renderBusiness(P.owner);
    expect(screen.getAllByRole('link', { name: 'Équipe' })).toHaveLength(1);
    cleanup();
    renderBusiness(P.cashier);
    expect(screen.queryByRole('link', { name: 'Équipe' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Historique' })).toBeTruthy();
  });
});
