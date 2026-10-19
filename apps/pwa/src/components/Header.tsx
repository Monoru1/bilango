import { Logo, initials } from '@gobilan/ui';

export function Header({ title, subtitle = 'GoBilan', userName, onMenu, onAvatar, left }: { title: string; subtitle?: string; userName: string; onMenu?: () => void; onAvatar?: () => void; left?: 'menu' | 'logo' }) {
  return (
    <header className="topbar">
      {onMenu && left === 'menu' && (
        <button className="iconbtn" onClick={onMenu} aria-label="Ouvrir le menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#14181A" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
      )}
      <Logo size={32} />
      <div className="title">
        <div className="name">{title}</div>
        <div className="sub">{subtitle}</div>
      </div>
      <button className="avatar" onClick={onAvatar} aria-label="Mon profil">{initials(userName)}</button>
    </header>
  );
}
