import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { CountryCodeInput } from '../components/country-code-input';
import { LoginArt } from '../components/login-art';
import { PageLoader } from '../components/loading-overlay';
import { ThemeButton } from '../components/theme-button';
import { SessionActiveError, useAuth } from '../contexts/auth-context';
import { ApiError } from '../lib/api-client';
import { isValidNationalMobile, isValidUniqueId } from '../lib/login-validation';
import { getParticipantLoginOptions } from '../services/api';
import '../styles/login.css';
import '../styles/login-bulb.css';

export function LoginPage() {
  const { participant, ready, signInWithCode, requestPhoneOtp, verifyPhoneOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [code, setCode] = useState(import.meta.env.DEV ? 'BP-24101' : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceMode, setReplaceMode] = useState<'id' | 'phone'>('id');
  const [loginImage, setLoginImage] = useState(false);
  const [phoneLogin, setPhoneLogin] = useState(false);
  const [countryCode, setCountryCode] = useState('+91');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    document.getElementById('idv')?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getParticipantLoginOptions()
      .then((options) => {
        if (!cancelled) {
          setLoginImage(options.loginImage);
          setPhoneLogin(options.phoneLogin);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return <PageLoader />;
  if (participant) return <Navigate to={from} replace />;

  async function signIn(replaceSession: boolean) {
    setError('');
    if (!isValidUniqueId(code)) {
      setError('Enter your Registration ID.');
      return;
    }
    setBusy(true);
    setReplaceMode('id');
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

  async function sendCode() {
    setPhoneError('');
    if (!isValidNationalMobile(countryCode, mobile)) {
      setPhoneError('Enter a valid mobile number.');
      return;
    }
    setBusy(true);
    try {
      await requestPhoneOtp(countryCode, mobile.trim());
      setOtpSent(true);
    } catch (err) {
      setPhoneError(err instanceof ApiError ? err.message : 'Unable to send a code.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(replaceSession: boolean) {
    setPhoneError('');
    if (!/^\d{6}$/.test(otp.trim())) {
      setPhoneError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    setReplaceMode('phone');
    try {
      await verifyPhoneOtp(countryCode, mobile.trim(), otp.trim(), replaceSession);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof SessionActiveError) {
        setReplaceOpen(true);
      } else {
        setPhoneError(err instanceof ApiError ? err.message : 'Unable to sign in.');
      }
    } finally {
      setBusy(false);
    }
  }

  function onPhoneSubmit(event: FormEvent) {
    event.preventDefault();
    if (!otpSent) void sendCode();
    else void verifyCode(false);
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
      <div className={loginImage ? 'wrap light has-side-image' : 'wrap light'}>
        <div className="grid" />
        <div className="wm2" aria-hidden />
        {loginImage ? (
          <div className="l login-side">
            <img
              src="/api/auth/participant/login-image"
              alt=""
              onError={() => setLoginImage(false)}
            />
          </div>
        ) : (
          <div className="l" />
        )}
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
          {phoneLogin ? (
            <form className="card phone-card" onSubmit={onPhoneSubmit}>
              <h2>Phone</h2>
              <div className="phone-row">
                <div className="f dial">
                  <label htmlFor="dial">Country</label>
                  <CountryCodeInput
                    id="dial"
                    value={countryCode}
                    onChange={setCountryCode}
                    disabled={busy}
                  />
                </div>
                <div className="f">
                  <label htmlFor="mobile">Mobile number</label>
                  <input
                    className="in"
                    id="mobile"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="9876543210"
                    value={mobile}
                    onChange={(event) => {
                      setMobile(event.target.value);
                      setOtpSent(false);
                      setOtp('');
                    }}
                    disabled={busy}
                  />
                </div>
              </div>
              {otpSent ? (
                <div className="f">
                  <label htmlFor="otp">Verification code</label>
                  <input
                    className="in"
                    id="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6-digit code"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                    disabled={busy}
                  />
                </div>
              ) : null}
              <div className="err" role={phoneError ? 'alert' : undefined}>
                {phoneError}
              </div>
              <button className="btn" type="submit" disabled={busy}>
                {otpSent ? 'Verify and sign in' : 'Send code'}
              </button>
              {otpSent ? (
                <button
                  className="login-alt"
                  type="button"
                  disabled={busy}
                  onClick={() => void sendCode()}
                >
                  Resend code
                </button>
              ) : null}
            </form>
          ) : null}
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
            <button
              className="p"
              type="button"
              disabled={busy}
              onClick={() => void (replaceMode === 'phone' ? verifyCode(true) : signIn(true))}
            >
              Continue here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
