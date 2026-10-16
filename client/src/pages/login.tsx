import { ArrowRight, GraduationCap } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { CountryCodeInput } from '../components/country-code-input';
import { ThemeToggle } from '../components/theme-toggle';
import { ApiError } from '../lib/api-client';
import {
  isKnownDialCode,
  isValidNationalMobile,
  isValidUniqueId,
} from '../lib/login-validation';
import { useAuth } from '../contexts/auth';

type LoginTab = 'code' | 'phone';
type PhoneStep = 'enter' | 'otp';

const OTP_LENGTH = 6;

export function LoginPage() {
  const {
    student,
    ready,
    signInWithCode,
    requestPhoneOtp,
    resendPhoneOtp,
    verifyPhoneOtp,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const [tab, setTab] = useState<LoginTab>('code');
  const [code, setCode] = useState('BP-24101');
  const [countryCode, setCountryCode] = useState('+91');
  const [mobileNumber, setMobileNumber] = useState('');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('enter');
  const [otpDigits, setOtpDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [otpInvalid, setOtpInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');

  const [codeTouched, setCodeTouched] = useState(false);
  const [countryTouched, setCountryTouched] = useState(false);
  const [mobileTouched, setMobileTouched] = useState(false);
  const [codeAttempted, setCodeAttempted] = useState(false);
  const [phoneAttempted, setPhoneAttempted] = useState(false);

  const codeFieldId = useId();
  const countryFieldId = useId();
  const mobileFieldId = useId();
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const codeValid = isValidUniqueId(code);
  const dialValid = isKnownDialCode(countryCode);
  const mobileValid = isValidNationalMobile(countryCode, mobileNumber);
  const phoneValid = dialValid && mobileValid;

  // Non-empty invalid values show red immediately; empty waits for blur / submit.
  const showCodeInvalid =
    !codeValid && (code.trim() !== '' || codeTouched || codeAttempted);
  const showDialInvalid =
    !dialValid && (countryCode.trim() !== '' || countryTouched || phoneAttempted);
  const showMobileInvalid =
    (!mobileValid || (mobileNumber.trim() !== '' && !dialValid)) &&
    (mobileNumber.trim() !== '' || mobileTouched || phoneAttempted);

  useEffect(() => {
    if (phoneStep === 'otp') {
      otpRefs.current[0]?.focus();
    }
  }, [phoneStep]);

  async function onCodeSubmit(e: FormEvent) {
    e.preventDefault();
    setCodeAttempted(true);
    if (!codeValid) return;
    setError('');
    setBusy(true);
    try {
      await signInWithCode(code.trim());
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function onPhoneSubmit(e: FormEvent) {
    e.preventDefault();
    setPhoneAttempted(true);
    if (!phoneValid) return;
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await requestPhoneOtp(countryCode.trim(), mobileNumber.replace(/\D/g, ''));
      setPhoneStep('otp');
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setInfo('If that number is registered, an OTP has been sent.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to send OTP.');
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(digits: string[]) {
    const otp = digits.join('');
    if (otp.length !== OTP_LENGTH || busy) return;
    setError('');
    setOtpInvalid(false);
    setBusy(true);
    try {
      await verifyPhoneOtp(countryCode.trim(), mobileNumber.replace(/\D/g, ''), otp);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to verify OTP.');
      setOtpInvalid(true);
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      otpRefs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    setError('');
    setOtpInvalid(false);
    setInfo('');
    setBusy(true);
    try {
      await resendPhoneOtp(countryCode.trim(), mobileNumber.replace(/\D/g, ''));
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setInfo('A new OTP has been sent if that number is registered.');
      otpRefs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to resend OTP.');
    } finally {
      setBusy(false);
    }
  }

  function applyOtpDigits(raw: string, startIndex = 0) {
    const digits = raw.replace(/\D/g, '').slice(0, OTP_LENGTH - startIndex);
    if (!digits) return;

    setOtpInvalid(false);
    const next = [...otpDigits];
    for (let i = 0; i < digits.length; i++) {
      next[startIndex + i] = digits[i]!;
    }
    setOtpDigits(next);

    const lastFilled = Math.min(startIndex + digits.length - 1, OTP_LENGTH - 1);
    const focusIndex = next.every((d) => d !== '')
      ? OTP_LENGTH - 1
      : Math.min(lastFilled + 1, OTP_LENGTH - 1);
    otpRefs.current[focusIndex]?.focus();

    if (next.every((d) => d !== '')) {
      void submitOtp(next);
    }
  }

  function updateOtpDigit(index: number, value: string) {
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length > 1) {
      applyOtpDigits(digitsOnly, index);
      return;
    }
    setOtpInvalid(false);
    const digit = digitsOnly.slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
    if (digit && next.every((d) => d !== '')) {
      void submitOtp(next);
    }
  }

  function onOtpPaste(index: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    applyOtpDigits(e.clipboardData.getData('text'), index);
  }

  function onOtpKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function switchTab(next: LoginTab) {
    setTab(next);
    setError('');
    setInfo('');
    if (next === 'code') {
      setPhoneStep('enter');
    }
  }

  if (ready && student) return <Navigate to={from} replace />;

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
        <form
          className="login-card"
          onSubmit={tab === 'code' ? onCodeSubmit : phoneStep === 'enter' ? onPhoneSubmit : (e) => e.preventDefault()}
          noValidate
        >
          <div className="login-card-mark">
            <GraduationCap size={22} aria-hidden />
          </div>
          <h1>Student sign in</h1>
          <p>Use your Unique ID or phone number to continue.</p>

          <div className="login-tabs" role="tablist" aria-label="Sign-in method">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'code'}
              className={tab === 'code' ? 'selected' : undefined}
              onClick={() => switchTab('code')}
            >
              Unique ID
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'phone'}
              className={tab === 'phone' ? 'selected' : undefined}
              onClick={() => switchTab('phone')}
            >
              Phone
            </button>
          </div>

          {tab === 'code' && (
            <div role="tabpanel">
              <label htmlFor={codeFieldId}>
                Unique ID
                <input
                  id={codeFieldId}
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setCodeTouched(true);
                  }}
                  onBlur={() => setCodeTouched(true)}
                  required
                  autoComplete="username"
                  placeholder="e.g. BP-24101"
                  disabled={busy}
                  aria-invalid={showCodeInvalid || undefined}
                  className={showCodeInvalid ? 'input-invalid' : undefined}
                />
              </label>
              {showCodeInvalid && (
                <div className="error-text" role="alert">
                  Enter a valid Unique ID (4–40 letters, digits, hyphen, or underscore).
                </div>
              )}
              {error && !showCodeInvalid && (
                <div className="error-text" role="alert">
                  {error}
                </div>
              )}
              <button className="btn primary full" disabled={busy || !codeValid} type="submit">
                {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} aria-hidden />
              </button>
              <div className="demo-note">
                <span className="dot" /> Demo · Unique ID BP-24101
              </div>
            </div>
          )}

          {tab === 'phone' && phoneStep === 'enter' && (
            <div role="tabpanel">
              <div className="phone-row">
                <label htmlFor={countryFieldId} className="phone-code">
                  Code
                  <CountryCodeInput
                    id={countryFieldId}
                    value={countryCode}
                    onChange={(value) => {
                      setCountryCode(value);
                    }}
                    onBlur={() => setCountryTouched(true)}
                    invalid={showDialInvalid}
                    required
                    disabled={busy}
                  />
                </label>
                <label htmlFor={mobileFieldId} className="phone-mobile">
                  Mobile number
                  <input
                    id={mobileFieldId}
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/[^\d\s()-]/g, ''))}
                    onBlur={() => setMobileTouched(true)}
                    required
                    autoComplete="tel-national"
                    placeholder="9876510000"
                    disabled={busy}
                    inputMode="numeric"
                    aria-invalid={showMobileInvalid || undefined}
                    className={showMobileInvalid ? 'input-invalid' : undefined}
                  />
                </label>
              </div>
              {(showDialInvalid || showMobileInvalid) && (
                <div className="error-text" role="alert">
                  {showDialInvalid
                    ? 'Select a valid country code from the list.'
                    : 'Enter a valid mobile number for the selected country.'}
                </div>
              )}
              {error && !showDialInvalid && !showMobileInvalid && (
                <div className="error-text" role="alert">
                  {error}
                </div>
              )}
              <button className="btn primary full" disabled={busy || !phoneValid} type="submit">
                {busy ? 'Sending…' : 'Continue'} <ArrowRight size={16} aria-hidden />
              </button>
              <div className="demo-note">
                <span className="dot" /> Demo · +91 9876510000 (OTP in API log)
              </div>
            </div>
          )}

          {tab === 'phone' && phoneStep === 'otp' && (
            <div role="tabpanel">
              <p className="otp-hint">
                Enter the 6-digit code sent to {countryCode} {mobileNumber.replace(/\D/g, '')}
              </p>
              {info && (
                <div className="info-text" role="status">
                  {info}
                </div>
              )}
              <div
                className={`otp-row${otpInvalid ? ' otp-row-invalid' : ''}`}
                role="group"
                aria-label="One-time password"
                aria-invalid={otpInvalid || undefined}
              >
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      otpRefs.current[index] = el;
                    }}
                    className={`otp-input${otpInvalid ? ' otp-input-invalid' : ''}`}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    value={digit}
                    aria-label={`Digit ${index + 1}`}
                    aria-invalid={otpInvalid || undefined}
                    disabled={busy}
                    onChange={(e) => updateOtpDigit(index, e.target.value)}
                    onPaste={(e) => onOtpPaste(index, e)}
                    onKeyDown={(e) => onOtpKeyDown(index, e)}
                  />
                ))}
              </div>
              {error && (
                <div className="error-text" role="alert">
                  {error}
                </div>
              )}
              <button
                className="btn primary full"
                type="button"
                disabled={busy || otpDigits.join('').length !== OTP_LENGTH}
                onClick={() => void submitOtp(otpDigits)}
              >
                {busy ? 'Verifying…' : 'Verify and sign in'}
              </button>
              <div className="login-secondary-actions">
                <button
                  type="button"
                  className="text-btn"
                  disabled={busy}
                  onClick={() => {
                    setPhoneStep('enter');
                    setError('');
                    setOtpInvalid(false);
                    setInfo('');
                    setOtpDigits(Array(OTP_LENGTH).fill(''));
                  }}
                >
                  Change number
                </button>
                <button type="button" className="text-btn" disabled={busy} onClick={() => void onResend()}>
                  Resend OTP
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      <div className="login-footer">
        © 2026 BrainPulses <span>Student portal</span>
      </div>
    </div>
  );
}
