// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { OwnerReferralScreen } from './OwnerReferral';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('affiche la condition d’accès avant paiement', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ eligible: false, code: null, registrations: 0, paid: 0, days: 0 }) }));
  render(<OwnerReferralScreen />);
  expect(await screen.findByText(/disponible après votre premier abonnement payé/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Générer/ })).toBeNull();
});

it('génère le code via le serveur et affiche les jours enregistrés sans promettre leur activation', async () => {
  const initial = { eligible: true, code: null, registrations: 1, paid: 1, days: 30 };
  const updated = { ...initial, code: { code: 'ABCDEFGH', active: true } };
  const fetcher = vi.fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => initial })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => updated.code })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => updated });
  vi.stubGlobal('fetch', fetcher);
  render(<OwnerReferralScreen />);
  fireEvent.click(await screen.findByRole('button', { name: 'Générer mon code de parrainage' }));
  expect(await screen.findByText('ABCDEFGH')).toBeTruthy();
  expect(screen.getByText(/conditions d’utilisation des jours sont en cours de confirmation/)).toBeTruthy();
  expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', credentials: 'include' });
});
