// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store as currentStore } from '../app/useStore';
import type { DemoStore } from '../demo/store';
vi.mock('../app/useStore', async () => { const { DemoStore } = await import('../demo/store'); const { useSyncExternalStore } = await import('react'); const store = new DemoStore(); return { store, useStore: () => { useSyncExternalStore(store.subscribe, store.getVersion); return store; } }; });
const store = currentStore as DemoStore;
import { DEMO_PERSONAS as P } from '../demo/store';
import type { Env } from '../lib/env';
import { BusinessShell } from './BusinessShell';
import { HomeRouter } from './Home';
import { InstallPage } from './Install';

const env = (o: Partial<Env>): Env => ({ standalone: false, platform: 'other', iosSafari: false, inAppBrowser: null, ...o });
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => { store.reset(); localStorage.clear(); });
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

  it('iPhone + Safari : guide en trois étapes, fermeture persistante et réouverture volontaire', () => {
    wrap(<InstallPage env={env({ platform: 'ios', iosSafari: true })} />);
    const open = () => fireEvent.click(screen.getByRole('button', { name: 'Installer l’application' }));
    open();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText(/nécessaire pour recevoir les notifications/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    cleanup();
    wrap(<InstallPage env={env({ platform: 'ios', iosSafari: true })} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Comment installer ?' }));
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

describe('Heure de fermeture par business (v1.2 §2, REC-01)', () => {
  it('à la création : liste 18h00/20h00/21h30 ou heure libre, enregistrée sur le business', async () => {
    const { NewBusiness } = await import('./NewBusiness');
    store.loginAsPersona(P.owner);
    render(<MemoryRouter initialEntries={['/nouveau']}><Routes><Route path="/nouveau" element={<NewBusiness />} /><Route path="/b/:bid" element={<div>business créé</div>} /></Routes></MemoryRouter>);
    const select = screen.getByLabelText('Heure de fermeture') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(['18h00', '20h00', '21h30', 'Autre heure…']);
    fireEvent.change(screen.getByLabelText('Nom du business'), { target: { value: 'Maquis du soir' } });
    fireEvent.change(select, { target: { value: 'other' } });
    fireEvent.change(screen.getByLabelText('Heure de fermeture libre'), { target: { value: '22:15' } });
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Créer' })));
    expect(screen.getByText('business créé')).toBeTruthy();
    expect(store.state.businesses.find((b) => b.name === 'Maquis du soir')?.reminderTime).toBe('22:15');
  });

  it('dans le profil : modifiable pour le business courant, puis 18h00 → 21h30', async () => {
    const { ProfileScreen } = await import('./Settings');
    store.loginAsPersona(P.owner);
    await act(async () => void store.setReminder('b_etoile', '18:00'));
    render(<MemoryRouter initialEntries={['/b/b_etoile/profil']}><Routes><Route path="/b/:bid/profil" element={<ProfileScreen />} /></Routes></MemoryRouter>);
    const select = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    expect(select.value).toBe('18:00');
    fireEvent.change(select, { target: { value: '21:30' } });
    await act(async () => void fireEvent.click(screen.getAllByRole('button', { name: 'Enregistrer l’heure' })[0]!));
    expect(store.state.businesses.find((b) => b.id === 'b_etoile')?.reminderTime).toBe('21:30');
    expect(screen.getByText('Heure de fermeture réglée à 21:30.')).toBeTruthy();
  });
});
