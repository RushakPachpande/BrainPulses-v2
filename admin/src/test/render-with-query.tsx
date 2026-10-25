import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAdminQueryClient } from '@/lib/query-client';

/** Pages that call useQuery need the same client factory the app uses. */
export function renderWithAdminQuery(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  const client = createAdminQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(ui, { ...options, wrapper: Wrapper });
}
