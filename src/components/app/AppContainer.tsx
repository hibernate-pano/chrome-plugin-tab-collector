import React, { useEffect } from 'react';
import { ToastProvider } from '@/contexts/ToastContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { MainApp } from './MainApp';
import { ensureLocalDataReady } from '@/utils/appBootstrap';

export const AppContainer: React.FC = () => {
  useEffect(() => {
    ensureLocalDataReady().catch(error => {
      console.error('[app] local bootstrap failed', error);
    });
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <ThemeProvider>
          <MainApp />
        </ThemeProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
};
