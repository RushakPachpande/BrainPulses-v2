import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('BrainPulses student UI error', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="error-boundary" role="alert" aria-live="assertive">
          <section>
            <h1>We couldn’t display this page</h1>
            <p>
              Your data in this browser has not intentionally been cleared. Return to the dashboard
              and try again.
            </p>
            <button className="btn primary" onClick={() => window.location.assign('/dashboard')}>
              Return to dashboard
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
