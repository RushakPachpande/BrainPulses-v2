import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/auth-context';
import { PortalBrand } from './portal-brand';
import { ThemeButton } from './theme-button';

export function PortalHeader({ showName = false }: { showName?: boolean }) {
  const { participant } = useAuth();
  const navigate = useNavigate();
  const name = participant?.name ?? 'Participant';
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="hdr">
      <PortalBrand onHome={() => navigate('/dashboard')} />
      <div className="me">
        <ThemeButton />
        {showName ? <b>{name}</b> : null}
        <div className="av" title={name}>
          {initials || 'BP'}
        </div>
      </div>
    </header>
  );
}
