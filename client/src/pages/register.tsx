import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { ThemeToggle } from '../components/theme-toggle';
import { ApiError, apiGetData, apiPostData } from '../lib/api-client';

type PublicField = {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];
  consentText?: string;
  termsLink?: string;
};

type PublicForm = {
  state: 'open' | 'not_yet' | 'closed' | 'full' | 'inactive';
  message: string;
  form?: {
    slug: string | null;
    contestName: string;
    sponsorName: string;
    welcomeMessage: string | null;
    showContestImage: boolean;
    showSponsorName: boolean;
    showRegistrationCloses: boolean;
    showSeatsLeft: boolean;
    contestImage: boolean;
    closesAt: string | null;
    seatsLeft: number | null;
    fields: PublicField[];
  };
};

type Answers = Record<string, string | string[] | boolean>;

export function RegisterPage() {
  const { slug = '' } = useParams();
  const [page, setPage] = useState<PublicForm | null>(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<{ code: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiGetData<PublicForm>(`/api/public/contest-forms/${encodeURIComponent(slug)}`)
      .then((data) => {
        if (!cancelled) setPage(data);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : 'This link is not available.');
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      const data = await apiPostData<{ outcome: string; code: string; message: string }>(
        `/api/public/contest-forms/${encodeURIComponent(slug)}/register`,
        { answers },
      );
      setResult({ code: data.code, message: data.message });
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFieldErrors(err.fields);
      setError(err instanceof ApiError ? err.message : 'Could not register.');
    } finally {
      setBusy(false);
    }
  }

  const form = page?.form;
  const blocked = page && page.state !== 'open';

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
        <div className="login-card">
          {!page && !error ? <p>Loading registration form…</p> : null}
          {page?.state === 'inactive' ? <p role="status">{page.message}</p> : null}
          {error && !form ? (
            <p className="error-text" role="alert">
              {error}
            </p>
          ) : null}
          {result ? (
            <div>
              <h1>{form?.contestName}</h1>
              <p>{result.message}</p>
              <p className="font-mono">{result.code}</p>
              <Link className="btn primary full" to="/login">
                Log in
              </Link>
            </div>
          ) : null}
          {form && !result ? (
            <>
              {form.contestImage ? (
                <img
                  src={`/api/public/contest-forms/${encodeURIComponent(slug)}/image/contest`}
                  alt=""
                  className="login-card-mark"
                />
              ) : null}
              {form.showSponsorName ? <p>{form.sponsorName}</p> : null}
              <h1>{form.contestName}</h1>
              {form.welcomeMessage ? <p>{form.welcomeMessage}</p> : null}
              {blocked ? (
                <div>
                  <p role="status">{page?.message}</p>
                  <Link to="/login">Log in</Link>
                </div>
              ) : (
                <form onSubmit={(event) => void onSubmit(event)} noValidate>
                  {form.fields.map((field) => (
                    <PublicFieldInput
                      key={field.id}
                      field={field}
                      value={answers[field.id]}
                      error={fieldErrors[field.id]}
                      onChange={(value) =>
                        setAnswers((current) => ({ ...current, [field.id]: value }))
                      }
                    />
                  ))}
                  {error ? (
                    <div className="error-text" role="alert">
                      {error}
                    </div>
                  ) : null}
                  <button className="btn primary full" type="submit" disabled={busy}>
                    {busy ? 'Registering…' : 'Register'}
                  </button>
                  <p>
                    Already registered? <Link to="/login">Log in</Link>
                  </p>
                </form>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PublicFieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: PublicField;
  value: string | string[] | boolean | undefined;
  error?: string;
  onChange: (value: string | string[] | boolean) => void;
}) {
  const id = `reg-${field.id}`;
  if (field.type === 'consent') {
    return (
      <div>
        <label htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
          />{' '}
          {field.consentText || field.label}
          {field.termsLink ? (
            <>
              {' '}
              <a href={field.termsLink}>Full terms</a>
            </>
          ) : null}
        </label>
        {error ? <div className="error-text">{error}</div> : null}
      </div>
    );
  }
  if (field.type === 'dropdown') {
    return (
      <label htmlFor={id}>
        {field.label}
        <Select
          value={typeof value === 'string' && value ? value : undefined}
          onValueChange={(next) => onChange(next)}
        >
          <SelectTrigger id={id} aria-label={field.label}>
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error ? <div className="error-text">{error}</div> : null}
      </label>
    );
  }
  if (field.type === 'multi_select') {
    const picked = Array.isArray(value) ? value : [];
    return (
      <fieldset>
        <legend>{field.label}</legend>
        {(field.options ?? []).map((option) => (
          <label key={option}>
            <input
              type="checkbox"
              checked={picked.includes(option)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...picked, option]
                    : picked.filter((item) => item !== option),
                )
              }
            />{' '}
            {option}
          </label>
        ))}
        {error ? <div className="error-text">{error}</div> : null}
      </fieldset>
    );
  }
  return (
    <label htmlFor={id}>
      {field.label}
      {field.type === 'textarea' ? (
        <textarea
          id={id}
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
          value={typeof value === 'string' ? value : ''}
          placeholder={field.type === 'phone' ? '10-digit mobile number' : field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {field.help ? <span>{field.help}</span> : null}
      {error ? <div className="error-text">{error}</div> : null}
    </label>
  );
}
