import { ArrowRight, ChevronDown, CircleHelp, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Heading } from '../components/ui-bits';

const rows = [
  [
    'How do timed assessments work?',
    'The timer begins when you start. Navigate between questions, mark items for review, and submit before time runs out. Timed attempts submit automatically when the server deadline is reached.',
  ],
  [
    'Can I change an answer?',
    'Yes. Select another option before submitting, or use the question overview to jump between questions. Answers are saved to the server as you go.',
  ],
  [
    'What happens if I refresh during an attempt?',
    'Your in-progress attempt can be resumed. Open the activity again and continue from your last saved answers and remaining time.',
  ],
  [
    'Where can I see my scores?',
    'Open My results from the sidebar after you submit. Scores are stored on the server for your account.',
  ],
] as const;

export function HelpPage() {
  const [faq, setFaq] = useState(0);
  return (
    <div className="page-stack">
      <Heading
        eyebrow="SUPPORT"
        title="Help centre"
        description="A few quick answers to help you get the most from BrainPulses."
      />
      <div className="help-layout">
        <section className="panel help-list">
          <div className="panel-heading">
            <div>
              <h2>Frequently asked questions</h2>
              <p>Assessment basics and account support.</p>
            </div>
          </div>
          {rows.map(([q, a], i) => (
            <div className="faq-item" key={q}>
              <button type="button" onClick={() => setFaq(faq === i ? -1 : i)}>
                <span>{q}</span>
                <ChevronDown size={17} className={faq === i ? 'rotate' : ''} />
              </button>
              {faq === i && <p>{a}</p>}
            </div>
          ))}
        </section>
        <aside className="panel help-contact">
          <div className="help-icon">
            <CircleHelp size={22} />
          </div>
          <h2>Need a hand?</h2>
          <p>
            If you run into a problem during an attempt, note the activity and question number
            before asking your coordinator for help.
          </p>
          <div className="help-note">
            <ShieldCheck size={16} />
            <span>You can safely refresh a timed attempt — progress is saved server-side.</span>
          </div>
          <a className="btn outline full" href="mailto:support@brainpulses.example">
            Contact support <ArrowRight size={15} />
          </a>
        </aside>
      </div>
    </div>
  );
}
