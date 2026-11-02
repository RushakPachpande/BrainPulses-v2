import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/auth-context';
import { PortalBrand } from './portal-brand';
import { ThemeButton } from './theme-button';

export function PortalHeader({ showName = false }: { showName?: boolean }) {
  const { participant } = useAuth();
  const navigate = useNavigate();
  const name = participant?.name ?? 'Participant';

  return (
    <header className="hdr">
      <PortalBrand onHome={() => navigate('/dashboard')} />
      <div className="me">
        <ThemeButton />
        {showName ? <b>{name}</b> : null}
      </div>
    </header>
  );
}
