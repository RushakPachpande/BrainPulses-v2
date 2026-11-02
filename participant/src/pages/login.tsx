import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { LoginArt } from '../components/login-art';
import { ThemeButton } from '../components/theme-button';
import { SessionActiveError, useAuth } from '../contexts/auth-context';
import { ApiError } from '../lib/api-client';
import { isValidUniqueId } from '../lib/login-validation';
import '../styles/login.css';
import '../styles/login-bulb.css';

export function LoginPage() {
  const { participant, ready, signInWithCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const [code, setCode] = useState(import.meta.env.DEV ? 'BP-24101' : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);

  useEffect(() => {
    document.getElementById('idv')?.focus();
  }, []);

  if (!ready) return <p className="sr-only">Loading</p>;
  if (participant) return <Navigate to={from} replace />;

  async function signIn(replaceSession: boolean) {
    setError('');
    if (!isValidUniqueId(code)) {
      setError('Enter your Registration ID.');
      return;
    }
    setBusy(true);
    try {
      await signInWithCode(code.trim(), replaceSession);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof SessionActiveError) {
        setReplaceOpen(true);
      } else {
        setError(err instanceof ApiError ? err.message : 'Unable to sign in.');
      }
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void signIn(false);
  }

  return (
    <div className="login-screen">
      <header className="login-head">
        <div className="br big">
          <img src="/brand.svg" alt="" />
          BrainPulses
        </div>
        <ThemeButton />
      </header>
      <div className="wrap light">
        <div className="grid" />
        <div className="wm2" aria-hidden />
        <div className="l" />
        <div className="r">
          <form className="card" onSubmit={onSubmit}>
            <h1>LOGIN</h1>
            <div className="f">
              <label htmlFor="idv">Registration ID</label>
              <input
                className="in"
                id="idv"
                autoComplete="username"
                placeholder="e.g. BP-24112"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
              <div className="err" id="e1" role={error ? 'alert' : undefined}>
                {error}
              </div>
            </div>
            <button className="btn" type="submit" id="b1" disabled={busy}>
              Sign in
              <span className="ar" aria-hidden>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </button>
          </form>
        </div>
        <LoginArt />
      </div>
      <div className={`dlg ${replaceOpen ? 'open' : ''}`}>
        <div className="dc" role="dialog" aria-modal="true" aria-labelledby="replace-title">
          <h3 id="replace-title">Replace the other session?</h3>
          <p>This Registration ID is already signed in somewhere else.</p>
          <div className="da">
            <button className="s" type="button" onClick={() => setReplaceOpen(false)}>
              Stay out
            </button>
            <button className="p" type="button" disabled={busy} onClick={() => void signIn(true)}>
              Continue here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
