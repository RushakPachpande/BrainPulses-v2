import { ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../lib/api-client';
import { useAuth } from '../contexts/auth';
import { Heading, Status } from '../components/ui-bits';
import { patchMe } from '../services/api';

export function ProfilePage() {
  const { student, refreshProfile } = useAuth();
  const [name, setName] = useState(student?.name ?? '');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await patchMe(name.trim());
      await refreshProfile();
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
    .map((x) => x[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="page-stack">
      <Heading
        eyebrow="ACCOUNT SETTINGS"
        title="My profile"
        description="Manage the details associated with your student account."
      />
      {toast && <div className="toast">{toast}</div>}
      {error && <div className="error-text">{error}</div>}
      <div className="profile-grid">
        <section className="panel profile-card">
          <div className="profile-cover" />
          <div className="profile-avatar-large">{initials}</div>
          <h2>{student.name}</h2>
          <p>{student.email}</p>
          <Status value="Available" />
          <div className="profile-card-foot">
            <ShieldCheck size={16} />
            <span>
              {student.code} · {student.organization.name}
            </span>
          </div>
        </section>
        <section className="panel profile-form">
          <div className="panel-heading">
            <div>
              <h2>Personal information</h2>
              <p>Update the name shown in your portal.</p>
            </div>
          </div>
          <form onSubmit={onSubmit}>
            <label>
              Full name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Student email
              <input type="email" value={student.email} disabled />
            </label>
            <label>
              Role
              <input value="Student" disabled />
            </label>
            <div className="form-actions">
              <button
                className="btn outline"
                type="button"
                onClick={() => setName(student.name)}
              >
                Reset
              </button>
              <button className="btn primary" type="submit" disabled={busy}>
                Save changes
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
