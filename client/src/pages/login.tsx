import { ArrowRight, GraduationCap, X } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { AuthSessionSkeleton } from '../components/skeletons';
import { ThemeToggle } from '../components/theme-toggle';
import { ApiError } from '../lib/api-client';
import { isValidUniqueId } from '../lib/login-validation';
import { SessionActiveError, useAuth } from '../contexts/auth-context';

export function LoginPage() {
  const { participant, ready, signInWithCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const [code, setCode] = useState(import.meta.env.DEV ? 'BP-24101' : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [codeTouched, setCodeTouched] = useState(false);
  const [codeAttempted, setCodeAttempted] = useState(false);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const codeFieldId = useId();

  const codeValid = isValidUniqueId(code);
  const showCodeInvalid = !codeValid && (code.trim() !== '' || codeTouched || codeAttempted);

  if (!ready) return <AuthSessionSkeleton />;
  if (ready && participant) return <Navigate to={from} replace />;

  async function complete(value: string, replaceSession: boolean) {
    await signInWithCode(value, replaceSession);
    navigate(from, { replace: true });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setCodeAttempted(true);
    if (!codeValid) return;
    setError('');
    setBusy(true);
    try {
      await complete(code.trim(), false);
    } catch (err) {
      if (err instanceof SessionActiveError) setSessionCode(code.trim());
      else setError(err instanceof ApiError ? err.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page login-page-centered">
      <div className="login-brand-row">
        <div className="login-brand">
          <img src="/brand.svg" alt="" />
          <span>BrainPulses</span>
        </div>
        <ThemeToggle className="icon-btn theme-toggle login-theme-toggle" />
      </div>
      <div className="login-center page-enter">
        <form className="login-card" onSubmit={(event) => void onSubmit(event)} noValidate>
          <div className="login-card-mark">
            <GraduationCap size={22} aria-hidden />
          </div>
          <h1>LOGIN</h1>
          <p>Use your Registration ID to continue.</p>
          <label htmlFor={codeFieldId}>
            Registration ID
            <input
              id={codeFieldId}
              type="text"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setCodeTouched(true);
              }}
              onBlur={() => setCodeTouched(true)}
              required
              autoComplete="username"
              placeholder="e.g. BP48210937"
              disabled={busy}
              aria-invalid={showCodeInvalid || undefined}
              className={showCodeInvalid ? 'input-invalid' : undefined}
            />
          </label>
          {showCodeInvalid ? (
            <div className="error-text" role="alert">
              Enter a valid Registration ID
            </div>
          ) : null}
          {error && !showCodeInvalid ? (
            <div className="error-text" role="alert">
              {error}
            </div>
          ) : null}
          <button className="btn primary full" disabled={busy || !codeValid} type="submit">
            {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} aria-hidden />
          </button>
        </form>
      </div>
      <div className="login-footer">
        © 2026 BrainPulses <span>Participant portal</span>
      </div>
      {sessionCode ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="session-replace-title"
            aria-describedby="session-replace-desc"
          >
            <button
              className="modal-close icon-btn"
              type="button"
              onClick={() => setSessionCode(null)}
              aria-label="Close"
              disabled={busy}
            >
              <X size={18} />
            </button>
            <h2 id="session-replace-title">Active session found</h2>
            <p id="session-replace-desc">
              Another device or browser is already signed in with this account. Continuing will
              revoke that session. Any unsaved answers on the other device will be lost.
            </p>
            <div className="modal-actions">
              <button
                className="btn outline"
                type="button"
                disabled={busy}
                onClick={() => setSessionCode(null)}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void complete(sessionCode, true)
                    .catch((err: unknown) => {
                      setError(err instanceof ApiError ? err.message : 'Unable to sign in.');
                      setSessionCode(null);
                    })
                    .finally(() => setBusy(false));
                }}
              >
                {busy ? 'Continuing…' : 'Revoke and continue'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
