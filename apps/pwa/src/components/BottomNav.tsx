import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { BarsIcon, ClockIcon, HomeIcon, TeamIcon } from './Icons';

export function BottomNav({ base, variant }: { base: string; variant: 'owner' | 'manager' }) {
  const item = (to: string, label: string, icon: ReactNode, end = false) => (
    <NavLink to={to} end={end} aria-label={label}>
      {icon}
      {label}
    </NavLink>
  );
  return (
    <nav className="bottomnav" aria-label="Navigation principale">
      {item(base, 'Accueil', <HomeIcon />, true)}
      {variant === 'owner' ? item(`${base}/bilans`, 'Bilans', <BarsIcon />) : item(`${base}/bilans`, 'Historique', <ClockIcon />)}
      {variant === 'owner' && item(`${base}/equipe`, 'Équipe', <TeamIcon />)}
    </nav>
  );
}
