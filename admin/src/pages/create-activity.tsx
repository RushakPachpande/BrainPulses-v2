import { ActivityWizardPage } from '@/pages/activity-wizard';
import type { ActivityKind } from '@/services';

/** @deprecated Prefer ActivityWizardPage — kept for existing lazy imports. */
export function CreateActivityPage({ kind }: { kind: ActivityKind }) {
  return <ActivityWizardPage kind={kind} mode="create" />;
}
