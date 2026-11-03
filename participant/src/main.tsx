import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/sora/700.css';
import '@fontsource/sora/800.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AppErrorBoundary from './AppErrorBoundary';
import { applyClientTheme, readClientDark } from './hooks/use-client-theme';
import './styles.css';

applyClientTheme(readClientDark());

const root = document.getElementById('root');
if (!root) throw new Error('Required #root mount element is missing');

createRoot(root).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
