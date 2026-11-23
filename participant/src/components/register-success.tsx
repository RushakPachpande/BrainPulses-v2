import type { RefObject } from 'react';
import { ArrowRight, Check, Copy } from 'lucide-react';
import { Link } from 'react-router';
import { apiUrl } from '../lib/api-client';
import { sanitizeInstructionsHtml } from '../lib/sanitize-html';

export type PublicThankYou = {
  enabled: boolean;
  kind: 'template' | 'custom' | 'image';
  title: string | null;
  html: string | null;
  image: boolean;
  showNextSteps: boolean;
  showQuizzes: boolean;
  quizzes?: { id: string; name: string; kind: string }[];
  buttonLabel: string | null;
  buttonUrl: string | null;
};

export function RegisterSuccess({
  headingRef,
  contestName,
  firstName,
  code,
  slug,
  thankYou,
  onCopy,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  contestName: string;
  firstName: string;
  code: string;
  slug: string;
  thankYou?: PublicThankYou;
  onCopy: () => void;
}) {
  if (!thankYou?.enabled) {
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
        <RegistrationId code={code} onCopy={onCopy} />
        <Link className="submit next" to="/login" target="_blank" rel="noopener noreferrer">
          Log in to BrainPulses <ArrowRight aria-hidden />
        </Link>
      </div>
    );
  }

  const title =
    thankYou.kind === 'custom' && thankYou.title?.trim()
      ? thankYou.title.trim()
      : "You're registered!";
  const html =
    thankYou.kind === 'custom' && thankYou.html ? sanitizeInstructionsHtml(thankYou.html) : '';
  const href = safeHttpUrl(thankYou.buttonUrl);
  const quizzes = thankYou.showQuizzes ? (thankYou.quizzes ?? []) : [];

  return (
    <div className="done">
      {thankYou.kind === 'image' && thankYou.image ? (
        <img
          className="thanks-image"
          src={apiUrl(`/api/public/contest-forms/${encodeURIComponent(slug)}/image/thank-you`)}
          alt=""
        />
      ) : (
        <div className="ok">
          <Check aria-hidden />
        </div>
      )}
      <h2 ref={headingRef} tabIndex={-1}>
        {title}
      </h2>
      {thankYou.kind === 'custom' && html ? (
        <div className="thanks-copy" dangerouslySetInnerHTML={{ __html: html }} />
      ) : thankYou.kind === 'image' ? null : (
        <p>
          Welcome to {contestName}
          {firstName ? `, ${firstName}` : ''}.
        </p>
      )}
      {thankYou.showNextSteps ? <NextSteps /> : null}
      {quizzes.length > 0 ? (
        <div className="thanks-quizzes">
          <p>Your quizzes</p>
          <ul>
            {quizzes.map((quiz) => (
              <li key={quiz.id}>
                <b>{quiz.name}</b>
                <span>{quiz.kind === 'assessment' ? 'Assessment' : 'Quiz'}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <RegistrationId code={code} onCopy={onCopy} />
      <div className="done-actions">
        {href && thankYou.buttonLabel?.trim() ? (
          <a className="submit next" href={href} target="_blank" rel="noopener noreferrer">
            {thankYou.buttonLabel.trim()} <ArrowRight aria-hidden />
          </a>
        ) : null}
        <Link className="submit next" to="/login" target="_blank" rel="noopener noreferrer">
          Log in to BrainPulses <ArrowRight aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function RegistrationId({ code, onCopy }: { code: string; onCopy: () => void }) {
  return (
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
  );
}

function NextSteps() {
  return (
    <ol className="thanks-steps">
      <li>
        <b>Fill in this form</b>
        <span>Your details for this contest.</span>
      </li>
      <li>
        <b>Get your Registration ID</b>
        <span>Displayed immediately after successful registration.</span>
      </li>
      <li>
        <b>Log in with it</b>
        <span>Your quizzes appear on your home page when they&apos;re ready.</span>
      </li>
    </ol>
  );
}

function safeHttpUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}
