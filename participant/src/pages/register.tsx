import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import {
  ArrowRight,
  Check,
  CircleAlert,
  Clock,
  Copy,
  LoaderCircle,
  Lock,
  Users,
} from 'lucide-react';
import { Link, useParams } from 'react-router';
import { PortalBackdrop } from '../components/portal-backdrop';
import { ThemeButton } from '../components/theme-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { ApiError, apiGetData, apiPostData, apiUrl } from '../lib/api-client';
import '../styles/register.css';

type PublicField = {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  help?: string;
  maxCharacters?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  options?: string[];
  consentText?: string;
  termsLink?: string;
};

type PublicFormBody = {
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
  seats: number | null;
  seatsLeft: number | null;
  fields: PublicField[];
};

type PublicForm = {
  state: 'open' | 'not_yet' | 'closed' | 'full' | 'inactive';
  message: string;
  form?: PublicFormBody;
};

type Answers = Record<string, string | string[] | boolean>;

const CLOSE_SOON_MS = 3 * 24 * 60 * 60 * 1000;

export function RegisterPage() {
  const { slug = '' } = useParams();
  const [page, setPage] = useState<PublicForm | null>(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<{ code: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let cancelled = false;
    void apiGetData<PublicForm>(`/api/public/contest-forms/${encodeURIComponent(slug)}`)
      .then((data) => {
        if (!cancelled) setPage(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'This link is not available.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    const name = page?.form?.contestName;
    document.title = name ? `Register · ${name} · BrainPulses` : 'Register · BrainPulses';
  }, [page?.form?.contestName]);

  useEffect(() => {
    if (!result) return;
    doneRef.current?.focus();
  }, [result]);

  useEffect(() => {
    const ids = Object.keys(fieldErrors);
    if (ids.length === 0) return;
    const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    first?.focus();
  }, [fieldErrors]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      const data = await apiPostData<{ outcome: string; code: string; message: string }>(
        `/api/public/contest-forms/${encodeURIComponent(slug)}/register`,
        { answers },
        undefined,
        { blocking: true },
      );
      setResult({ code: data.code, message: data.message });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields ?? {});
      } else {
        setError('Registration could not be saved.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setToast('Registration ID copied');
    } catch {
      setToast(code);
    }
  }

  const form = page?.form;
  const showIntro = Boolean(form);
  const fieldErrorCount = Object.keys(fieldErrors).length;
  const namePair = nameFields(form?.fields ?? []);

  return (
    <div className="register-screen">
      <PortalBackdrop />
      <header className="top">
        <Link className="brand" to="/login" aria-label="BrainPulses home">
          <img src="/brand.svg" alt="" />
          BrainPulses
        </Link>
        <ThemeButton className="mode" />
      </header>
      <main className={showIntro ? undefined : 'solo'}>
        {form ? <Intro form={form} slug={slug} /> : null}
        <section className="card">
          {!page && !error ? <p className="status">Loading registration form…</p> : null}
          {page?.state === 'inactive' ? (
            <p className="status" role="status">
              {page.message}
            </p>
          ) : null}
          {error && !form ? (
            <div className="alert" role="alert">
              <CircleAlert aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}
          {result && form ? (
            <Success
              headingRef={doneRef}
              contestName={form.contestName}
              firstName={answerText(form, answers, 'first_name')}
              email={answerText(form, answers, 'email')}
              code={result.code}
              onCopy={() => void copyCode(result.code)}
            />
          ) : null}
          {form && !result && page && page.state !== 'open' ? (
            <Blocked
              state={page.state}
              message={page.message}
              contestName={form.contestName}
              seats={form.seats}
            />
          ) : null}
          {form && !result && page?.state === 'open' ? (
            <>
              <h2>Register</h2>
              <p className="sub">
                Fields marked <span className="req">*</span> are required.
              </p>
              <form ref={formRef} noValidate onSubmit={(event) => void onSubmit(event)}>
                {fieldErrorCount > 1 ? (
                  <div className="alert" role="alert">
                    <CircleAlert aria-hidden />
                    <span>Please fix {fieldErrorCount} fields below.</span>
                  </div>
                ) : null}
                {error && fieldErrorCount === 0 ? (
                  <div className="alert" role="alert">
                    <CircleAlert aria-hidden />
                    <span>{error}</span>
                  </div>
                ) : null}
                {form.fields.map((field) => {
                  if (namePair && (field.key === 'first_name' || field.key === 'last_name')) {
                    if (field.key !== namePair[0].key) return null;
                    return (
                      <div className="row2" key="name-pair">
                        {namePair.map((nameField) => (
                          <PublicFieldInput
                            key={nameField.id}
                            field={nameField}
                            value={answers[nameField.id]}
                            error={fieldErrors[nameField.id]}
                            onChange={(value) =>
                              setAnswers((current) => ({ ...current, [nameField.id]: value }))
                            }
                          />
                        ))}
                      </div>
                    );
                  }
                  return (
                    <PublicFieldInput
                      key={field.id}
                      field={field}
                      value={answers[field.id]}
                      error={fieldErrors[field.id]}
                      onChange={(value) =>
                        setAnswers((current) => ({ ...current, [field.id]: value }))
                      }
                    />
                  );
                })}
                <button className="submit" type="submit" disabled={busy} aria-busy={busy}>
                  {busy ? (
                    <>
                      <LoaderCircle className="spin" aria-hidden />
                      Registering…
                    </>
                  ) : (
                    <>
                      Register <ArrowRight aria-hidden />
                    </>
                  )}
                </button>
                <p className="login">
                  Already registered? <Link to="/login">Log in</Link>
                </p>
                <p className="secure">
                  <Lock aria-hidden />
                  Your details are only shared with the organiser of this contest.
                </p>
              </form>
            </>
          ) : null}
        </section>
      </main>
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function Intro({ form, slug }: { form: PublicFormBody; slug: string }) {
  const close = form.showRegistrationCloses && form.closesAt ? closeFact(form.closesAt) : null;
  const showSeats = form.showSeatsLeft && form.seats != null && form.seatsLeft != null;
  const sponsor = form.showSponsorName ? form.sponsorName.trim() : '';
  return (
    <section className="intro" aria-labelledby="contest-name">
      {form.contestImage ? (
        <figure className="cover">
          <img
            src={apiUrl(`/api/public/contest-forms/${encodeURIComponent(slug)}/image/contest`)}
            alt=""
          />
        </figure>
      ) : null}
      {sponsor ? (
        <span className="sponsor">
          <i aria-hidden="true">{sponsor.charAt(0).toUpperCase()}</i>
          Presented by <b>{sponsor}</b>
        </span>
      ) : null}
      <h1 id="contest-name">{form.contestName}</h1>
      {form.welcomeMessage ? <p className="welcome">{form.welcomeMessage}</p> : null}
      {close || showSeats ? (
        <div className="facts">
          {close ? (
            <div className={close.urgent ? 'fact urgent' : 'fact'}>
              <Clock aria-hidden />
              <div>
                <small>{close.label}</small>
                <b>{formatWhen(form.closesAt ?? '')}</b>
              </div>
            </div>
          ) : null}
          {showSeats ? (
            <div className="fact">
              <Users aria-hidden />
              <div>
                <small>Seats left</small>
                <b>
                  {form.seatsLeft} of {form.seats}
                </b>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <ol className="steps" aria-label="How it works">
        <li>
          <span className="n">1</span>
          <div>
            <b>Fill in this form</b>
            <span>Your details for this contest.</span>
          </div>
        </li>
        <li>
          <span className="n">2</span>
          <div>
            <b>Get your Registration ID</b>
            <span>Shown straight away and sent to your email.</span>
          </div>
        </li>
        <li>
          <span className="n">3</span>
          <div>
            <b>Log in with it</b>
            <span>Your quizzes appear on your home page when they&apos;re ready.</span>
          </div>
        </li>
      </ol>
    </section>
  );
}

function Success({
  headingRef,
  contestName,
  firstName,
  code,
  onCopy,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  contestName: string;
  firstName: string;
  email: string;
  code: string;
  onCopy: () => void;
}) {
  return (
    <div className="done">
      <div className="ok">
        <Check aria-hidden />
      </div>
      <h2 ref={headingRef} tabIndex={-1}>
        You&apos;re registered!
      </h2>
      <p>
        Welcome to {contestName}
        {firstName ? `, ${firstName}` : ''}.
      </p>
      <div className="idbox">
        <small>Your Registration ID</small>
        <div className="idrow">
          <b>{code}</b>
          <button className="copy" type="button" onClick={onCopy}>
            <Copy aria-hidden />
            Copy
          </button>
        </div>
      </div>
      <Link className="submit next" to="/login" target="_blank" rel="noopener noreferrer">
        Log in to BrainPulses <ArrowRight aria-hidden />
      </Link>
    </div>
  );
}

function Blocked({
  state,
  message,
  contestName,
  seats,
}: {
  state: PublicForm['state'];
  message: string;
  contestName: string;
  seats: number | null;
}) {
  const title =
    state === 'full'
      ? 'All seats are taken'
      : state === 'not_yet'
        ? 'Registration opens soon'
        : state === 'closed'
          ? 'Registration has closed'
          : 'Registration unavailable';
  const body =
    state === 'full' && seats != null && !message.includes(String(seats))
      ? `${contestName} has reached its limit of ${seats} registrations.`
      : message;
  return (
    <div className="done">
      <div className="state-ic">
        {state === 'full' ? <Users aria-hidden /> : <Clock aria-hidden />}
      </div>
      <h2>{title}</h2>
      <p role="status">{body}</p>
      {state === 'not_yet' ? null : (
        <>
          <p>Already registered?</p>
          <Link className="submit next" to="/login">
            Log in <ArrowRight aria-hidden />
          </Link>
        </>
      )}
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
  const helpId = field.help ? `h-${field.id}` : undefined;
  const errorId = error ? `e-${field.id}` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  const mark = field.required ? (
    <span className="req" aria-hidden="true">
      *
    </span>
  ) : (
    <span className="opt"> (optional)</span>
  );

  if (field.type === 'consent') {
    return (
      <div className={error ? 'field err' : 'field'}>
        <label className="consent" htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            checked={value === true}
            aria-invalid={error ? true : undefined}
            aria-required={field.required || undefined}
            aria-describedby={describedBy}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>
            {field.consentText || field.label}
            {field.termsLink ? (
              <>
                {' '}
                <a href={field.termsLink}>Full terms</a>
              </>
            ) : null}
          </span>
        </label>
        {error ? <FieldError id={errorId} message={error} /> : null}
      </div>
    );
  }

  if (field.type === 'dropdown') {
    return (
      <div className={error ? 'field err' : 'field'}>
        <label htmlFor={id}>
          {field.label}
          {mark}
        </label>
        <div className="ctrl">
          <Select
            value={typeof value === 'string' && value ? value : undefined}
            onValueChange={onChange}
          >
            <SelectTrigger
              id={id}
              aria-label={field.label}
              aria-invalid={error ? true : undefined}
              aria-required={field.required || undefined}
              aria-describedby={describedBy}
            >
              <SelectValue placeholder={field.placeholder || 'Choose'} />
            </SelectTrigger>
            <SelectContent className="register-select">
              {(field.options ?? []).map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {field.help ? (
          <div className="help" id={helpId}>
            {field.help}
          </div>
        ) : null}
        {error ? <FieldError id={errorId} message={error} /> : null}
      </div>
    );
  }

  if (field.type === 'multi_select') {
    const picked = Array.isArray(value) ? value : [];
    return (
      <fieldset className={error ? 'field err' : 'field'}>
        <legend>
          {field.label}
          {mark}
        </legend>
        <div className="checks">
          {(field.options ?? []).map((option) => (
            <label key={option}>
              <input
                type="checkbox"
                checked={picked.includes(option)}
                aria-describedby={describedBy}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...picked, option]
                      : picked.filter((item) => item !== option),
                  )
                }
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        {field.help ? (
          <div className="help" id={helpId}>
            {field.help}
          </div>
        ) : null}
        {error ? <FieldError id={errorId} message={error} /> : null}
      </fieldset>
    );
  }

  const text = typeof value === 'string' ? value : '';
  return (
    <div className={error ? 'field err' : 'field'}>
      <label htmlFor={id}>
        {field.label}
        {mark}
      </label>
      <div className="ctrl">
        {field.type === 'phone' ? <span className="pre">+91</span> : null}
        {field.type === 'textarea' ? (
          <textarea
            id={id}
            value={text}
            placeholder={field.placeholder}
            maxLength={field.maxCharacters ?? undefined}
            autoComplete={autoComplete(field)}
            aria-invalid={error ? true : undefined}
            aria-required={field.required || undefined}
            aria-describedby={describedBy}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <input
            id={id}
            type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
            inputMode={
              field.type === 'email' ? 'email' : field.type === 'phone' ? 'numeric' : undefined
            }
            spellCheck={field.type === 'email' ? false : undefined}
            autoComplete={autoComplete(field)}
            maxLength={field.type === 'phone' ? 10 : (field.maxCharacters ?? undefined)}
            min={field.type === 'number' ? (field.minValue ?? undefined) : undefined}
            max={field.type === 'number' ? (field.maxValue ?? undefined) : undefined}
            placeholder={
              field.type === 'phone'
                ? field.placeholder || '10-digit mobile number'
                : field.placeholder
            }
            value={text}
            aria-invalid={error ? true : undefined}
            aria-required={field.required || undefined}
            aria-describedby={describedBy}
            onChange={(event) =>
              onChange(
                field.type === 'phone'
                  ? event.target.value.replace(/\D/g, '').slice(0, 10)
                  : event.target.value,
              )
            }
          />
        )}
      </div>
      {field.help ? (
        <div className="help" id={helpId}>
          {field.help}
        </div>
      ) : null}
      {error ? <FieldError id={errorId} message={error} /> : null}
    </div>
  );
}

function FieldError({ id, message }: { id?: string; message: string }) {
  return (
    <div className="msg" id={id}>
      <CircleAlert aria-hidden />
      {message}
    </div>
  );
}

function nameFields(fields: PublicField[]): [PublicField, PublicField] | null {
  const first = fields.find((field) => field.key === 'first_name');
  const last = fields.find((field) => field.key === 'last_name');
  if (!first || !last) return null;
  return [first, last];
}

function answerText(form: PublicFormBody, answers: Answers, key: string) {
  const field = form.fields.find((item) => item.key === key);
  const value = field ? answers[field.id] : '';
  return typeof value === 'string' ? value.trim() : '';
}

function closeFact(closesAt: string): { label: string; urgent: boolean } {
  const diff = new Date(closesAt).getTime() - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) {
    return { label: 'Registration has closed', urgent: false };
  }
  const urgent = diff <= CLOSE_SOON_MS;
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) {
    return {
      label: `Registration closes in ${minutes} ${plural(minutes, 'minute')}`,
      urgent: true,
    };
  }
  const hours = Math.round(diff / 3600000);
  if (hours < 48) {
    return { label: `Registration closes in ${hours} ${plural(hours, 'hour')}`, urgent: true };
  }
  const days = Math.round(diff / 86400000);
  return { label: `Registration closes in ${days} ${plural(days, 'day')}`, urgent };
}

function plural(count: number, word: string) {
  return count === 1 ? word : `${word}s`;
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function autoComplete(field: PublicField) {
  if (field.key === 'first_name') return 'given-name';
  if (field.key === 'last_name') return 'family-name';
  if (field.type === 'email') return 'email';
  if (field.type === 'phone') return 'tel-national';
  return 'off';
}
