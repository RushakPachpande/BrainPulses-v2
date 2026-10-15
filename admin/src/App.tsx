import { BrowserRouter } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/auth';
import { ThemeProvider } from '@/contexts/theme';
import { AppRoutes } from '@/routes';

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
