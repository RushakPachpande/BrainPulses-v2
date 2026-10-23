import { BrowserRouter } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiLoadingProvider } from '@/contexts/api-loading';
import { AuthProvider } from '@/contexts/auth';
import { AdminQueryProvider } from '@/contexts/query-provider';
import { ThemeProvider } from '@/contexts/theme';
import { AppRoutes } from '@/routes';

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <BrowserRouter>
          <ApiLoadingProvider>
            <AuthProvider>
              <AdminQueryProvider>
                <AppRoutes />
              </AdminQueryProvider>
            </AuthProvider>
          </ApiLoadingProvider>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
