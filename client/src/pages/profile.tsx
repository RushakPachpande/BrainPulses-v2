import { CheckCircle2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../lib/api-client';
import { useAuth } from '../contexts/auth-context';
import { Heading, Status } from '../components/ui-bits';
import { patchMe } from '../services/api';

export function ProfilePage() {
  const { student, refreshProfile } = useAuth();
  const [name, setName] = useState(student?.name ?? '');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nextName = name.trim();
    if (!nextName || !student || nextName === student.name) return;
    setBusy(true);
    setError('');
    try {
      await patchMe(nextName);
      await refreshProfile();
      setName(nextName);
      setToast('Profile changes saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save profile.');
    } finally {
      setBusy(false);
    }
  }

  if (!student) return null;
  const initials = student.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('');
  const dirty = name.trim() !== student.name;
  const facts = [
    { label: 'Unique ID', value: student.code },
    { label: 'Organization', value: student.organization.name },
    { label: 'Role', value: 'Student' },
    ...(student.course ? [{ label: 'Course', value: student.course }] : []),
    ...(student.city ? [{ label: 'City', value: student.city }] : []),
    ...(student.phone ? [{ label: 'Phone', value: student.phone }] : []),
  ];

  return (
    <div className="page-stack">
      <Heading
        eyebrow="ACCOUNT SETTINGS"
        title="My profile"
        description="Manage the details associated with your student account."
      />
      {toast ? (
        <div className="toast" role="status">
          <CheckCircle2 size={18} aria-hidden />
          {toast}
          <button type="button" onClick={() => setToast('')} aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      ) : null}
      <section className="panel profile-identity" aria-labelledby="profile-identity-title">
        <div className="profile-identity-main">
          <div className="profile-avatar-large" aria-hidden>
            {initials}
          </div>
          <div className="profile-identity-copy">
            <h2 id="profile-identity-title">{student.name}</h2>
            <p>{student.email}</p>
            <Status value="Available" />
          </div>
        </div>
        <dl className="profile-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="panel profile-form" aria-labelledby="profile-form-title">
        <div className="panel-heading">
          <div>
            <h2 id="profile-form-title">Personal information</h2>
            <p>Update the name shown in your portal.</p>
          </div>
        </div>
        <form onSubmit={onSubmit}>
          <div className="profile-field">
            <label htmlFor="profile-name">Full name</label>
            <input
              id="profile-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              autoComplete="name"
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'profile-name-error' : 'profile-name-hint'}
            />
            {error ? (
              <p id="profile-name-error" className="error-text" role="alert">
                {error}
              </p>
            ) : (
              <p id="profile-name-hint" className="field-hint">
                This is the name shown in the portal and on your attempts.
              </p>
            )}
          </div>
          <div className="profile-field">
            <label htmlFor="profile-email">Student email</label>
            <input
              id="profile-email"
              type="email"
              value={student.email}
              readOnly
              aria-readonly="true"
              aria-describedby="profile-email-hint"
            />
            <p id="profile-email-hint" className="field-hint">
              Your organization manages this email. It cannot be changed here.
            </p>
          </div>
          <div className="form-actions">
            <button
              className="btn outline"
              type="button"
              onClick={() => {
                setName(student.name);
                setError('');
              }}
              disabled={!dirty || busy}
            >
              Reset
            </button>
            <button className="btn primary" type="submit" disabled={!dirty || busy || !name.trim()}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
