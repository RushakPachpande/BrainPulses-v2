import { ArrowRight, CheckCircle2, GraduationCap, ShieldCheck, Trophy } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { ApiError } from '../lib/api-client';
import { useAuth } from '../contexts/auth';

export function LoginPage() {
  const { student, ready, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const [email, setEmail] = useState('student1@mail.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (ready && student) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-brand">
        <img src="/brand.svg" alt="" />
        <span>BrainPulses</span>
      </div>
      <div className="login-layout">
        <section className="login-copy">
          <div className="eyebrow">
            <GraduationCap size={16} /> STUDENT PORTAL
          </div>
          <h1>
            Your next step
            <br />
            starts <span>here.</span>
          </h1>
          <p>One place for your quizzes, assessments, and progress. Sign in to pick up where you left off.</p>
          <div className="login-points">
            <div>
              <CheckCircle2 /> One place for every activity
            </div>
            <div>
              <ShieldCheck /> A focused assessment experience
            </div>
            <div>
              <Trophy /> Progress you can track
            </div>
          </div>
        </section>
        <form className="login-card" onSubmit={onSubmit}>
          <div className="login-card-mark">
            <GraduationCap size={22} />
          </div>
          <h2>Welcome back</h2>
          <p>Sign in with your student account to continue.</p>
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </label>
          {error && <div className="error-text">{error}</div>}
          <button className="btn primary full" disabled={busy} type="submit">
            {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} />
          </button>
          <div className="demo-note">
            <span className="dot" /> Demo org · student1@mail.com / Student123!
          </div>
        </form>
      </div>
      <div className="login-footer">
        © 2026 BrainPulses <span>Built for focused learning</span>
      </div>
    </div>
  );
}
